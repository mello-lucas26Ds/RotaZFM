#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDecisionInput } from '@rotazfm/ingestion';
import { createDecisionSnapshot } from '@rotazfm/domain';
import { createApiServer } from '../apps/api/src/server.js';
import { createMcpServer } from '../apps/mcp/src/server.js';
import { createDashboardServer } from '../apps/dashboard/src/server.js';

const REFERENCE_DATE = '2026-11-23';
const API_KEY = 'e2e-api-key';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIOS_PATH = join(ROOT, 'tests/e2e/scenarios.json');
const REPORT_PATH = join(ROOT, 'test-results/e2e-scenarios.json');

const OVERALL_STATUS_ORDER = ['NAO_VIAVEL', 'NAO_AVALIAVEL', 'VIAVEL_COM_RESSALVAS', 'VIAVEL'];

function snapshotFor(query, fixtureDir) {
  const input = buildDecisionInput(fixtureDir ? { query, fixtureDir } : { query });
  return createDecisionSnapshot({
    query,
    catalog: input.catalog,
    facts: input.facts,
    blockers: input.blockers,
    relatedNews: input.relatedNews,
    referenceDate: REFERENCE_DATE,
  });
}

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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: response.status, headers: response.headers, body };
}

function postJson(url, payload, { auth = API_KEY, headers = {} } = {}) {
  return fetchJson(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function fixtureDirFor(scenario) {
  const candidates = [
    join(ROOT, 'tests/e2e/fixtures', scenario.id),
    ...scenario.fixtures.map((fixture) => join(ROOT, 'tests/e2e/fixtures', fixture)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
  }
  return null;
}

function overallDecision(snapshot) {
  const routes = Array.isArray(snapshot?.routes) ? snapshot.routes : [];
  let status = 'VIAVEL';
  for (const candidate of OVERALL_STATUS_ORDER) {
    if (routes.some((route) => route.status === candidate)) {
      status = candidate;
      break;
    }
  }
  const allNumeric = routes.length > 0 && routes.every((route) => Number.isFinite(route.iav));
  return {
    status,
    iav: allNumeric ? Math.min(...routes.map((route) => route.iav)) : null,
  };
}

function blockerCode(blocker) {
  if (blocker.type === 'PBTC') return 'pbtc_exceeded';
  return typeof blocker.type === 'string' ? blocker.type.toLowerCase() : blocker.code ?? null;
}

function compareDecisionSnapshot(scenario, snapshot) {
  const failures = [];
  const overall = overallDecision(snapshot);

  if (overall.status !== scenario.expected_status) {
    failures.push(`status esperado ${scenario.expected_status}, recebido ${overall.status}`);
  }

  if (scenario.expected_null) {
    if (overall.iav !== null) failures.push(`iav esperado null, recebido ${overall.iav}`);
  } else if (overall.iav !== scenario.expected_iav) {
    failures.push(`iav esperado ${scenario.expected_iav}, recebido ${overall.iav}`);
  }

  const actualBlockers = (snapshot.blockers ?? []).map((blocker) => ({
    code: blockerCode(blocker),
    segment_id: blocker.segment_id,
    source: blocker.source ?? null,
  }));
  for (const expected of scenario.expected_blockers ?? []) {
    const found = actualBlockers.some(
      (blocker) =>
        blocker.code === expected.code &&
        blocker.segment_id === expected.segment_id &&
        (expected.source === undefined || blocker.source === expected.source),
    );
    if (!found) failures.push(`blocker ausente: ${JSON.stringify(expected)}`);
  }

  const actualMissing = snapshot.missing_data ?? [];
  for (const expected of scenario.expected_missing_data ?? []) {
    const found = actualMissing.some(
      (missing) =>
        missing.dimension === expected.dimension &&
        missing.segment_id === expected.segment_id &&
        missing.reason === expected.reason,
    );
    if (!found) failures.push(`missing_data ausente: ${JSON.stringify(expected)}`);
  }

  for (const [routeId, expectedRoute] of Object.entries(scenario.expected_route_assessments ?? {})) {
    const actualRoute = (snapshot.routes ?? []).find((route) => route.route_id === routeId);
    if (!actualRoute) {
      failures.push(`rota ausente: ${routeId}`);
      continue;
    }
    if (actualRoute.status !== expectedRoute.status) {
      failures.push(`${routeId}.status esperado ${expectedRoute.status}, recebido ${actualRoute.status}`);
    }
    if (actualRoute.iav !== expectedRoute.iav) {
      failures.push(`${routeId}.iav esperado ${expectedRoute.iav}, recebido ${actualRoute.iav}`);
    }
    if (actualRoute.worst_segment_id !== expectedRoute.worst_segment_id) {
      failures.push(
        `${routeId}.worst_segment_id esperado ${expectedRoute.worst_segment_id}, recebido ${actualRoute.worst_segment_id}`,
      );
    }
  }

  return failures;
}

function compareErrorScenario(scenario, actual) {
  const failures = [];
  if (actual.status !== scenario.expected_http_status) {
    failures.push(`http esperado ${scenario.expected_http_status}, recebido ${actual.status}`);
  }
  const code = actual.body?.error?.code;
  if (code !== scenario.expected_status) {
    failures.push(`error.code esperado ${scenario.expected_status}, recebido ${code ?? 'ausente'}`);
  }
  return failures;
}

function mcpPayload(scenario, id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name: 'consultar_viabilidade',
      arguments: scenario.input,
    },
  };
}

async function runApiScenario(scenario, api) {
  const actual = await postJson(`${api.baseUrl}/v1/viabilidade`, scenario.input);
  if (actual.status === scenario.expected_http_status && actual.status !== 200) {
    return { status: 'executed', failures: compareErrorScenario(scenario, actual), actual };
  }
  if (actual.status !== 200 || !actual.body || typeof actual.body !== 'object') {
    return {
      status: 'executed',
      failures: [`http/body inesperado: ${actual.status} ${JSON.stringify(actual.body)?.slice(0, 200)}`],
      actual,
    };
  }
  return { status: 'executed', failures: compareDecisionSnapshot(scenario, actual.body), actual };
}

async function runMcpScenario(scenario, mcp) {
  if (scenario.id === 'C15') {
    let last = null;
    let firstRejection = null;
    for (let index = 1; index <= 61; index += 1) {
      last = await postJson(`${mcp.baseUrl}/mcp`, mcpPayload(scenario, index));
      if (last.status === 429 && firstRejection === null) firstRejection = { index, ...last };
    }
    const failures = [];
    if (!firstRejection) failures.push('nenhuma resposta 429 após 61 chamadas');
    else if (firstRejection.index !== 61) failures.push(`429 chegou na chamada ${firstRejection.index}, esperado 61`);
    if (last?.status !== 429) failures.push(`última resposta esperada 429, recebida ${last?.status}`);
    if (last?.body?.error?.code !== 'RATE_LIMITED') {
      failures.push(`error.code esperado RATE_LIMITED, recebido ${last?.body?.error?.code ?? 'ausente'}`);
    }
    if (!Number.isFinite(last?.body?.error?.retry_after_seconds)) {
      failures.push('retry_after_seconds ausente');
    }
    return { status: 'executed', failures, actual: last };
  }

  const auth = scenario.id === 'C13' ? null : scenario.id === 'C14' ? 'invalid-key' : API_KEY;
  const actual = await postJson(`${mcp.baseUrl}/mcp`, mcpPayload(scenario), { auth });
  return { status: 'executed', failures: compareErrorScenario(scenario, actual), actual };
}

async function runDashboardScenario(scenario, dashboard) {
  const index = await fetch(`${dashboard.baseUrl}/`);
  const app = await fetch(`${dashboard.baseUrl}/app.js`);
  const failures = [];
  if (index.status !== scenario.expected_http_status) {
    failures.push(`dashboard / esperado ${scenario.expected_http_status}, recebido ${index.status}`);
  }
  if (app.status !== 200) failures.push(`dashboard /app.js esperado 200, recebido ${app.status}`);
  failures.push('EMPTY_STATE exige E2E de browser; runner HTTP só valida assets estáticos');
  return { status: 'executed', failures, actual: { index: index.status, app: app.status } };
}

async function main() {
  const scenarios = JSON.parse(await readFile(SCENARIOS_PATH, 'utf8')).scenarios;
  const apiServers = new Map();
  const closers = [];

  async function getApi(fixtureDir) {
    const key = fixtureDir ?? 'default';
    if (!apiServers.has(key)) {
      const server = createApiServer({
        apiKeys: [API_KEY],
        rateLimit: { limit: 60, windowMs: 60_000 },
        consultarViabilidade: (query) => snapshotFor(query, fixtureDir),
      });
      const running = await listen(server);
      apiServers.set(key, running);
      closers.push(running.close);
    }
    return apiServers.get(key);
  }

  const mcpServer = createMcpServer({
    apiKeys: [API_KEY],
    rateLimit: { limit: 60, windowMs: 60_000 },
    consultarViabilidade: (query) => ({ query, stub: true }),
  });
  const mcp = await listen(mcpServer);
  closers.push(mcp.close);

  const dashboardServer = createDashboardServer({
    apiBaseUrl: 'http://127.0.0.1:1',
    apiKey: API_KEY,
  });
  const dashboard = await listen(dashboardServer);
  closers.push(dashboard.close);

  const results = [];
  try {
    for (const scenario of scenarios) {
      const fixtureDir = fixtureDirFor(scenario);
      const note = scenario.fixtures?.length > 0 && !fixtureDir ? 'fixture_fallback_default' : null;
      let result;
      if (scenario.surface === 'api') {
        result = await runApiScenario(scenario, await getApi(fixtureDir));
      } else if (scenario.surface === 'mcp') {
        result = await runMcpScenario(scenario, mcp);
      } else if (scenario.surface === 'dashboard') {
        result = await runDashboardScenario(scenario, dashboard);
      } else {
        result = { status: 'skipped', failures: [`surface desconhecida: ${scenario.surface}`] };
      }
      results.push({
        id: scenario.id,
        title: scenario.title,
        surface: scenario.surface,
        fixture_dir: fixtureDir,
        note,
        status: result.status,
        failures: result.failures,
      });
      console.log(`${result.failures.length === 0 ? 'PASS' : 'FAIL'} ${scenario.id} ${scenario.title}`);
      for (const failure of result.failures) console.log(`  - ${failure}`);
    }
  } finally {
    await Promise.all(closers.map((close) => close()));
  }

  const failed = results.filter((result) => result.failures.length > 0);
  const passed = results.filter((result) => result.failures.length === 0);
  const report = {
    generated_at: new Date().toISOString(),
    reference_date: REFERENCE_DATE,
    total: results.length,
    passed: passed.length,
    failed: failed.length,
    results,
  };
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nE2E scenarios: ${passed.length}/${results.length} passaram; relatório em test-results/e2e-scenarios.json`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
