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
    const chunks = [];

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição muito grande'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
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

function normalizedSources() {
  return buildDecisionInput({}).evidences;
}

function normalizedNews() {
  return buildDecisionInput({}).relatedNews;
}

export function createApiServer(options = {}) {
  const apiKeys =
    options.apiKeys !== undefined ? toKeyList(options.apiKeys) : toKeyList(process.env.IAV_MCP_API_KEYS);
  const rateLimit = createRateLimiter({
    limit: options.rateLimit?.limit ?? DEFAULT_RATE_LIMIT,
    windowMs: options.rateLimit?.windowMs ?? DEFAULT_RATE_WINDOW_MS,
  });
  const viability = options.consultarViabilidade ?? consultarViabilidade;

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
        sendJson(response, 200, { noticias: normalizedNews() });
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
