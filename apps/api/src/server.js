import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ContractValidationError, assertIavQuery } from '@rotazfm/contracts';
import { DomainError, createDecisionSnapshot } from '@rotazfm/domain';
import { buildDecisionInput } from '@rotazfm/ingestion';

const DEFAULT_PORT = 3001;
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_RATE_WINDOW_MS = 60_000;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function toKeyList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim() !== '');
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
  }
  return [];
}

function keyFingerprint(key) {
  return createHash('sha256').update(key).digest();
}

function keyMatches(provided, expected) {
  if (typeof provided !== 'string' || provided === '') return false;
  return timingSafeEqual(keyFingerprint(provided), keyFingerprint(expected));
}

function sendJson(response, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  response.end(payload);
}

function sendError(response, status, code, message, { details, extra } = {}) {
  sendJson(
    response,
    status,
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        ...(extra ?? {}),
      },
    },
  );
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];

    request.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição muito grande'));
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (tooLarge) return;
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'Corpo da requisição não é JSON válido'));
      }
    });

    request.on('error', reject);
  });
}

function authenticate(request, response, apiKeys) {
  const header = request.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  const provided = match?.[1]?.trim() ?? null;

  if (!provided || !apiKeys.some((expected) => keyMatches(provided, expected))) {
    sendError(response, 401, 'UNAUTHORIZED', 'API key ausente ou inválida');
    return null;
  }

  return provided;
}

export function createRateLimiter({ limit = DEFAULT_RATE_LIMIT, windowMs = DEFAULT_RATE_WINDOW_MS, now = () => Date.now() } = {}) {
  const windows = new Map();

  return function check(key) {
    const timestamp = now();
    let entry = windows.get(key);
    if (!entry || timestamp >= entry.resetAt) {
      entry = { resetAt: timestamp + windowMs, count: 0 };
      windows.set(key, entry);
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000)),
      };
    }

    entry.count += 1;
    return { allowed: true };
  };
}

export function consultarViabilidade(query, { referenceDate } = {}) {
  const input = buildDecisionInput({ query });
  const snapshot = createDecisionSnapshot({
    query,
    catalog: input.catalog,
    facts: input.facts,
    blockers: input.blockers,
    relatedNews: input.relatedNews,
    referenceDate,
  });

  if (!snapshot || typeof snapshot !== 'object') {
    throw new DomainError('DecisionSnapshot indisponível', 'DECISION_UNAVAILABLE');
  }

  return snapshot;
}

const SOURCE_STATUS_RANK = new Map([
  ['CONFIRMADO', 0],
  ['NAO_CONFIRMADO', 1],
  ['NAO_AVALIAVEL', 2],
  ['EXPIRADO', 3],
  ['CONFLITANTE', 4],
  ['INDISPONIVEL', 5],
]);

function sourceStatusRank(status) {
  return SOURCE_STATUS_RANK.get(status) ?? 1;
}

function timestampOrNull(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizedSources() {
  const input = buildDecisionInput({});
  const collectedAtByPayload = new Map(
    input.rawPayloads.map((payload) => [payload.raw_payload_id, payload.collected_at]),
  );
  const sources = new Map();

  for (const evidence of input.evidences) {
    const source =
      typeof evidence.source === 'string' && evidence.source.trim() !== ''
        ? evidence.source.trim()
        : null;
    if (!source) continue;

    const status = evidence.confirmation_status ?? 'NAO_CONFIRMADO';
    const payloadCollectedAt = collectedAtByPayload.get(`fixture:${evidence.fixture_file}`);
    let lastCollectedAt = null;
    let lastCollectedTime = null;
    for (const candidate of [evidence.collected_at, payloadCollectedAt]) {
      const timestamp = timestampOrNull(candidate);
      if (timestamp !== null && (lastCollectedTime === null || timestamp > lastCollectedTime)) {
        lastCollectedTime = timestamp;
        lastCollectedAt = candidate;
      }
    }

    let entry = sources.get(source);
    if (!entry) {
      entry = {
        source,
        source_url: null,
        status,
        last_collected_at: null,
        last_collected_time: null,
        evidence_count: 0,
        confirmation_status_counts: {},
      };
      sources.set(source, entry);
    }

    if (
      entry.source_url === null &&
      typeof evidence.source_url === 'string' &&
      evidence.source_url.trim() !== ''
    ) {
      entry.source_url = evidence.source_url;
    }
    if (sourceStatusRank(status) > sourceStatusRank(entry.status)) {
      entry.status = status;
    }
    entry.evidence_count += 1;
    entry.confirmation_status_counts[status] = (entry.confirmation_status_counts[status] ?? 0) + 1;
    if (
      lastCollectedTime !== null &&
      (entry.last_collected_time === null || lastCollectedTime > entry.last_collected_time)
    ) {
      entry.last_collected_time = lastCollectedTime;
      entry.last_collected_at = lastCollectedAt;
    }
  }

  return [...sources.values()]
    .map((entry) => {
      const source = { ...entry };
      delete source.last_collected_time;
      return source;
    })
    .sort((left, right) => left.source.localeCompare(right.source));
}

function newsMatchesRoute(newsItem, routeId, segmentIds) {
  if (!newsItem || typeof newsItem !== 'object') return false;
  if (newsItem.route_id !== undefined) return newsItem.route_id === routeId;
  if (Array.isArray(newsItem.matched_route_ids)) return newsItem.matched_route_ids.includes(routeId);
  if (Array.isArray(newsItem.matched_segments)) {
    return newsItem.matched_segments.some((segmentId) => segmentIds.has(segmentId));
  }
  return false;
}

function normalizedNews(searchParams = new URLSearchParams(), { now = Date.now() } = {}) {
  const input = buildDecisionInput({});
  let noticias = input.relatedNews;

  const rotaId = searchParams.get('rota_id');
  if (rotaId !== null) {
    const route = input.catalog.routes.find((candidate) => candidate.id === rotaId);
    if (!route) {
      throw new HttpError(400, 'INVALID_QUERY', 'rota_id desconhecido');
    }
    const segmentIds = new Set((route.segments ?? []).map((segment) => segment.id));
    noticias = noticias.filter((item) => newsMatchesRoute(item, rotaId, segmentIds));
  }

  const janela = searchParams.get('janela_horas');
  if (janela !== null) {
    if (!/^\d+$/.test(janela) || Number(janela) <= 0) {
      throw new HttpError(400, 'INVALID_QUERY', 'janela_horas inválida');
    }
    const windowMs = Number(janela) * 60 * 60 * 1000;
    noticias = noticias.filter((item) => {
      const timestamp = Date.parse(item.updated_at ?? item.published_at ?? item.collected_at ?? '');
      return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= windowMs;
    });
  }

  return noticias;
}

export function createApiServer(options = {}) {
  const apiKeys =
    options.apiKeys !== undefined ? toKeyList(options.apiKeys) : toKeyList(process.env.IAV_MCP_API_KEYS);
  const rateLimit = createRateLimiter({
    limit: options.rateLimit?.limit ?? DEFAULT_RATE_LIMIT,
    windowMs: options.rateLimit?.windowMs ?? DEFAULT_RATE_WINDOW_MS,
  });
  const viability = options.consultarViabilidade ?? consultarViabilidade;
  const nowProvider = typeof options.now === 'function' ? options.now : () => options.now ?? Date.now();

  async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (!path.startsWith('/v1/')) {
      sendError(response, 404, 'NOT_FOUND', 'Rota não encontrada');
      return;
    }

    const apiKey = authenticate(request, response, apiKeys);
    if (!apiKey) return;

    const verdict = rateLimit(apiKey);
    if (!verdict.allowed) {
      sendJson(
        response,
        429,
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Limite de requisições excedido',
            retry_after_seconds: verdict.retryAfterSeconds,
          },
        },
        { 'retry-after': String(verdict.retryAfterSeconds) },
      );
      return;
    }

    try {
      if (request.method === 'POST' && path === '/v1/viabilidade') {
        const body = await readJsonBody(request);
        const query = assertIavQuery(body);
        sendJson(response, 200, viability(query));
        return;
      }

      if (request.method === 'GET' && path === '/v1/fontes') {
        sendJson(response, 200, { fontes: normalizedSources() });
        return;
      }

      if (request.method === 'GET' && path === '/v1/noticias') {
        sendJson(response, 200, { noticias: normalizedNews(url.searchParams, { now: nowProvider() }) });
        return;
      }

      sendError(response, 404, 'NOT_FOUND', 'Rota não encontrada');
    } catch (error) {
      if (error instanceof HttpError) {
        sendError(response, error.status, error.code, error.message);
        return;
      }
      if (error instanceof ContractValidationError) {
        sendError(response, 400, 'INVALID_QUERY', error.message, { details: error.errors });
        return;
      }
      if (error instanceof DomainError && error.code === 'ROUTE_NOT_FOUND') {
        sendError(response, 404, 'ROUTE_NOT_FOUND', error.message);
        return;
      }
      if (error instanceof DomainError) {
        sendError(response, 503, 'DECISION_UNAVAILABLE', 'DecisionSnapshot indisponível');
        return;
      }
      sendError(response, 500, 'INTERNAL_ERROR', 'Erro interno');
    }
  }

  return http.createServer((request, response) => {
    handle(request, response).catch(() => {
      if (!response.headersSent) {
        sendError(response, 500, 'INTERNAL_ERROR', 'Erro interno');
      } else {
        response.end();
      }
    });
  });
}

export function startApiServer(options = {}) {
  const server = createApiServer(options);
  const port = Number(options.port ?? process.env.API_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  server.listen(port, host);
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startApiServer();
}
