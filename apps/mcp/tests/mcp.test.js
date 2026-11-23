import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpServer } from '../src/server.js';

const API_KEY = 'mcp-test-key';

function tomorrowDateOnly() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function validArguments(overrides = {}) {
  return {
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: tomorrowDateOnly(),
    carga: { tipo: 'SECA', peso_bruto_total_kg: 10000 },
    ...overrides,
  };
}

async function startServer(options = {}) {
  const server = createMcpServer({ apiKeys: [API_KEY], ...options });
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

function rpc(baseUrl, method, params, { apiKey = API_KEY, id = 1 } = {}) {
  return fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

test('mcp: initialize e tools/list expõem consultar_viabilidade', async () => {
  const server = await startServer();
  try {
    const initialized = await rpc(server.baseUrl, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.0.0' },
    });
    assert.equal(initialized.status, 200);
    const initBody = await initialized.json();
    assert.equal(initBody.result.serverInfo.name, 'rotazfm-mcp');
    assert.ok(initBody.result.capabilities.tools);

    const listed = await rpc(server.baseUrl, 'tools/list', {}, { id: 2 });
    assert.equal(listed.status, 200);
    const listBody = await listed.json();
    assert.equal(listBody.result.tools.length, 1);
    assert.equal(listBody.result.tools[0].name, 'consultar_viabilidade');
    assert.equal(listBody.result.tools[0].inputSchema.type, 'object');
  } finally {
    await server.close();
  }
});

test('mcp: tools/call consultar_viabilidade retorna o mesmo contrato da API', async () => {
  const server = await startServer();
  try {
    const response = await rpc(server.baseUrl, 'tools/call', {
      name: 'consultar_viabilidade',
      arguments: validArguments(),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.isError, undefined);

    const snapshot = body.result.structuredContent;
    assert.equal(typeof snapshot.rule_version, 'string');
    assert.equal(typeof snapshot.scope_warning, 'string');
    assert.ok(Array.isArray(snapshot.routes));
    assert.ok(Array.isArray(snapshot.missing_data));
    assert.ok(Array.isArray(snapshot.blockers));
    assert.ok(Array.isArray(snapshot.evidences));
    assert.ok(Array.isArray(snapshot.related_news));

    const parsedText = JSON.parse(body.result.content[0].text);
    assert.equal(parsedText.rule_version, snapshot.rule_version);
  } finally {
    await server.close();
  }
});

test('mcp: query inválida vira erro de ferramenta sem score inventado', async () => {
  const server = await startServer();
  try {
    const response = await rpc(server.baseUrl, 'tools/call', {
      name: 'consultar_viabilidade',
      arguments: validArguments({ campo_extra: true }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.isError, true);
    const errorBody = JSON.parse(body.result.content[0].text);
    assert.equal(errorBody.error.code, 'INVALID_QUERY');
  } finally {
    await server.close();
  }
});

test('mcp: sem chave ou com chave inválida retorna 401', async () => {
  const server = await startServer();
  try {
    const withoutKey = await rpc(server.baseUrl, 'tools/list', {}, { apiKey: null, id: 10 });
    assert.equal(withoutKey.status, 401);

    const invalidKey = await rpc(server.baseUrl, 'tools/list', {}, { apiKey: 'wrong-key', id: 11 });
    assert.equal(invalidKey.status, 401);
  } finally {
    await server.close();
  }
});

test('mcp: rate limit retorna 429 após 60 req/min por chave', async () => {
  const server = await startServer();
  try {
    for (let index = 0; index < 60; index += 1) {
      const response = await rpc(server.baseUrl, 'tools/list', {}, { id: index + 1 });
      assert.equal(response.status, 200);
    }

    const limited = await rpc(server.baseUrl, 'tools/list', {}, { id: 100 });
    assert.equal(limited.status, 429);
    const body = await limited.json();
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.ok(body.error.retry_after_seconds > 0);
  } finally {
    await server.close();
  }
});

test('mcp: par origem/destino sem rota vira erro de ferramenta ROUTE_NOT_FOUND', async () => {
  const server = await startServer();
  try {
    const response = await rpc(server.baseUrl, 'tools/call', {
      name: 'consultar_viabilidade',
      arguments: validArguments({ destino: 'PORTO_ALEGRE' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.isError, true);
    const errorBody = JSON.parse(body.result.content[0].text);
    assert.equal(errorBody.error.code, 'ROUTE_NOT_FOUND');
  } finally {
    await server.close();
  }
});

test('mcp: initialize responde a versão suportada quando o cliente pede outra', async () => {
  const server = await startServer();
  try {
    const response = await rpc(server.baseUrl, 'initialize', {
      protocolVersion: '1999-01-01',
      capabilities: {},
      clientInfo: { name: 'old-client', version: '0.0.0' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.protocolVersion, '2025-06-18');
  } finally {
    await server.close();
  }
});

test('mcp: batch consome uma cota de rate limit por mensagem JSON-RPC', async () => {
  const server = await startServer({ rateLimit: { limit: 2, windowMs: 60_000 } });
  try {
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    ];
    const ok = await fetch(`${server.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(batch),
    });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).length, 2);

    const limited = await rpc(server.baseUrl, 'tools/list', {}, { id: 3 });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
  } finally {
    await server.close();
  }
});

test('mcp: batch rejeitado por cota não consome saldo', async () => {
  const server = await startServer({ rateLimit: { limit: 2, windowMs: 60_000 } });
  try {
    const first = await rpc(server.baseUrl, 'tools/list', {}, { id: 1 });
    assert.equal(first.status, 200);

    const batch = await fetch(`${server.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} },
      ]),
    });
    assert.equal(batch.status, 429);
    assert.equal((await batch.json()).error.code, 'RATE_LIMITED');

    const second = await rpc(server.baseUrl, 'tools/list', {}, { id: 4 });
    assert.equal(second.status, 200);

    const third = await rpc(server.baseUrl, 'tools/list', {}, { id: 5 });
    assert.equal(third.status, 429);
  } finally {
    await server.close();
  }
});

test('mcp: corpo acima de 64 KiB retorna 413 sem derrubar a conexão', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      body: 'x'.repeat(70 * 1024),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
  } finally {
    await server.close();
  }
});
