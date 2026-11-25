import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ContractValidationError, assertIavQuery } from '@rotazfm/contracts';
import { DomainError, createDecisionSnapshot, parseIavWeightsJson } from '@rotazfm/domain';
import { buildDecisionInput } from '@rotazfm/ingestion';

const DEFAULT_PORT = 3002;
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_RATE_WINDOW_MS = 60_000;
const PROTOCOL_VERSION = '2025-06-18';
const TOOL_NAME = 'consultar_viabilidade';

const IAV_QUERY_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['origem', 'destino', 'data_embarque', 'carga'],
  properties: {
    origem: { type: 'string', minLength: 1 },
    destino: { type: 'string', minLength: 1 },
    data_embarque: { type: 'string', format: 'date' },
    carga: {
      type: 'object',
      additionalProperties: false,
      required: ['tipo', 'peso_bruto_total_kg'],
      properties: {
        tipo: { type: 'string', enum: ['SECA', 'CONTEINERIZADA'] },
        peso_bruto_total_kg: { type: 'integer', minimum: 1, maximum: 60000 },
        quantidade_caminhoes: { type: 'integer', minimum: 1 },
      },
    },
  },
};

const TOOLS = [
  {
    name: TOOL_NAME,
    description:
      'Avalia a viabilidade de rotas do Polo Industrial de Manaus para uma consulta IavQuery e retorna o DecisionSnapshot determinístico do RotaZFM.',
    inputSchema: IAV_QUERY_INPUT_SCHEMA,
  },
];

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function sendRateLimited(response, verdict) {
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

  function checkMany(key, count, timestamp = now()) {
    let entry = windows.get(key);
    if (!entry || timestamp >= entry.resetAt) {
      entry = { resetAt: timestamp + windowMs, count: 0 };
      windows.set(key, entry);
    }

    if (entry.count + count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000)),
        resetAt: entry.resetAt,
      };
    }

    entry.count += count;
    return { allowed: true, resetAt: entry.resetAt };
  }

  function refund(key, count, timestamp = now()) {
    const entry = windows.get(key);
    if (!entry || timestamp >= entry.resetAt) return;
    entry.count = Math.max(0, entry.count - count);
  }

  function check(key, timestamp) {
    return checkMany(key, 1, timestamp);
  }
  check.checkMany = checkMany;
  check.refund = refund;

  return check;
}

function iavWeightsFromEnv(rawValue) {
  const parsed = parseIavWeightsJson(rawValue);
  if (typeof rawValue === 'string' && rawValue.trim() !== '' && parsed === undefined) {
    console.warn('IAV_WEIGHTS_JSON inválido; usando pesos padrão');
  }
  return parsed;
}

export function consultarViabilidade(query, { referenceDate, iavWeights } = {}) {
  const input = buildDecisionInput({ query });
  const snapshot = createDecisionSnapshot({
    query,
    catalog: input.catalog,
    facts: input.facts,
    blockers: input.blockers,
    relatedNews: input.relatedNews,
    referenceDate,
    iavWeights: iavWeights ?? iavWeightsFromEnv(process.env.IAV_WEIGHTS_JSON),
  });

  if (!snapshot || typeof snapshot !== 'object') {
    throw new DomainError('DecisionSnapshot indisponível', 'DECISION_UNAVAILABLE');
  }

  return snapshot;
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

function hasId(message) {
  return Object.prototype.hasOwnProperty.call(message, 'id');
}

function toolErrorBody(error) {
  if (error instanceof ContractValidationError) {
    return {
      error: {
        code: 'INVALID_QUERY',
        message: error.message,
        ...(error.errors !== undefined ? { details: error.errors } : {}),
      },
    };
  }
  if (error instanceof DomainError && error.code === 'ROUTE_NOT_FOUND') {
    return { error: { code: 'ROUTE_NOT_FOUND', message: error.message } };
  }
  if (error instanceof DomainError) {
    return { error: { code: 'DECISION_UNAVAILABLE', message: 'DecisionSnapshot indisponível' } };
  }
  return { error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } };
}

function handleToolCall(id, params, viability) {
  if (!isPlainObject(params) || params.name !== TOOL_NAME) {
    return rpcError(id, -32602, 'Invalid params');
  }

  const args = isPlainObject(params.arguments) ? params.arguments : {};
  try {
    const query = assertIavQuery(args);
    const snapshot = viability(query);
    return rpcResult(id, {
      content: [{ type: 'text', text: JSON.stringify(snapshot) }],
      structuredContent: snapshot,
    });
  } catch (error) {
    const body = toolErrorBody(error);
    return rpcResult(id, {
      content: [{ type: 'text', text: JSON.stringify(body) }],
      isError: true,
    });
  }
}

function handleMessage(message, viability) {
  if (!isPlainObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(isPlainObject(message) && hasId(message) ? message.id : null, -32600, 'Invalid Request');
  }

  if (!hasId(message) || message.method.startsWith('notifications/')) {
    return null;
  }

  const id = message.id;
  const params = message.params;

  if (message.method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'rotazfm-mcp', version: '0.1.0' },
    });
  }

  if (message.method === 'ping') {
    return rpcResult(id, {});
  }

  if (message.method === 'tools/list') {
    return rpcResult(id, { tools: TOOLS });
  }

  if (message.method === 'tools/call') {
    return handleToolCall(id, params, viability);
  }

  return rpcError(id, -32601, 'Method not found');
}

export function createMcpServer(options = {}) {
  const apiKeys =
    options.apiKeys !== undefined ? toKeyList(options.apiKeys) : toKeyList(process.env.IAV_MCP_API_KEYS);
  const rateLimitNow = options.rateLimit?.now ?? (() => Date.now());
  const rateLimit = createRateLimiter({
    limit: options.rateLimit?.limit ?? DEFAULT_RATE_LIMIT,
    windowMs: options.rateLimit?.windowMs ?? DEFAULT_RATE_WINDOW_MS,
    now: rateLimitNow,
  });
  const viability = options.consultarViabilidade ?? consultarViabilidade;

  async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (path !== '/mcp') {
      sendError(response, 404, 'NOT_FOUND', 'Rota não encontrada');
      return;
    }

    const apiKey = authenticate(request, response, apiKeys);
    if (!apiKey) return;

    if (request.method !== 'POST') {
      sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Apenas POST /mcp é suportado neste MVP');
      return;
    }

    const requestTime = rateLimitNow();
    const initialVerdict = rateLimit(apiKey, requestTime);
    if (!initialVerdict.allowed) {
      sendRateLimited(response, initialVerdict);
      return;
    }

    try {
      const payload = await readJsonBody(request);
      const messages = Array.isArray(payload) ? payload : [payload];
      const additionalCount = Math.max(0, messages.length - 1);
      if (additionalCount > 0) {
        const batchVerdict = rateLimit.checkMany(apiKey, additionalCount, requestTime);
        if (!batchVerdict.allowed) {
          rateLimit.refund(apiKey, 1, requestTime);
          const responseTime = rateLimitNow();
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((batchVerdict.resetAt - responseTime) / 1000),
          );
          sendRateLimited(response, { ...batchVerdict, retryAfterSeconds });
          return;
        }
      }
      const responses = messages
        .map((message) => handleMessage(message, viability))
        .filter((message) => message !== null);

      if (responses.length === 0) {
        response.writeHead(202, { 'cache-control': 'no-store' });
        response.end();
        return;
      }

      sendJson(response, 200, Array.isArray(payload) ? responses : responses[0]);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.code === 'INVALID_JSON') {
          sendJson(response, 400, rpcError(null, -32700, 'Parse error'));
          return;
        }
        sendError(response, error.status, error.code, error.message);
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

export function startMcpServer(options = {}) {
  const server = createMcpServer(options);
  const port = Number(options.port ?? process.env.MCP_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  server.listen(port, host);
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startMcpServer();
}
