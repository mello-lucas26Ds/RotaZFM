#!/usr/bin/env node
import { createApiServer } from '../apps/api/src/server.js';

const API_KEY = 'load-test-key';
const CONCURRENCY = 10;
const QUERY = {
  origem: 'MANAUS',
  destino: 'SAO_PAULO',
  data_embarque: '2026-11-25',
  carga: { tipo: 'SECA', peso_bruto_total_kg: 10000, quantidade_caminhoes: 1 },
};

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

async function postViabilidade(baseUrl) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/v1/viabilidade`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(QUERY),
    });
    const body = await response.json().catch(() => null);
    return {
      ok: response.status === 200 && Array.isArray(body?.routes) && body.routes.length === 2,
      status: response.status,
      duration_ms: Math.round((performance.now() - started) * 100) / 100,
      routes: body?.routes?.length ?? null,
      error: body?.error?.code ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      duration_ms: Math.round((performance.now() - started) * 100) / 100,
      routes: null,
      error: error.message,
    };
  }
}

async function main() {
  const server = createApiServer({ apiKeys: [API_KEY] });
  const api = await listen(server);
  const started = performance.now();
  let results;
  try {
    results = await Promise.all(Array.from({ length: CONCURRENCY }, () => postViabilidade(api.baseUrl)));
  } finally {
    await api.close();
  }
  const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
  const durations = results.map((result) => result.duration_ms).sort((a, b) => a - b);
  const summary = {
    concurrency: CONCURRENCY,
    total: results.length,
    ok: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    elapsed_ms: elapsedMs,
    duration_ms: {
      min: durations[0],
      p50: durations[Math.floor(durations.length / 2)],
      max: durations[durations.length - 1],
    },
    failures: results.filter((result) => !result.ok),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
