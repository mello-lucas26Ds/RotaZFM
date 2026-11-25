import { createHash } from 'node:crypto';

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 1_000_000;

const SOURCES = [
  {
    id: 'inmet-previsao-manaus',
    dimension: 'chuva',
    url: 'https://apiprevmet3.inmet.gov.br/previsao/1302603',
    expected: 'json',
  },
  {
    id: 'sgb-sace-amazonas',
    dimension: 'nivel',
    url: 'https://sace.sgb.gov.br/',
    expected: 'html',
  },
  {
    id: 'ana-sala-situacao-boletins',
    dimension: 'nivel',
    url: 'https://www.gov.br/ana/pt-br/sala-de-situacao/rio-amazonas/boletins/diario',
    expected: 'html',
  },
  {
    id: 'dnit-pnct-contagem',
    dimension: 'trafego',
    url: 'https://servicos.dnit.gov.br/dadosabertos/dataset/contagem-de-trafego',
    expected: 'html',
  },
  {
    id: 'dnit-icm-pavimento',
    dimension: 'qualidade',
    url: 'https://servicos.dnit.gov.br/dadosabertos/dataset/condicoes-do-pavimento',
    expected: 'html',
  },
];

const FALLBACK_BY_SOURCE = Object.freeze({
  'inmet-previsao-manaus': 'manter fixture rain_signal e marcar NAO_AVALIAVEL; não bloquear a rota',
  'sgb-sace-amazonas': 'usar boletim ANA gov.br via scripts/extract-ana-boletim.py ou fixture auditável; não usar API ANA',
  'ana-sala-situacao-boletins': 'fallback para o boletim mais recente disponível na listagem ou NAO_AVALIAVEL',
  'dnit-pnct-contagem': 'manter PNCT 2022 como dado_historico_defasado e não bloquear por tráfego',
  'dnit-icm-pavimento': 'marcar qualidade NAO_AVALIAVEL sem bloquear a rota',
});

async function readLimited(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;

  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = MAX_BYTES - size;
    if (value.length > remaining) {
      chunks.push(value.subarray(0, remaining));
      size += remaining;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.length;
  }

  return { body: Buffer.concat(chunks).toString('utf8'), truncated };
}

async function probe(source) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: source.expected === 'json' ? 'application/json,text/html;q=0.8,*/*;q=0.5' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'user-agent': 'RotaZFM-MVP/0.1 validacao-documental',
      },
    });
    const { body, truncated } = await readLimited(response);
    const contentType = response.headers.get('content-type') ?? '';
    const result = {
      id: source.id,
      dimension: source.dimension,
      url: source.url,
      expected: source.expected,
      http_status: response.status,
      ok: response.ok,
      content_type: contentType,
      bytes: Buffer.byteLength(body, 'utf8'),
      truncated,
      duration_ms: Date.now() - started,
      sha256: createHash('sha256').update(body).digest('hex'),
      fallback_action: FALLBACK_BY_SOURCE[source.id] ?? null,
    };

    if (source.expected === 'json') {
      try {
        const parsed = JSON.parse(body);
        result.json_parseable = true;
        result.top_level_keys = Object.keys(parsed).slice(0, 12);
      } catch {
        result.json_parseable = false;
      }
    }

    return result;
  } catch (error) {
    return {
      id: source.id,
      dimension: source.dimension,
      url: source.url,
      expected: source.expected,
      http_status: null,
      ok: false,
      content_type: null,
      bytes: 0,
      truncated: false,
      duration_ms: Date.now() - started,
      sha256: null,
      error: error?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR',
      fallback_action: FALLBACK_BY_SOURCE[source.id] ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (const source of SOURCES) {
  const result = await probe(source);
  results.push(result);
  if (!result.ok || result.json_parseable === false) {
    const detail = result.error ?? `HTTP ${result.http_status ?? 'desconhecido'}`;
    console.error(`AVISO fonte ${result.id}: ${detail}; fallback: ${result.fallback_action ?? 'não definido'}`);
  }
}

console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  policy: 'GETs publicos minimos; timeout 12s; sem Firecrawl/Alexandria pago; sem credenciais ANA; payload nao e persistido, apenas hash/tamanho',
  sources: results,
}, null, 2));
