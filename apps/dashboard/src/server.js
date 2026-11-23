import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_PORT = 3002;
const DEFAULT_API_URL = 'http://127.0.0.1:3001';
const MAX_PROXY_BODY_BYTES = 64 * 1024;
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const PROXY_ROUTES = new Map([
  ['POST /v1/viabilidade', 'POST'],
  ['GET /v1/fontes', 'GET'],
  ['GET /v1/noticias', 'GET'],
]);

function sendJson(response, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  response.end(payload);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function firstApiKey(value) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === 'string' && item.trim() !== '')?.trim() ?? null;
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).find(Boolean) ?? null;
  }
  return null;
}

async function readProxyBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_PROXY_BODY_BYTES) {
      const error = new Error('Payload muito grande');
      error.status = 413;
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function proxyApi({ apiBaseUrl, apiKey, request, response, path, search }) {
  if (!apiKey) {
    sendError(response, 503, 'API_KEY_NOT_CONFIGURED', 'Chave da API não configurada no dashboard');
    return;
  }

  const expectedMethod = PROXY_ROUTES.get(`${request.method} ${path}`);
  if (!expectedMethod) {
    sendError(response, 404, 'NOT_FOUND', 'Rota de proxy não encontrada');
    return;
  }

  let body;
  if (expectedMethod === 'POST') {
    try {
      body = await readProxyBody(request);
    } catch (error) {
      sendError(response, error.status ?? 400, error.code ?? 'INVALID_BODY', error.message);
      return;
    }
  }

  const target = `${apiBaseUrl}${path}${expectedMethod === 'GET' ? search : ''}`;
  let upstream;
  try {
    upstream = await fetch(target, {
      method: expectedMethod,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(expectedMethod === 'POST'
          ? { 'content-type': request.headers['content-type'] ?? 'application/json' }
          : {}),
      },
      body: expectedMethod === 'POST' ? body : undefined,
    });
  } catch {
    sendError(response, 503, 'API_UNAVAILABLE', 'API indisponível');
    return;
  }

  const text = await upstream.text();
  response.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(text);
}

async function serveStatic(request, response, pathname) {
  if (request.method !== 'GET') {
    sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Apenas GET é suportado para arquivos estáticos');
    return;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = normalize(join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(response, 404, 'NOT_FOUND', 'Arquivo não encontrado');
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': content.length,
    });
    response.end(content);
  } catch {
    sendError(response, 404, 'NOT_FOUND', 'Arquivo não encontrado');
  }
}

async function handle(request, response, config) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (path.startsWith('/api/')) {
    const apiPath = path.replace(/^\/api/, '');
    await proxyApi({
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      request,
      response,
      path: apiPath,
      search: url.search,
    });
    return;
  }

  await serveStatic(request, response, path);
}

export function createDashboardServer(options = {}) {
  const apiBaseUrl = (options.apiBaseUrl ?? process.env.ROTAZFM_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');
  const apiKey = options.apiKey !== undefined ? options.apiKey : firstApiKey(process.env.IAV_MCP_API_KEYS);
  const config = { apiBaseUrl, apiKey };

  return http.createServer((request, response) => {
    handle(request, response, config).catch(() => {
      if (!response.headersSent) {
        sendError(response, 500, 'INTERNAL_ERROR', 'Erro interno');
      } else {
        response.end();
      }
    });
  });
}

export function startDashboardServer(options = {}) {
  const server = createDashboardServer(options);
  const port = Number(options.port ?? process.env.DASHBOARD_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  server.listen(port, host);
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startDashboardServer();
}
