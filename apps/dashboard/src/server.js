import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_PORT = 3003;
const DEFAULT_API_URL = 'http://127.0.0.1:3001';
const MAX_PROXY_BODY_BYTES = 256 * 1024;
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

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(payload);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];

    request.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_PROXY_BODY_BYTES) {
        tooLarge = true;
        reject(Object.assign(new Error('Corpo da requisição muito grande'), { status: 413, code: 'PAYLOAD_TOO_LARGE' }));
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (tooLarge) return;
      resolve(Buffer.concat(chunks));
    });

    request.on('error', reject);
  });
}

function proxyHeaders(request) {
  const headers = {};
  for (const name of ['authorization', 'content-type', 'accept']) {
    const value = request.headers[name];
    if (typeof value === 'string' && value !== '') headers[name] = value;
  }
  return headers;
}

async function proxyToApi(request, response, url, apiUrl) {
  const target = new URL(`${url.pathname}${url.search}`, apiUrl);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await readRawBody(request) : undefined;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: proxyHeaders(request),
      body,
    });
  } catch {
    sendError(response, 502, 'BAD_GATEWAY', 'API indisponível');
    return;
  }

  const text = await upstream.text();
  response.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  response.end(text);
}

function resolveStaticPath(pathname, publicDir) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    return null;
  }
  const filePath = normalize(join(publicDir, relativePath.replace(/^\/+/, '')));
  return filePath.startsWith(publicDir) ? filePath : null;
}

async function serveStatic(request, response, pathname, publicDir) {
  const filePath = resolveStaticPath(pathname, publicDir);
  if (!filePath) {
    sendError(response, 404, 'NOT_FOUND', 'Arquivo não encontrado');
    return;
  }

  let content;
  try {
    content = await readFile(filePath);
  } catch {
    sendError(response, 404, 'NOT_FOUND', 'Arquivo não encontrado');
    return;
  }

  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'content-length': content.length,
    'cache-control': 'no-store',
  });
  response.end(request.method === 'HEAD' ? undefined : content);
}

export function createDashboardServer(options = {}) {
  const apiUrl = options.apiUrl ?? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
  const publicDir = options.publicDir ?? PUBLIC_DIR;

  async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');

    try {
      if (url.pathname.startsWith('/v1/')) {
        await proxyToApi(request, response, url, apiUrl);
        return;
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido');
        return;
      }

      await serveStatic(request, response, url.pathname, publicDir);
    } catch (error) {
      if (error?.status) {
        sendError(response, error.status, error.code ?? 'ERROR', error.message);
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

export function startDashboardServer(options = {}) {
  const server = createDashboardServer(options);
  const port = Number(options.port ?? process.env.DASHBOARD_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  const host = options.host ?? process.env.DASHBOARD_HOST ?? process.env.HOST ?? '127.0.0.1';
  server.listen(port, host);
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startDashboardServer();
}
