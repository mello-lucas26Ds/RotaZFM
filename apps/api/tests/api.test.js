import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from '../src/server.js';

const API_KEY = 'api-test-key';

function tomorrowDateOnly() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function validQuery(overrides = {}) {
  return {
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: tomorrowDateOnly(),
    carga: { tipo: 'SECA', peso_bruto_total_kg: 10000 },
    ...overrides,
  };
}

async function startServer(options = {}) {
  const server = createApiServer({ apiKeys: [API_KEY], ...options });
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

function postViabilidade(baseUrl, body, apiKey = API_KEY) {
  return fetch(`${baseUrl}/v1/viabilidade`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getJson(baseUrl, path, apiKey = API_KEY) {
  return fetch(`${baseUrl}${path}`, {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
  });
}

test('api: POST /v1/viabilidade retorna DecisionSnapshot para query válida', async () => {
  const server = await startServer();
  try {
    const response = await postViabilidade(server.baseUrl, validQuery());
    assert.equal(response.status, 200);

    const snapshot = await response.json();
    assert.equal(typeof snapshot.rule_version, 'string');
    assert.equal(typeof snapshot.scope_warning, 'string');
    assert.equal(snapshot.catalog_version, '2026-11-23');
    assert.equal(snapshot.routes.length, 2);
    assert.ok(Array.isArray(snapshot.missing_data));
    assert.ok(Array.isArray(snapshot.blockers));
    assert.ok(Array.isArray(snapshot.evidences));
    assert.ok(Array.isArray(snapshot.related_news));

    for (const route of snapshot.routes) {
      assert.equal(route.status, 'NAO_AVALIAVEL');
      assert.equal(route.iav, null);
      for (const segment of route.segments) {
        for (const dimension of Object.values(segment.dimensions)) {
          assert.equal(dimension.score, null);
        }
      }
    }
  } finally {
    await server.close();
  }
});

test('api: campo extra na query é rejeitado com 400 INVALID_QUERY', async () => {
  const server = await startServer();
  try {
    const response = await postViabilidade(server.baseUrl, validQuery({ campo_extra: true }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_QUERY');
  } finally {
    await server.close();
  }
});

test('api: sem chave ou com chave inválida retorna 401', async () => {
  const server = await startServer();
  try {
    const withoutKey = await postViabilidade(server.baseUrl, validQuery(), null);
    assert.equal(withoutKey.status, 401);
    assert.equal((await withoutKey.json()).error.code, 'UNAUTHORIZED');

    const invalidKey = await postViabilidade(server.baseUrl, validQuery(), 'wrong-key');
    assert.equal(invalidKey.status, 401);
    assert.equal((await invalidKey.json()).error.code, 'UNAUTHORIZED');
  } finally {
    await server.close();
  }
});

test('api: rate limit retorna 429 com retry_after_seconds após 60 req/min por chave', async () => {
  const server = await startServer();
  try {
    for (let index = 0; index < 60; index += 1) {
      const response = await getJson(server.baseUrl, '/v1/fontes');
      assert.equal(response.status, 200);
    }

    const limited = await getJson(server.baseUrl, '/v1/fontes');
    assert.equal(limited.status, 429);
    const body = await limited.json();
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(typeof body.error.retry_after_seconds, 'number');
    assert.ok(body.error.retry_after_seconds > 0);
  } finally {
    await server.close();
  }
});

test('api: par origem/destino sem rota retorna 404 ROUTE_NOT_FOUND', async () => {
  const server = await startServer();
  try {
    const response = await postViabilidade(
      server.baseUrl,
      validQuery({ destino: 'PORTO_ALEGRE' }),
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'ROUTE_NOT_FOUND');
  } finally {
    await server.close();
  }
});

test('api: GET /v1/fontes e GET /v1/noticias expõem dados normalizados', async () => {
  const server = await startServer();
  try {
    const fontes = await getJson(server.baseUrl, '/v1/fontes');
    assert.equal(fontes.status, 200);
    const fontesBody = await fontes.json();
    assert.ok(Array.isArray(fontesBody.fontes));
    assert.ok(fontesBody.fontes.length > 0);
    assert.ok(
      fontesBody.fontes.every(
        (fonte) =>
          typeof fonte.source === 'string' &&
          fonte.source !== '' &&
          typeof fonte.status === 'string' &&
          typeof fonte.last_collected_at === 'string' &&
          Number.isInteger(fonte.evidence_count) &&
          fonte.evidence_count > 0,
      ),
    );

    const inmet = fontesBody.fontes.find((fonte) => fonte.source.includes('INMET'));
    assert.ok(inmet);
    assert.equal(inmet.status, 'CONFIRMADO');
    assert.equal(inmet.evidence_count, 15);

    const noticias = await getJson(server.baseUrl, '/v1/noticias');
    assert.equal(noticias.status, 200);
    const noticiasBody = await noticias.json();
    assert.ok(Array.isArray(noticiasBody.noticias));
    assert.ok(noticiasBody.noticias.every((item) => item.blocker === false));
  } finally {
    await server.close();
  }
});

test('api: GET /v1/noticias filtra por rota_id e janela_horas', async () => {
  const now = Date.parse('2026-11-20T00:00:00-04:00');
  const server = await startServer({ now });
  try {
    const all = await getJson(server.baseUrl, '/v1/noticias');
    const allBody = await all.json();

    const rota = await getJson(server.baseUrl, '/v1/noticias?rota_id=rota-1-br-319');
    assert.equal(rota.status, 200);
    const rotaBody = await rota.json();
    assert.ok(rotaBody.noticias.length > 0);
    assert.ok(rotaBody.noticias.length < allBody.noticias.length);
    assert.ok(rotaBody.noticias.every((item) => item.route_id === 'rota-1-br-319'));

    const janela = await getJson(server.baseUrl, '/v1/noticias?janela_horas=240');
    assert.equal(janela.status, 200);
    const janelaBody = await janela.json();
    assert.ok(janelaBody.noticias.length < allBody.noticias.length);
    assert.ok(janelaBody.noticias.every((item) => item.blocker === false));

    const invalidRoute = await getJson(server.baseUrl, '/v1/noticias?rota_id=rota-inexistente');
    assert.equal(invalidRoute.status, 400);
    assert.equal((await invalidRoute.json()).error.code, 'INVALID_QUERY');

    const invalidJanela = await getJson(server.baseUrl, '/v1/noticias?janela_horas=abc');
    assert.equal(invalidJanela.status, 400);
    assert.equal((await invalidJanela.json()).error.code, 'INVALID_QUERY');

    const emptyRoute = await getJson(server.baseUrl, '/v1/noticias?rota_id=');
    assert.equal(emptyRoute.status, 400);
    assert.equal((await emptyRoute.json()).error.code, 'INVALID_QUERY');

    const emptyJanela = await getJson(server.baseUrl, '/v1/noticias?janela_horas=');
    assert.equal(emptyJanela.status, 400);
    assert.equal((await emptyJanela.json()).error.code, 'INVALID_QUERY');
  } finally {
    await server.close();
  }
});

test('api: corpo acima de 64 KiB retorna 413 sem derrubar a conexão', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.baseUrl}/v1/viabilidade`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ ...validQuery(), padding: 'x'.repeat(70 * 1024) }),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
  } finally {
    await server.close();
  }
});
