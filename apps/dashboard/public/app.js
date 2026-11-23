const form = document.getElementById('viability-form');
const errorBox = document.getElementById('error');
const emptyState = document.getElementById('empty-state');
const snapshotRoot = document.getElementById('snapshot');
const fontesList = document.getElementById('fontes');
const newsList = document.getElementById('news');

const manausDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Manaus',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateOnly(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return manausDateFormatter.format(date);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function formatIav(value) {
  return value === null || value === undefined ? '—' : String(value);
}

function formatScalarList(values) {
  return values
    .map((value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)))
    .join(', ');
}

function formatRulesValue(rules) {
  const parts = [];
  for (const [key, entry] of Object.entries(rules ?? {})) {
    if (entry === null || entry === undefined) continue;
    if (Array.isArray(entry)) {
      parts.push(
        entry.every((item) => item === null || typeof item !== 'object')
          ? `${key}=${formatScalarList(entry)}`
          : `${key}=${JSON.stringify(entry)}`,
      );
    } else if (typeof entry !== 'object') {
      parts.push(`${key}=${entry}`);
    }
    if (parts.length === 6) break;
  }
  return parts.join(', ');
}

function formatNestedEvidenceValue(key, entry) {
  if (key === 'km_range') {
    const start = entry.start_km ?? entry.start ?? entry.from_km;
    const end = entry.end_km ?? entry.end ?? entry.to_km;
    if (start !== undefined || end !== undefined) return `km=${start ?? '—'}–${end ?? '—'}`;
  }
  if (key === 'rules' && typeof entry === 'object' && !Array.isArray(entry)) {
    const formatted = formatRulesValue(entry);
    if (formatted) return `rules=${formatted}`;
  }
  return null;
}

function formatEvidenceValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return String(value);

  const parts = [];
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry !== 'object') {
      parts.push(`${key}=${entry}`);
    } else {
      const nested = formatNestedEvidenceValue(key, entry);
      if (nested) parts.push(nested);
    }
    if (parts.length === 10) break;
  }
  return parts.length > 0 ? parts.join('; ') : JSON.stringify(value);
}

function formatFreshness(hours) {
  return Number.isFinite(hours) ? `${hours}h` : '—';
}

function formatTimestamp(value) {
  return typeof value === 'string' && value ? value.replace('T', ' ').slice(0, 19) : '—';
}

function statusBadge(status) {
  return element('span', `badge status-${status}`, status);
}

function renderDimensions(dimensions) {
  const details = element('details');
  details.append(element('summary', null, 'Dimensões'));
  const list = element('ul', 'list');
  for (const [name, dimension] of Object.entries(dimensions ?? {})) {
    const item = element('li');
    item.append(
      element('strong', null, name),
      document.createTextNode(
        ` — ${dimension.status ?? '—'}; score ${formatIav(dimension.score)}; peso ${formatIav(dimension.weighted_score)}; fonte ${dimension.source ?? '—'}; frescor ${formatFreshness(dimension.freshness_hours)}`,
      ),
    );
    list.append(item);
  }
  details.append(list);
  return details;
}

function renderEvidenceList(title, evidences) {
  const details = element('details');
  details.append(element('summary', null, title));
  const list = element('ul', 'list');
  for (const evidence of evidences ?? []) {
    const item = element('li');
    const source = evidence.source_url
      ? (() => {
          const link = element('a', null, evidence.source ?? evidence.source_url);
          link.href = evidence.source_url;
          link.target = '_blank';
          link.rel = 'noreferrer';
          return link;
        })()
      : element('span', null, evidence.source ?? 'fonte não informada');
    const valueText = formatEvidenceValue(evidence.value);
    item.append(
      source,
      document.createTextNode(
        ` — ${evidence.confirmation_status ?? '—'}; frescor ${formatFreshness(evidence.freshness_hours)}; última válida ${formatTimestamp(evidence.last_valid_at)}${valueText ? `; valor ${valueText}` : ''}`,
      ),
    );
    list.append(item);
  }
  if ((evidences ?? []).length === 0) list.append(element('li', 'muted', 'Sem evidências.'));
  details.append(list);
  return details;
}

function renderSegment(segment) {
  const row = document.createElement('tr');
  row.append(
    element('td', null, segment.name ?? segment.segment_id),
    element('td', null, `${segment.from ?? '—'} → ${segment.to ?? '—'}`),
    element('td', null, segment.mode ?? '—'),
    element('td', null, segment.critical ? 'sim' : 'não'),
    element('td', null, segment.status),
    element('td', null, formatIav(segment.iav)),
  );
  return row;
}

function renderRoute(route) {
  const card = element('article', 'route-card');
  const head = element('div', 'route-head');
  const title = element('h3', 'route-title', route.name ?? route.route_id);
  head.append(title, statusBadge(route.status));
  card.append(head);

  const meta = element('p', 'meta');
  meta.textContent = `${route.origin ?? '—'} → ${route.destination ?? '—'} · ${route.mode ?? '—'} · ${route.approx_distance_km ?? '—'} km · pior trecho ${route.worst_segment_id ?? '—'}`;
  card.append(meta);

  const iav = element('p', 'iav', formatIav(route.iav));
  card.append(iav);

  if ((route.blockers ?? []).length > 0) {
    const blockers = element('ul', 'list');
    for (const blocker of route.blockers) {
      blockers.append(element('li', null, `${blocker.type ?? 'BLOQUEIO'} em ${blocker.segment_id ?? '—'}: ${blocker.description ?? 'sem descrição'}${blocker.pbtc_kg ? ` (PBTC ${blocker.pbtc_kg} kg)` : ''}`));
    }
    card.append(blockers);
  }

  if ((route.missing_data ?? []).length > 0) {
    const missing = element('ul', 'list');
    for (const item of route.missing_data) {
      missing.append(element('li', null, `Faltante ${item.dimension ?? '—'} em ${item.segment_id ?? '—'}: ${item.reason ?? 'sem motivo'}`));
    }
    card.append(missing);
  }

  const tableWrap = element('div', 'table-wrap');
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Trecho', 'De/para', 'Modo', 'Crítico', 'Status', 'IAV']) {
    headRow.append(element('th', null, label));
  }
  thead.append(headRow);
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const segment of route.segments ?? []) tbody.append(renderSegment(segment));
  table.append(tbody);
  tableWrap.append(table);
  card.append(tableWrap);

  const details = element('div', 'small');
  for (const segment of route.segments ?? []) {
    const segmentDetails = element('details');
    segmentDetails.append(element('summary', null, `Detalhes de ${segment.name ?? segment.segment_id}`));
    segmentDetails.append(renderDimensions(segment.dimensions));
    segmentDetails.append(renderEvidenceList('Evidências', segment.evidences));
    details.append(segmentDetails);
  }
  details.append(renderEvidenceList('Evidências da rota', route.evidences));
  card.append(details);

  if ((route.related_news ?? []).length > 0) {
    const routeNews = element('section');
    routeNews.append(element('h4', null, 'Notícias da rota'));
    routeNews.append(renderNews(route.related_news));
    card.append(routeNews);
  }

  return card;
}

function renderNews(news) {
  const list = element('ul', 'list');
  for (const item of news ?? []) {
    const li = element('li');
    const title = item.title ?? item.headline ?? item.url ?? item.source ?? 'Notícia';
    if (item.url) {
      const link = element('a', null, title);
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      li.append(link);
    } else {
      li.append(element('span', null, title));
    }
    li.append(document.createTextNode(` — ${item.source ?? 'fonte não informada'} · ${formatTimestamp(item.published_at ?? item.collected_at)}`));
    list.append(li);
  }
  if ((news ?? []).length === 0) list.append(element('li', 'muted', 'Sem notícias relacionadas.'));
  return list;
}

function renderSnapshot(snapshot) {
  snapshotRoot.replaceChildren();
  emptyState.hidden = true;
  snapshotRoot.hidden = false;

  const warning = element('p', 'meta', snapshot.scope_warning ?? '');
  snapshotRoot.append(warning);
  snapshotRoot.append(element('p', 'meta', `Regra ${snapshot.rule_version ?? '—'} · catálogo ${snapshot.catalog_version ?? '—'} · ${snapshot.justification_template ?? ''}`));

  for (const route of snapshot.routes ?? []) snapshotRoot.append(renderRoute(route));
}

async function readError(response) {
  try {
    const body = await response.json();
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    const details = Array.isArray(body?.error?.details)
      ? body.error.details.map((detail) => detail?.message).filter(Boolean)
      : [];
    return details.length > 0 ? `${message}: ${details.join('; ')}` : message;
  } catch {
    return `HTTP ${response.status}`;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;

  const data = new FormData(form);
  const query = {
    origem: data.get('origem'),
    destino: data.get('destino'),
    data_embarque: data.get('data_embarque'),
    carga: {
      tipo: data.get('tipo'),
      peso_bruto_total_kg: Number(data.get('peso_bruto_total_kg')),
    },
  };
  const caminhao = data.get('quantidade_caminhoes');
  if (caminhao) query.carga.quantidade_caminhoes = Number(caminhao);

  try {
    const response = await fetch('/api/v1/viabilidade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!response.ok) throw new Error(await readError(response));
    renderSnapshot(await response.json());
  } catch (error) {
    snapshotRoot.hidden = true;
    emptyState.hidden = false;
    showError(error.message || 'Falha ao consultar viabilidade');
  } finally {
    button.disabled = false;
  }
});

async function loadJson(path) {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function loadFontes() {
  try {
    const body = await loadJson('/api/v1/fontes');
    fontesList.replaceChildren();
    for (const fonte of body.fontes ?? []) {
      const li = element('li');
      li.append(
        element('strong', null, fonte.source ?? 'Fonte'),
        document.createTextNode(` — ${fonte.status ?? '—'} · ${fonte.evidence_count ?? 0} evidências · última coleta ${formatTimestamp(fonte.last_collected_at)}`),
      );
      fontesList.append(li);
    }
    if ((body.fontes ?? []).length === 0) fontesList.append(element('li', 'muted', 'Sem fontes agregadas.'));
  } catch (error) {
    fontesList.replaceChildren(element('li', 'muted', `Fontes indisponíveis: ${error.message}`));
  }
}

async function loadNews() {
  try {
    const body = await loadJson('/api/v1/noticias');
    const items = body.noticias ?? body.related_news ?? body.items ?? [];
    newsList.replaceChildren(...renderNews(items).childNodes);
  } catch (error) {
    newsList.replaceChildren(element('li', 'muted', `Notícias indisponíveis: ${error.message}`));
  }
}

const shippingDateInput = form.elements.data_embarque;
shippingDateInput.value = dateOnly(1);
shippingDateInput.min = dateOnly(0);
shippingDateInput.max = dateOnly(4);
const dateWindowHint = document.getElementById('date-window-hint');
if (dateWindowHint) {
  dateWindowHint.textContent = `Janela aceita: ${shippingDateInput.min} a ${shippingDateInput.max} (America/Manaus).`;
}
loadFontes();
loadNews();
