import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDashboardServer } from '../src/server.js';

const API_KEY = 'dashboard-test-key';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      server.closeIdleConnections?.();
    },
  };
}

async function startUpstream() {
  const requests = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      if (request.method === 'POST' && request.url === '/v1/viabilidade') {
        if (request.headers.authorization !== `Bearer ${API_KEY}`) {
          response.writeHead(401, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }));
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ routes: [], scope_warning: 'snapshot de teste' }));
        return;
      }

      if (request.method === 'GET' && request.url.startsWith('/v1/fontes')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ fontes: [{ source: 'INMET', status: 'CONFIRMADO', evidence_count: 15, last_collected_at: '2026-11-23T00:00:00.000Z' }] }));
        return;
      }

      if (request.method === 'GET' && request.url.startsWith('/v1/noticias')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ noticias: [] }));
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not found' } }));
    });
  });

  const running = await listen(server);
  return { ...running, requests };
}

async function startDashboard(options = {}) {
  const server = createDashboardServer({ apiBaseUrl: 'http://127.0.0.1:1', apiKey: '', ...options });
  return listen(server);
}

test('dashboard: serve index, css e js estáticos', async () => {
  const dashboard = await startDashboard();
  try {
    const index = await fetch(`${dashboard.baseUrl}/`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    const html = await index.text();
    assert.match(html, /RotaZFM/);
    assert.match(html, /viability-form/);

    const app = await fetch(`${dashboard.baseUrl}/app.js`);
    assert.equal(app.status, 200);
    assert.match(app.headers.get('content-type'), /javascript/);

    const css = await fetch(`${dashboard.baseUrl}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);
  } finally {
    await dashboard.close();
  }
});

test('dashboard: proxy encaminha viabilidade com auth para a API', async () => {
  const upstream = await startUpstream();
  const dashboard = await startDashboard({ apiBaseUrl: upstream.baseUrl, apiKey: API_KEY });
  try {
    const response = await fetch(`${dashboard.baseUrl}/api/v1/viabilidade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origem: 'MANAUS', destino: 'SAO_PAULO' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.scope_warning, 'snapshot de teste');

    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0].method, 'POST');
    assert.equal(upstream.requests[0].url, '/v1/viabilidade');
    assert.equal(upstream.requests[0].authorization, `Bearer ${API_KEY}`);
    assert.match(upstream.requests[0].body, /MANAUS/);
  } finally {
    await dashboard.close();
    await upstream.close();
  }
});

test('dashboard: proxy encaminha fontes e noticias com query string', async () => {
  const upstream = await startUpstream();
  const dashboard = await startDashboard({ apiBaseUrl: upstream.baseUrl, apiKey: API_KEY });
  try {
    const fontes = await fetch(`${dashboard.baseUrl}/api/v1/fontes?limit=1`);
    assert.equal(fontes.status, 200);
    const fontesBody = await fontes.json();
    assert.equal(fontesBody.fontes[0].source, 'INMET');

    const noticias = await fetch(`${dashboard.baseUrl}/api/v1/noticias?rota=rota-1-br-319`);
    assert.equal(noticias.status, 200);
    assert.deepEqual(await noticias.json(), { noticias: [] });

    assert.deepEqual(
      upstream.requests.map((request) => `${request.method} ${request.url}`),
      ['GET /v1/fontes?limit=1', 'GET /v1/noticias?rota=rota-1-br-319'],
    );
  } finally {
    await dashboard.close();
    await upstream.close();
  }
});

test('dashboard: proxy rejeita rota desconhecida e api key ausente', async () => {
  const upstream = await startUpstream();
  const dashboard = await startDashboard({ apiBaseUrl: upstream.baseUrl, apiKey: API_KEY });
  const noKeyDashboard = await startDashboard({ apiBaseUrl: upstream.baseUrl, apiKey: '' });
  try {
    const unknown = await fetch(`${dashboard.baseUrl}/api/v1/unknown`);
    assert.equal(unknown.status, 404);

    const missingKey = await fetch(`${noKeyDashboard.baseUrl}/api/v1/viabilidade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(missingKey.status, 503);
    assert.equal((await missingKey.json()).error.code, 'API_KEY_NOT_CONFIGURED');
  } finally {
    await dashboard.close();
    await noKeyDashboard.close();
    await upstream.close();
  }
});

test('dashboard: DASHBOARD_AUTH_TOKEN protege proxy e assets estáticos ficam públicos', async () => {
  const upstream = await startUpstream();
  const dashboard = await startDashboard({
    apiBaseUrl: upstream.baseUrl,
    apiKey: API_KEY,
    authToken: 'dashboard-token',
  });
  try {
    const index = await fetch(`${dashboard.baseUrl}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /RotaZFM/);

    const app = await fetch(`${dashboard.baseUrl}/app.js`);
    assert.equal(app.status, 200);

    const anonymousApi = await fetch(`${dashboard.baseUrl}/api/v1/fontes`);
    assert.equal(anonymousApi.status, 401);
    assert.equal((await anonymousApi.json()).error.code, 'DASHBOARD_UNAUTHORIZED');
    assert.equal(anonymousApi.headers.get('www-authenticate'), 'Bearer');

    const wrong = await fetch(`${dashboard.baseUrl}/api/v1/fontes`, {
      headers: { authorization: 'Bearer wrong' },
    });
    assert.equal(wrong.status, 401);

    const authorized = await fetch(`${dashboard.baseUrl}/api/v1/fontes`, {
      headers: { authorization: 'Bearer dashboard-token' },
    });
    assert.equal(authorized.status, 200);
    assert.equal((await authorized.json()).fontes[0].source, 'INMET');
    assert.equal(upstream.requests[upstream.requests.length - 1].authorization, `Bearer ${API_KEY}`);
  } finally {
    await dashboard.close();
    await upstream.close();
  }
});
