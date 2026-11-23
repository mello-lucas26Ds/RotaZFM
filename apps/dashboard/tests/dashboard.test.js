import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDashboardServer } from '../src/server.js';
import { buildIavQuery, escapeHtml } from '../public/app.js';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function startDashboard(options = {}) {
  const server = createDashboardServer(options);
  const port = await listen(server);
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      server.closeIdleConnections?.();
    },
  };
}

test('dashboard: buildIavQuery monta payload válido e rejeita extras', () => {
  const query = buildIavQuery({
    origem: ' MANAUS ',
    destino: 'SAO_PAULO',
    data_embarque: '2026-11-24',
    tipo: 'seca',
    peso_bruto_total_kg: '10000',
    quantidade_caminhoes: '',
  });
  assert.deepEqual(query, {
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: '2026-11-24',
    carga: { tipo: 'SECA', peso_bruto_total_kg: 10000 },
  });

  assert.throws(() => buildIavQuery({ origem: 'MANAUS', campo_extra: true }), /Campo não permitido/);
  assert.throws(() => buildIavQuery({ destino: 'SAO_PAULO' }), /origem/);
  assert.throws(() => buildIavQuery({
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: '2026-11-24',
    tipo: 'SECA',
    peso_bruto_total_kg: '0',
  }), /Peso bruto/);
  assert.throws(() => buildIavQuery({
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: '2026-11-24',
    tipo: 'OUTRO',
    peso_bruto_total_kg: '1000',
  }), /Tipo de carga/);
});

test('dashboard: escapeHtml escapa caracteres perigosos', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
  );
  assert.equal(escapeHtml("a & b 'c'"), 'a &amp; b &#39;c&#39;');
  assert.equal(escapeHtml(null), '');
});

test('dashboard: servidor estático responde index.html e assets', async () => {
  const dashboard = await startDashboard();
  try {
    const index = await fetch(`${dashboard.baseUrl}/`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type') ?? '', /text\/html/);
    const html = await index.text();
    assert.ok(html.includes('id="viabilidade-form"'));
    assert.ok(html.includes('id="api-key"'));

    const appJs = await fetch(`${dashboard.baseUrl}/app.js`);
    assert.equal(appJs.status, 200);
    assert.match(appJs.headers.get('content-type') ?? '', /text\/javascript/);

    const css = await fetch(`${dashboard.baseUrl}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') ?? '', /text\/css/);
  } finally {
    await dashboard.close();
  }
});

test('dashboard: proxy encaminha método, path, query e Authorization para a API', async () => {
  const seen = [];
  const upstream = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      seen.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body,
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
    });
  });
  const upstreamPort = await listen(upstream);

  const dashboard = await startDashboard({ apiUrl: `http://127.0.0.1:${upstreamPort}` });
  try {
    const post = await fetch(`${dashboard.baseUrl}/v1/viabilidade`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer chave-super-secreta',
      },
      body: JSON.stringify({ origem: 'MANAUS' }),
    });
    assert.equal(post.status, 200);
    assert.deepEqual(await post.json(), { ok: true });

    const get = await fetch(`${dashboard.baseUrl}/v1/noticias?rota_id=rota-1-br-319&janela_horas=24`, {
      headers: { authorization: 'Bearer chave-super-secreta' },
    });
    assert.equal(get.status, 200);

    assert.equal(seen.length, 2);
    assert.equal(seen[0].method, 'POST');
    assert.equal(seen[0].url, '/v1/viabilidade');
    assert.equal(seen[0].authorization, 'Bearer chave-super-secreta');
    assert.match(seen[0].contentType ?? '', /application\/json/);
    assert.equal(seen[0].body, JSON.stringify({ origem: 'MANAUS' }));

    assert.equal(seen[1].method, 'GET');
    assert.equal(seen[1].url, '/v1/noticias?rota_id=rota-1-br-319&janela_horas=24');
    assert.equal(seen[1].authorization, 'Bearer chave-super-secreta');
  } finally {
    await dashboard.close();
    await new Promise((resolve) => upstream.close(resolve));
    upstream.closeIdleConnections?.();
  }
});
