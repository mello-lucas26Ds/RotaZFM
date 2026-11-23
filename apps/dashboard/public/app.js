const API_KEY_STORAGE = 'iav_api_key';

const ALLOWED_FIELDS = new Set([
  'origem',
  'destino',
  'data_embarque',
  'tipo',
  'peso_bruto_total_kg',
  'quantidade_caminhoes',
]);

const LOAD_TYPES = new Set(['SECA', 'CONTEINERIZADA']);

export function escapeHtml(value) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (char) => map[char]);
}

export function buildIavQuery(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Campos do formulário inválidos');
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new Error(`Campo não permitido: ${key}`);
    }
  }

  for (const key of ['origem', 'destino', 'data_embarque', 'tipo', 'peso_bruto_total_kg']) {
    if (input[key] === undefined || String(input[key]).trim() === '') {
      throw new Error(`Campo obrigatório ausente: ${key}`);
    }
  }

  const tipo = String(input.tipo).trim().toUpperCase();
  if (!LOAD_TYPES.has(tipo)) {
    throw new Error('Tipo de carga inválido');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.data_embarque).trim())) {
    throw new Error('Data de embarque inválida');
  }

  const peso = Number(input.peso_bruto_total_kg);
  if (!Number.isInteger(peso) || peso < 1 || peso > 60000) {
    throw new Error('Peso bruto total deve ser inteiro entre 1 e 60000 kg');
  }

  const query = {
    origem: String(input.origem).trim(),
    destino: String(input.destino).trim(),
    data_embarque: String(input.data_embarque).trim(),
    carga: {
      tipo,
      peso_bruto_total_kg: peso,
    },
  };

  if (input.quantidade_caminhoes !== undefined && String(input.quantidade_caminhoes).trim() !== '') {
    const quantidade = Number(input.quantidade_caminhoes);
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new Error('Quantidade de caminhões deve ser inteiro maior que zero');
    }
    query.carga.quantidade_caminhoes = quantidade;
  }

  return query;
}

function textOrFallback(value) {
  if (value === null || value === undefined || value === '') return '—';
  return escapeHtml(value);
}

function scoreText(value) {
  if (value === null || value === undefined) return 'sem score objetivo';
  return escapeHtml(value);
}

function statusLabel(status) {
  const labels = {
    VIAVEL: 'Viável',
    VIAVEL_COM_RESSALVAS: 'Viável com ressalvas',
    NAO_VIAVEL: 'Não viável',
    NAO_AVALIAVEL: 'Não avaliável',
  };
  return labels[status] ?? status ?? 'desconhecido';
}

function genericItem(item) {
  const text = typeof item === 'string' ? item : JSON.stringify(item);
  return `<li>${escapeHtml(text ?? '—')}</li>`;
}

function renderList(title, items, renderItem) {
  const list = Array.isArray(items) ? items : [];
  const body = list.length === 0
    ? '<p class="vazio">Nenhum item.</p>'
    : `<ul>${list.map(renderItem).join('')}</ul>`;
  return `<section class="bloco"><h3>${escapeHtml(title)} (${list.length})</h3>${body}</section>`;
}

function dimensionsText(dimensions) {
  if (!dimensions || typeof dimensions !== 'object') return 'sem dimensões';
  const entries = Object.entries(dimensions);
  if (entries.length === 0) return 'sem dimensões';
  return entries
    .map(([name, dimension]) => `${escapeHtml(name)}: ${scoreText(dimension?.score)}`)
    .join(' · ');
}

function renderSegments(segments) {
  const list = Array.isArray(segments) ? segments : [];
  if (list.length === 0) return '<p class="vazio">Sem trechos.</p>';
  return `<ol class="trechos">${list.map((segment) => `
    <li>
      <strong>${textOrFallback(segment.name)}</strong>
      ${textOrFallback(segment.from)} → ${textOrFallback(segment.to)}
      · ${textOrFallback(segment.road)} · modo ${textOrFallback(segment.mode)}
      ${segment.critical ? '· <strong>crítico</strong>' : ''}
      <br />
      <span class="meta">status: ${escapeHtml(statusLabel(segment.status))} · IAV: ${scoreText(segment.iav)}</span>
      <br />
      <small>dimensões: ${dimensionsText(segment.dimensions)}</small>
    </li>`).join('')}</ol>`;
}

function renderRoute(route) {
  return `<article class="rota">
    <h3>${textOrFallback(route.name ?? route.route_id)}
      <span class="badge ${escapeHtml(route.status)}">${escapeHtml(statusLabel(route.status))}</span>
    </h3>
    <p class="meta">
      IAV: ${scoreText(route.iav)} · pior trecho: ${textOrFallback(route.worst_segment_id)} ·
      ${textOrFallback(route.origin)} → ${textOrFallback(route.destination)} · modo ${textOrFallback(route.mode)}
    </p>
    ${renderSegments(route.segments)}
  </article>`;
}

function renderEvidence(evidence) {
  const url = evidence.source_url ?? evidence.url ?? null;
  const label = evidence.source ?? evidence.title ?? url ?? 'fonte sem URL';
  const link = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
    : escapeHtml(label);
  const meta = [
    `publicado: ${textOrFallback(evidence.published_at)}`,
    `coletado: ${textOrFallback(evidence.collected_at)}`,
    `última validade: ${textOrFallback(evidence.last_valid_at)}`,
    `método: ${textOrFallback(evidence.method)}`,
    `status: ${textOrFallback(evidence.confirmation_status)}`,
    `frescor (h): ${textOrFallback(evidence.freshness_hours)}`,
    `hash: <code>${escapeHtml(evidence.content_hash ?? '—')}</code>`,
  ].join(' · ');
  return `<li><strong>${link}</strong><br /><small class="meta">${meta}</small></li>`;
}

function renderNewsItem(item) {
  const url = item.url ?? item.source_url ?? null;
  const title = item.title ?? item.evidence_id ?? 'notícia';
  const link = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
    : escapeHtml(title);
  const segments = Array.isArray(item.matched_segments) ? item.matched_segments.join(', ') : '';
  const meta = [
    `fonte: ${textOrFallback(item.source)}`,
    `publicado: ${textOrFallback(item.published_at)}`,
    `confirmação: ${textOrFallback(item.confirmation_status)}`,
    segments ? `trechos: ${escapeHtml(segments)}` : '',
  ].filter(Boolean).join(' · ');
  return `<li>${link}<br /><small class="meta">${meta}</small></li>`;
}

function renderSnapshot(snapshot) {
  const routes = Array.isArray(snapshot.routes) ? snapshot.routes : [];
  const routesHtml = routes.length === 0
    ? '<p class="vazio">Nenhuma rota retornada.</p>'
    : routes.map(renderRoute).join('');

  return `
    <section class="meta-snapshot">
      <p><strong>rule_version:</strong> ${textOrFallback(snapshot.rule_version)}</p>
      <p><strong>catalog_version:</strong> ${textOrFallback(snapshot.catalog_version)}</p>
      <p class="scope"><strong>Aviso de escopo:</strong> ${textOrFallback(snapshot.scope_warning)}</p>
    </section>
    ${routesHtml}
    ${renderList('Bloqueadores', snapshot.blockers, genericItem)}
    ${renderList('Dados ausentes', snapshot.missing_data, genericItem)}
    ${renderList('Evidências', snapshot.evidences, renderEvidence)}
    ${renderList('Notícias relacionadas', snapshot.related_news, renderNewsItem)}
  `;
}

const ERROR_TITLES = {
  400: 'Consulta inválida',
  401: 'Não autorizado',
  404: 'Rota não encontrada',
  429: 'Limite de requisições excedido',
  500: 'Erro interno',
  502: 'API indisponível',
};

function renderApiError(status, body) {
  const error = body?.error ?? {};
  const title = ERROR_TITLES[status] ?? 'Erro inesperado';
  let message = `${title} (${status} ${error.code ?? 'ERROR'}): ${error.message ?? 'sem detalhes'}`;
  if (status === 429 && typeof error.retry_after_seconds === 'number') {
    message += ` Tente novamente em ${error.retry_after_seconds}s.`;
  }
  return `<p class="erro">${escapeHtml(message)}</p>`;
}

async function onSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const resultado = document.getElementById('resultado');
  const submitButton = document.getElementById('consultar');
  const apiKeyInput = document.getElementById('api-key');

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    resultado.innerHTML = '<p class="erro">Informe a API key para consultar a API.</p>';
    apiKeyInput.focus();
    return;
  }

  let query;
  try {
    query = buildIavQuery({
      origem: document.getElementById('origem').value,
      destino: document.getElementById('destino').value,
      data_embarque: document.getElementById('data_embarque').value,
      tipo: document.getElementById('tipo').value,
      peso_bruto_total_kg: document.getElementById('peso_bruto_total_kg').value,
      quantidade_caminhoes: document.getElementById('quantidade_caminhoes').value,
    });
  } catch (error) {
    resultado.innerHTML = `<p class="erro">${escapeHtml(error.message)}</p>`;
    return;
  }

  try {
    sessionStorage.setItem(API_KEY_STORAGE, apiKey);
  } catch {
    // sessionStorage pode estar indisponível; a chave continua só em memória nesta requisição.
  }

  submitButton.disabled = true;
  resultado.innerHTML = '<p class="carregando">Consultando viabilidade…</p>';

  try {
    const response = await fetch('/v1/viabilidade', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(query),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      resultado.innerHTML = renderApiError(response.status, body);
      return;
    }
    resultado.innerHTML = renderSnapshot(body);
  } catch {
    resultado.innerHTML = '<p class="erro">API indisponível. Verifique se a API está no ar.</p>';
  } finally {
    submitButton.disabled = false;
  }
}

function init() {
  if (typeof document === 'undefined') return;
  const form = document.getElementById('viabilidade-form');
  const apiKeyInput = document.getElementById('api-key');
  if (!form || !apiKeyInput) return;

  try {
    apiKeyInput.value = sessionStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    // sem sessionStorage, segue com campo vazio
  }

  form.addEventListener('submit', onSubmit);
}

init();
