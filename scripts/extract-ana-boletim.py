#!/usr/bin/env python3
"""Extrai o boletim diário da ANA publicado no gov.br/Sala de Situação."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

try:
    import pymupdf
except ImportError as exc:  # pragma: no cover - depende do ambiente local
    raise SystemExit(
        "PyMuPDF não está instalado. Instale com: python3 -m pip install --user pymupdf"
    ) from exc

LISTING_URL = "https://www.gov.br/ana/pt-br/sala-de-situacao/rio-amazonas/boletins/diario"
DEFAULT_STATIONS = {
    "14990000": {"station": "Manaus", "river": "Rio Negro", "segments": [
        ("rota-1-br-319", "r1-s1-balsa-inicial"),
        ("rota-2-fluvial-brasilia", "r2-s1-fluvial-amazonas"),
    ]},
    "16030000": {"station": "Itacoatiara", "river": "Amazonas", "segments": [
        ("rota-2-fluvial-brasilia", "r2-s1-fluvial-amazonas"),
    ]},
    "17050001": {"station": "Óbidos", "river": "Amazonas", "segments": [
        ("rota-2-fluvial-brasilia", "r2-s1-fluvial-amazonas"),
    ]},
    "17900000": {"station": "Santarém", "river": "Tapajós", "segments": [
        ("rota-2-fluvial-brasilia", "r2-s1-fluvial-amazonas"),
    ]},
}
MANAUS_TZ = ZoneInfo("America/Manaus")
USER_AGENT = "RotaZFM/0.1 (+https://github.com/mello-lucas26Ds/RotaZFM) gov.br-public-data"
DATE_ANCHOR_RE = re.compile(
    r'<a\s+href="([^"]*boletim_01_amazonas_publica[^"]+\.pdf/view)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
VISIBLE_DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{4})")
PDF_DATE_RE = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
B_START_RE = re.compile(r"b_start:int=(\d+)")
TAG_RE = re.compile(r"<[^>]+>")
HEADER_LABELS = ("Data", "Nível", "Referência", "Limite", "Diferença")
INT_RE = re.compile(r"-?\d+")


def warn(message: str) -> None:
    print(f"AVISO: {message}", file=sys.stderr)


def http_get(url: str, *, timeout: int = 30, max_bytes: int | None = None) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content_type = response.headers.get("Content-Type", "")
            if max_bytes is None:
                body = response.read()
            else:
                body = response.read(max_bytes + 1)
                if len(body) > max_bytes:
                    raise RuntimeError(f"resposta excedeu {max_bytes} bytes")
            return body, content_type
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} em {url}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"falha de rede em {url}: {exc}") from exc


def strip_tags(fragment: str) -> str:
    return html.unescape(TAG_RE.sub(" ", fragment)).strip()


def parse_visible_date(fragment: str) -> date | None:
    match = VISIBLE_DATE_RE.search(strip_tags(fragment))
    if not match:
        return None
    day, month, year = map(int, match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def iso_date(value: date) -> str:
    return value.isoformat()


def parse_pdf_date(value: str) -> str | None:
    match = PDF_DATE_RE.fullmatch(value.strip())
    if not match:
        return None
    day, month, year = map(int, match.groups())
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def pdf_url_for_view(view_url: str) -> str:
    return f"{view_url.removesuffix('/view')}/@@download/file"


def parse_boletim_candidates(html_text: str, base_url: str = LISTING_URL) -> list[dict[str, Any]]:
    candidates = []
    seen = set()
    for match in DATE_ANCHOR_RE.finditer(html_text):
        href = html.unescape(match.group(1)).strip()
        bulletin_date = parse_visible_date(match.group(2))
        if bulletin_date is None:
            continue
        url = urllib.parse.urljoin(base_url, href)
        key = (url, bulletin_date.isoformat())
        if key in seen:
            continue
        seen.add(key)
        candidates.append({"view_url": url, "date": bulletin_date})
    return candidates


def manaus_today() -> date:
    return datetime.now(MANAUS_TZ).date()


def select_boletim_candidate(candidates: list[dict[str, Any]], today: date | None = None) -> dict[str, Any]:
    if not candidates:
        raise RuntimeError("nenhum boletim diário encontrado na listagem gov.br")
    today = today or manaus_today()
    for candidate in candidates:
        if candidate["date"] == today:
            return {**candidate, "selection_reason": "data_atual"}
    latest = max(candidates, key=lambda item: item["date"])
    return {**latest, "selection_reason": "fallback_data_mais_recente_disponivel"}


def discover_boletim(today: date | None = None) -> dict[str, Any]:
    today = today or manaus_today()
    first_html_bytes, _ = http_get(LISTING_URL, timeout=30)
    first_html = first_html_bytes.decode("utf-8", errors="ignore")

    starts = [int(value) for value in B_START_RE.findall(first_html)]
    pages = [LISTING_URL]
    if starts:
        last_start = max(starts)
        last_url = f"{LISTING_URL}?b_start:int={last_start}"
        if last_url not in pages:
            pages.append(last_url)

    candidates: list[dict[str, Any]] = []
    for page_url in pages:
        page_html = first_html if page_url == LISTING_URL else http_get(page_url, timeout=30)[0].decode("utf-8", errors="ignore")
        candidates.extend(parse_boletim_candidates(page_html, page_url))

    unique = { (item["view_url"], item["date"].isoformat()): item for item in candidates }
    selected = select_boletim_candidate(list(unique.values()), today)
    selected["listing_pages_checked"] = pages
    selected["listing_url"] = LISTING_URL
    selected["pdf_url"] = pdf_url_for_view(selected["view_url"])
    return selected


def try_date_pattern_fallback(today: date, days: int = 14) -> dict[str, Any] | None:
    for offset in range(days + 1):
        candidate_date = today - timedelta(days=offset)
        slug = candidate_date.strftime("%d%m")
        for suffix in ("-1", ""):
            view_url = (
                "https://www.gov.br/ana/pt-br/sala-de-situacao/rio-amazonas/boletins/diario/"
                f"boletim_01_amazonas_publica{slug}{suffix}.pdf/view"
            )
            try:
                status_body, _ = http_get(view_url, timeout=15, max_bytes=250_000)
            except RuntimeError as exc:
                warn(f"fallback por data falhou para {candidate_date}: {exc}")
                continue
            if b"Data do boletim" in status_body or b"application/pdf" in status_body:
                return {
                    "view_url": view_url,
                    "date": candidate_date,
                    "selection_reason": "fallback_padrao_de_url_apos_listagem",
                    "listing_pages_checked": [LISTING_URL],
                    "listing_url": LISTING_URL,
                    "pdf_url": pdf_url_for_view(view_url),
                }
    return None


def download_boletim(selected: dict[str, Any]) -> bytes:
    body, content_type = http_get(selected["pdf_url"], timeout=90, max_bytes=30_000_000)
    if not body.startswith(b"%PDF"):
        raise RuntimeError(f"download não retornou PDF (content-type={content_type or 'desconhecido'})")
    return body


def boletim_metadata(view_url: str) -> dict[str, str | None]:
    try:
        body, _ = http_get(view_url, timeout=30, max_bytes=500_000)
    except RuntimeError as exc:
        warn(f"metadados do boletim indisponíveis em {view_url}: {exc}")
        return {}
    text = body.decode("utf-8", errors="ignore")
    plain = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)))
    metadata: dict[str, str | None] = {}
    patterns = {
        "published_at": r"Publicado em\s+(\d{2}/\d{2}/\d{4})\s+(\d{2})h(\d{2})",
        "updated_at": r"Atualizado em\s+(\d{2}/\d{2}/\d{4})\s+(\d{2})h(\d{2})",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, plain)
        if match:
            date_text, hour, minute = match.groups()
            iso_date_value = parse_pdf_date(date_text)
            if iso_date_value:
                metadata[key] = f"{iso_date_value}T{hour}:{minute}:00-04:00"
    return metadata


def word_dicts(page: Any) -> list[dict[str, Any]]:
    words = []
    for item in page.get_text("words"):
        x0, y0, x1, y1, text, block, line, wn = item[:8]
        words.append({
            "x0": float(x0),
            "top": float(y0),
            "x1": float(x1),
            "bottom": float(y1),
            "text": str(text),
            "block_no": int(block),
            "line_no": int(line),
            "word_no": int(wn),
            "center_x": (float(x0) + float(x1)) / 2,
            "center_y": (float(y0) + float(y1)) / 2,
        })
    return words


def center_distance(left: float, right: float) -> float:
    return abs(left - right)


def find_header(words: list[dict[str, Any]], code_word: dict[str, Any]) -> dict[str, Any] | None:
    label_positions = []
    for word in words:
        if word["text"] in HEADER_LABELS and code_word["bottom"] - 5 <= word["top"] <= code_word["bottom"] + 120:
            if code_word["x0"] - 180 <= word["x0"] <= code_word["x0"] + 520:
                label_positions.append(word)

    by_label: dict[str, list[dict[str, Any]]] = {label: [] for label in HEADER_LABELS}
    for word in label_positions:
        by_label[word["text"]].append(word)

    best = None
    for data_word in by_label["Data"]:
        y = data_word["top"]
        row_candidates = {}
        for label in HEADER_LABELS:
            candidates = [
                word for word in by_label[label]
                if abs(word["top"] - y) <= 8 and abs(word["center_x"] - data_word["center_x"]) < 800
            ]
            if not candidates:
                break
            row_candidates[label] = min(candidates, key=lambda item: abs(item["top"] - y))
        if len(row_candidates) != len(HEADER_LABELS):
            continue
        ordered = [row_candidates[label] for label in HEADER_LABELS]
        xs = [word["center_x"] for word in ordered]
        if not all(left < right for left, right in zip(xs, xs[1:])):
            continue
        candidate = {
            "y": y,
            "anchors": {label: word["center_x"] for label, word in zip(HEADER_LABELS, ordered)},
            "x_min": min(word["x0"] for word in ordered) - 80,
            "x_max": max(word["x1"] for word in ordered) + 120,
        }
        if best is None or candidate["y"] < best["y"]:
            best = candidate
    return best


def nearest_anchor(center_x: float, anchors: dict[str, float]) -> str:
    return min(anchors, key=lambda label: center_distance(center_x, anchors[label]))


def row_words_for_date(words: list[dict[str, Any]], date_word: dict[str, Any], header: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        word for word in words
        if word["text"] != date_word["text"]
        and word.get("block_no") == date_word.get("block_no")
        and word["top"] < date_word["bottom"] + 8
        and word["bottom"] > date_word["top"] - 8
        and header["x_min"] <= word["x0"] <= header["x_max"] + 80
    ]


def column_text(row_words: list[dict[str, Any]], header: dict[str, Any], column: str) -> str:
    anchors = header["anchors"]
    ordered = list(HEADER_LABELS)
    column_index = ordered.index(column)
    anchor_x = anchors[column]
    previous_x = anchors[ordered[column_index - 1]] if column_index > 0 else anchor_x - 120
    next_x = anchors[ordered[column_index + 1]] if column_index < len(ordered) - 1 else anchor_x + 120
    left = (previous_x + anchor_x) / 2
    right = (anchor_x + next_x) / 2
    selected = [
        word for word in row_words
        if left <= word["center_x"] < right and nearest_anchor(word["center_x"], anchors) == column
    ]
    selected.sort(key=lambda word: word["x0"])
    return " ".join(word["text"] for word in selected).strip()


def column_number(row_words: list[dict[str, Any]], header: dict[str, Any], column: str) -> int | None:
    text = column_text(row_words, header, column)
    tokens = text.split()
    for token in tokens:
        if INT_RE.fullmatch(token):
            return int(token)
    return None


def parse_station_rows(page: Any, station_codes: list[str]) -> list[dict[str, Any]]:
    words = word_dicts(page)
    results = []
    for code in station_codes:
        code_words = [word for word in words if word["text"] == code]
        if not code_words:
            raise RuntimeError(f"código de estação {code} não encontrado na página 1 do boletim")
        code_word = min(code_words, key=lambda word: word["top"])
        header = find_header(words, code_word)
        if header is None:
            raise RuntimeError(f"cabeçalho da tabela não encontrado para a estação {code}")

        date_candidates = [
            word for word in words
            if PDF_DATE_RE.fullmatch(word["text"])
            and word["top"] > header["y"] + 20
            and word["top"] < header["y"] + 420
            and header["x_min"] <= word["x0"] <= header["x_max"] + 80
        ]
        date_candidates.sort(key=lambda word: (word["top"], word["x0"]))
        date_candidates = date_candidates[:5]
        rows = []
        for date_word in date_candidates:
            iso = parse_pdf_date(date_word["text"])
            row_words = row_words_for_date(words, date_word, header)
            level_cm = column_number(row_words, header, "Nível")
            limit_cm = column_number(row_words, header, "Limite")
            difference_cm = column_number(row_words, header, "Diferença")
            reference = column_text(row_words, header, "Referência") or None
            rows.append({
                "data": iso,
                "nivel_cm": level_cm,
                "referencia": reference,
                "limite_cm": limit_cm,
                "diferenca_cm": difference_cm,
                "nivel_m": round(level_cm / 100, 2) if level_cm is not None else None,
                "limite_m": round(limit_cm / 100, 2) if limit_cm is not None else None,
                "diferenca_m": round(difference_cm / 100, 2) if difference_cm is not None else None,
            })
        rows = [row for row in rows if row["data"] is not None]
        results.append({
            "codigo": code,
            "linhas": rows,
            "ultima_leitura": rows[-1] if rows else None,
        })
    return results


def station_metadata(code: str) -> dict[str, Any]:
    return DEFAULT_STATIONS.get(code, {"station": code, "river": None, "segments": []})


def navigation_signal(row: dict[str, Any] | None) -> str | None:
    if not row or row.get("diferenca_cm") is None:
        return None
    return "ACIMA_DO_LIMITE_BOLETIM" if row["diferenca_cm"] > 0 else "ABAIXO_DO_LIMITE_BOLETIM"


def extract_stations(pdf_bytes: bytes, station_codes: list[str], selected: dict[str, Any], metadata: dict[str, str | None]) -> dict[str, Any]:
    document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        if document.page_count < 1:
            raise RuntimeError("PDF do boletim não possui páginas")
        raw_rows = parse_station_rows(document[0], station_codes)
    finally:
        document.close()

    stations = []
    for item in raw_rows:
        code = item["codigo"]
        meta = station_metadata(code)
        latest = item["ultima_leitura"]
        stations.append({
            "codigo": code,
            "estacao": meta["station"],
            "rio": meta["river"],
            "segmentos": [{"route_id": route_id, "segment_id": segment_id} for route_id, segment_id in meta["segments"]],
            "linhas": item["linhas"],
            "ultima_leitura": latest,
            "sinal_navegabilidade": navigation_signal(latest),
        })

    row_dates = [
        row["data"]
        for station in stations
        for row in station.get("linhas", [])
        if row.get("data")
    ]
    if selected.get("selection_reason") == "pdf_local" and row_dates:
        bulletin_date = max(row_dates)
    else:
        bulletin_date = selected["date"].isoformat()
    return {
        "fonte": "ANA Sala de Situação — Boletins diários Rio Amazonas",
        "pagina": selected.get("listing_pages_checked", [LISTING_URL]),
        "listagem_url": selected.get("listing_url", LISTING_URL),
        "boletim_url": selected["view_url"],
        "pdf_url": selected["pdf_url"],
        "data_boletim": bulletin_date,
        "selecao": selected["selection_reason"],
        "metadados": metadata,
        "metodo_extracao": "PyMuPDF get_text('words') + bounding boxes/colunas",
        "hash_pdf_sha256": f"sha256:{hashlib.sha256(pdf_bytes).hexdigest()}",
        "estações": stations,
    }


def fixture_payload(result: dict[str, Any], collected_at: str) -> dict[str, Any]:
    official_readings = []
    coverage_gaps = []
    for station in result["estações"]:
        latest = station.get("ultima_leitura")
        if not latest or latest.get("nivel_m") is None:
            coverage_gaps.append({
                "station": station["estacao"],
                "station_code": station["codigo"],
                "confirmation_status": "INDISPONIVEL",
                "source": result["fonte"],
                "source_url": result["pdf_url"],
                "notes": "Página 1 do boletim não trouxe leitura numérica para esta estação.",
            })
            continue
        for segment in station["segmentos"]:
            row_id = (
                f"ana-boletim-{result['data_boletim']}-{station['codigo']}-"
                f"{segment['segment_id']}"
            )
            official_readings.append({
                "id": row_id,
                "route_id": segment["route_id"],
                "segment_id": segment["segment_id"],
                "station": station["estacao"],
                "station_code": station["codigo"],
                "river": station["rio"],
                "level_m": latest["nivel_m"],
                "unit": "m",
                "observed_at": latest["data"],
                "published_at": result["metadados"].get("updated_at") or result["metadados"].get("published_at") or f"{result['data_boletim']}T00:00:00-04:00",
                "collected_at": collected_at,
                "method": "govbr_ana_boletim_pdf_pymupdf_bbox",
                "content_hash": result["hash_pdf_sha256"],
                "confirmation_status": "CONFIRMADO",
                "effective_from": latest["data"],
                "effective_until": (date.fromisoformat(latest["data"]) + timedelta(days=2)).isoformat(),
                "reference": latest.get("referencia"),
                "limit_m": latest.get("limite_m"),
                "difference_m": latest.get("diferenca_m"),
                "navigation_threshold_m": latest.get("limite_m"),
                "navigation_signal": station.get("sinal_navegabilidade"),
                "source": result["fonte"],
                "source_url": result["pdf_url"],
                "notes": f"Boletim {result['data_boletim']} selecionado por {result['selecao']}; limite do boletim usado como referência configurável, não como score.",
            })

    return {
        "fixture_version": result["data_boletim"],
        "fixture_kind": "dimension_evidence",
        "dimension": "river_level",
        "created_at": collected_at,
        "created_by": "extract-ana-boletim.py",
        "mock": False,
        "source_status": "CONFIRMADO",
        "sources": [{
            "name": result["fonte"],
            "source_url": result["listagem_url"],
            "official_page_url": result["boletim_url"],
            "pdf_url": result["pdf_url"],
            "verification_date": result["data_boletim"],
            "status": "CONFIRMADO",
            "fallback": "Último boletim disponível na página; Breves não apareceu na página 1.",
        }],
        "official_readings": official_readings,
        "coverage_gaps": coverage_gaps,
        "rules_for_implementation": [
            "Converter cm para metros dividindo por 100.",
            "Não calcular score de navegabilidade sem threshold aprovado; o limite do boletim é referência auditável e pode ser substituído por configuração.",
            "Falha de download/parsing deve gerar NAO_AVALIAVEL/INDISPONIVEL, nunca valor inventado.",
        ],
    }


def print_table(result: dict[str, Any]) -> None:
    print(f"Boletim: {result['data_boletim']} ({result['selecao']})")
    print(f"PDF: {result['pdf_url']}")
    for station in result["estações"]:
        latest = station.get("ultima_leitura") or {}
        print(
            f"{station['codigo']} {station['estacao']} - {station['rio']}: "
            f"data={latest.get('data')} nivel_cm={latest.get('nivel_cm')} "
            f"referencia={latest.get('referencia')} limite_cm={latest.get('limite_cm')} "
            f"diferenca_cm={latest.get('diferenca_cm')} nivel_m={latest.get('nivel_m')}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai boletim diário ANA gov.br/Sala de Situação")
    parser.add_argument("--pdf", help="usa um PDF local em vez de baixar da fonte")
    parser.add_argument("--stations", nargs="*", default=list(DEFAULT_STATIONS), help="códigos ANA a extrair")
    parser.add_argument("--output", help="grava o JSON de extração neste caminho")
    parser.add_argument("--fixture", help="grava payload compatível com data/fixtures neste caminho")
    parser.add_argument("--format", choices=("json", "table"), default="json")
    args = parser.parse_args()

    today = manaus_today()
    try:
        if args.pdf:
            pdf_bytes = Path(args.pdf).read_bytes()
            selected = {
                "view_url": args.pdf,
                "date": today,
                "selection_reason": "pdf_local",
                "listing_pages_checked": [],
                "pdf_url": args.pdf,
            }
            metadata = {}
        else:
            try:
                selected = discover_boletim(today)
            except RuntimeError as exc:
                warn(f"listagem gov.br falhou ({exc}); tentando fallback por data")
                selected = try_date_pattern_fallback(today)
                if selected is None:
                    raise
            pdf_bytes = download_boletim(selected)
            metadata = boletim_metadata(selected["view_url"])

        result = extract_stations(pdf_bytes, args.stations, selected, metadata)
        collected_at = datetime.now(MANAUS_TZ).isoformat(timespec="seconds")
        if args.output:
            Path(args.output).write_text(f"{json.dumps(result, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
        if args.fixture:
            payload = fixture_payload(result, collected_at)
            Path(args.fixture).write_text(f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
        if args.format == "table":
            print_table(result)
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        warn(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
