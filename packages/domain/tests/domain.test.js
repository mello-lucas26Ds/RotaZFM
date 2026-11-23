import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IAV_DIMENSIONS,
  RULE_VERSION,
  createDecisionSnapshot,
  loadRouteCatalog,
} from '../src/index.js';

const catalog = loadRouteCatalog();
const REFERENCE_DATE = '2026-11-23';
const DATA_EMBARQUE = '2026-11-25';

function makeQuery({ tipo = 'SECA', peso = 10000 } = {}) {
  return {
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: DATA_EMBARQUE,
    carga: {
      tipo,
      peso_bruto_total_kg: peso,
    },
  };
}

function key(routeId, segmentId, dimension) {
  return `${routeId}:${segmentId}:${dimension}`;
}

function allFacts({ score = 90, overrides = {}, omit = new Set() } = {}) {
  const facts = [];

  for (const route of catalog.routes) {
    for (const segment of route.segments) {
      for (const dimension of IAV_DIMENSIONS) {
        const factKey = key(route.id, segment.id, dimension);
        if (omit.has(factKey)) continue;

        const override = overrides[factKey] ?? {};
        const fact = {
          route_id: route.id,
          segment_id: segment.id,
          dimension,
          score: override.score ?? score,
          confirmation_status: override.confirmation_status ?? 'CONFIRMADO',
          freshness_hours: override.freshness_hours ?? 1,
          source: override.source ?? 'FIXTURE_TEST',
          source_url: override.source_url ?? 'https://example.com/evidence',
          evidence_id: override.evidence_id ?? `ev-${factKey}`,
          last_valid_at: override.last_valid_at ?? '2026-11-23T00:00:00Z',
        };

        if (dimension === 'restricao') {
          fact.pbtc_kg = override.pbtc_kg ?? 20000;
        }

        facts.push(fact);
      }
    }
  }

  return facts;
}

function makeSnapshot({ facts = allFacts(), query = makeQuery(), blockers = [] } = {}) {
  return createDecisionSnapshot({
    query,
    catalog,
    facts,
    blockers,
    referenceDate: REFERENCE_DATE,
  });
}

function routeById(snapshot, routeId) {
  return snapshot.routes.find((route) => route.route_id === routeId);
}

test('C01 domain: consulta válida retorna duas rotas VIAVEL com IAV numérico', () => {
  const snapshot = makeSnapshot({ facts: allFacts({ score: 90 }) });

  assert.equal(snapshot.rule_version, RULE_VERSION);
  assert.equal(snapshot.routes.length, 2);
  assert.deepEqual(snapshot.missing_data, []);
  assert.ok(snapshot.scope_warning.length > 0);

  for (const route of snapshot.routes) {
    assert.equal(route.status, 'VIAVEL');
    assert.equal(route.iav, 90);
    assert.ok(route.worst_segment_id);
    assert.equal(route.segments.length, 7);
  }
});

test('C02 domain: PBTC menor que peso bruto vira NAO_VIAVEL com blocker', () => {
  const facts = allFacts({
    overrides: {
      [key('rota-1-br-319', 'r1-s2-floresta-br319', 'restricao')]: { pbtc_kg: 5000 },
    },
  });

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, 'rota-1-br-319');

  assert.equal(route1.status, 'NAO_VIAVEL');
  assert.equal(route1.worst_segment_id, 'r1-s2-floresta-br319');
  assert.ok(
    route1.blockers.some(
      (blocker) =>
        blocker.type === 'PBTC' &&
        blocker.segment_id === 'r1-s2-floresta-br319' &&
        blocker.weight_kg === 10000 &&
        blocker.pbtc_kg === 5000,
    ),
  );
  assert.equal(routeById(snapshot, 'rota-2-fluvial-brasilia').status, 'VIAVEL');
});

test('C03 domain: dimensão obrigatória ausente vira NAO_AVALIAVEL sem IAV', () => {
  const omit = new Set([key('rota-1-br-319', 'r1-s2-floresta-br319', 'nivel')]);
  const snapshot = makeSnapshot({ facts: allFacts({ omit }) });
  const route1 = routeById(snapshot, 'rota-1-br-319');

  assert.equal(route1.status, 'NAO_AVALIAVEL');
  assert.equal(route1.iav, null);
  assert.ok(
    route1.missing_data.some(
      (missing) =>
        missing.segment_id === 'r1-s2-floresta-br319' &&
        missing.dimension === 'nivel' &&
        missing.reason === 'AUSENTE',
    ),
  );
  assert.equal(routeById(snapshot, 'rota-2-fluvial-brasilia').status, 'VIAVEL');
});

test('C05 domain: fontes oficiais conflitantes viram CONFLITANTE e NAO_AVALIAVEL', () => {
  const conflictKey = key('rota-1-br-319', 'r1-s2-floresta-br319', 'chuva');
  const facts = allFacts().filter((fact) => fact.evidence_id !== `ev-${conflictKey}`);
  facts.push(
    {
      route_id: 'rota-1-br-319',
      segment_id: 'r1-s2-floresta-br319',
      dimension: 'chuva',
      score: 40,
      confirmation_status: 'CONFIRMADO',
      freshness_hours: 1,
      source: 'FONTE_OFICIAL_A',
      source_url: 'https://example.com/a',
      evidence_id: 'ev-conflito-a',
    },
    {
      route_id: 'rota-1-br-319',
      segment_id: 'r1-s2-floresta-br319',
      dimension: 'chuva',
      score: 95,
      confirmation_status: 'CONFIRMADO',
      freshness_hours: 2,
      source: 'FONTE_OFICIAL_B',
      source_url: 'https://example.com/b',
      evidence_id: 'ev-conflito-b',
    },
  );

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, 'rota-1-br-319');

  assert.equal(route1.status, 'NAO_AVALIAVEL');
  assert.equal(route1.iav, null);
  assert.ok(
    route1.missing_data.some(
      (missing) =>
        missing.segment_id === 'r1-s2-floresta-br319' &&
        missing.dimension === 'chuva' &&
        missing.reason === 'CONFLITANTE',
    ),
  );

  const segment = route1.segments.find((item) => item.segment_id === 'r1-s2-floresta-br319');
  assert.ok(
    segment.evidences.some(
      (evidence) => evidence.evidence_id === 'ev-conflito-a' && evidence.source === 'FONTE_OFICIAL_A',
    ),
  );
  assert.ok(
    segment.evidences.some(
      (evidence) => evidence.evidence_id === 'ev-conflito-b' && evidence.source === 'FONTE_OFICIAL_B',
    ),
  );
});

test('C16 domain: mesma entrada e rule_version produzem DecisionSnapshot idêntico', () => {
  const facts = allFacts({ score: 80 });
  const first = makeSnapshot({ facts });
  const second = makeSnapshot({ facts });
  const reversedFacts = makeSnapshot({ facts: [...facts].reverse() });

  assert.deepEqual(first, second);
  assert.deepEqual(first, reversedFacts);
});

test('C17 domain: BR-319 crítica com chuva forte e via precária fica NAO_VIAVEL', () => {
  const segmentId = 'r1-s2-floresta-br319';
  const routeId = 'rota-1-br-319';
  const facts = allFacts({
    overrides: {
      [key(routeId, segmentId, 'nivel')]: { score: 80 },
      [key(routeId, segmentId, 'chuva')]: { score: 10 },
      [key(routeId, segmentId, 'trafego')]: { score: 50 },
      [key(routeId, segmentId, 'qualidade')]: { score: 10 },
      [key(routeId, segmentId, 'restricao')]: { score: 100 },
    },
  });

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, routeId);
  const segment = route1.segments.find((item) => item.segment_id === segmentId);

  assert.equal(route1.status, 'NAO_VIAVEL');
  assert.equal(route1.iav, 48);
  assert.equal(route1.worst_segment_id, segmentId);
  assert.equal(segment.status, 'NAO_VIAVEL');
  assert.equal(segment.iav, 48);
});

test('C18 domain: nível do rio fora da faixa derruba trecho fluvial da rota 2', () => {
  const segmentId = 'r2-s1-fluvial-amazonas';
  const routeId = 'rota-2-fluvial-brasilia';
  const facts = allFacts({
    overrides: {
      [key(routeId, segmentId, 'nivel')]: { score: 0 },
      [key(routeId, segmentId, 'chuva')]: { score: 20 },
      [key(routeId, segmentId, 'trafego')]: { score: 50 },
      [key(routeId, segmentId, 'qualidade')]: { score: 80 },
      [key(routeId, segmentId, 'restricao')]: { score: 100 },
    },
  });

  const snapshot = makeSnapshot({ facts });
  const route2 = routeById(snapshot, routeId);

  assert.equal(route2.status, 'NAO_VIAVEL');
  assert.equal(route2.iav, 37);
  assert.equal(route2.worst_segment_id, segmentId);
  assert.equal(routeById(snapshot, 'rota-1-br-319').status, 'VIAVEL');
});

test('C19 domain: CONTEINERIZADA no limite do PBTC não muda decisão; PBTC menor bloqueia', () => {
  const facts = allFacts({
    overrides: Object.fromEntries(
      catalog.routes.flatMap((route) =>
        route.segments.map((segment) => [
          key(route.id, segment.id, 'restricao'),
          { pbtc_kg: 16000 },
        ]),
      ),
    ),
  });

  const containerizada = makeSnapshot({
    facts,
    query: makeQuery({ tipo: 'CONTEINERIZADA', peso: 16000 }),
  });
  const seca = makeSnapshot({
    facts,
    query: makeQuery({ tipo: 'SECA', peso: 16000 }),
  });

  assert.equal(containerizada.blockers.length, 0);
  assert.deepEqual(containerizada.routes, seca.routes);
  assert.ok(containerizada.routes.every((route) => route.status === 'VIAVEL'));

  const belowLimitFacts = allFacts({
    overrides: {
      [key('rota-1-br-319', 'r1-s2-floresta-br319', 'restricao')]: { pbtc_kg: 15999 },
    },
  });
  const belowLimit = makeSnapshot({ facts: belowLimitFacts, query: makeQuery({ peso: 16000 }) });

  assert.equal(routeById(belowLimit, 'rota-1-br-319').status, 'NAO_VIAVEL');
});

test('domain: dimensão com freshness_hours > 24 vira NAO_AVALIAVEL', () => {
  const facts = allFacts({
    overrides: {
      [key('rota-1-br-319', 'r1-s2-floresta-br319', 'nivel')]: { freshness_hours: 25 },
    },
  });

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, 'rota-1-br-319');

  assert.equal(route1.status, 'NAO_AVALIAVEL');
  assert.equal(route1.iav, null);
  assert.ok(
    route1.missing_data.some(
      (missing) =>
        missing.segment_id === 'r1-s2-floresta-br319' &&
        missing.dimension === 'nivel' &&
        missing.reason === 'DESATUALIZADO',
    ),
  );
});

test('domain: bloqueador explícito só vale quando confirmado', () => {
  const segmentId = 'r1-s2-floresta-br319';
  const routeId = 'rota-1-br-319';
  const unconfirmed = makeSnapshot({
    blockers: [
      {
        route_id: routeId,
        segment_id: segmentId,
        type: 'INTERDICAO',
        confirmed: false,
        description: 'Boato sem confirmação oficial',
      },
    ],
  });

  assert.equal(routeById(unconfirmed, routeId).status, 'VIAVEL');
  assert.equal(unconfirmed.blockers.length, 0);

  const confirmed = makeSnapshot({
    blockers: [
      {
        route_id: routeId,
        segment_id: segmentId,
        type: 'INTERDICAO',
        confirmed: true,
        description: 'Interdição confirmada por fonte oficial',
        source: 'DNIT',
        source_url: 'https://example.com/interdicao',
      },
    ],
  });

  const route1 = routeById(confirmed, routeId);
  assert.equal(route1.status, 'NAO_VIAVEL');
  assert.equal(route1.worst_segment_id, segmentId);
  assert.ok(route1.blockers.some((blocker) => blocker.type === 'INTERDICAO'));
});

test('domain: bloqueador confirmado expirado antes do embarque não bloqueia', () => {
  const segmentId = 'r1-s2-floresta-br319';
  const routeId = 'rota-1-br-319';
  const baseBlocker = {
    route_id: routeId,
    segment_id: segmentId,
    type: 'INTERDICAO',
    confirmed: true,
    description: 'Interdição temporária',
    source: 'DNIT',
    effective_from: '2026-11-20',
  };

  const expired = makeSnapshot({
    blockers: [{ ...baseBlocker, effective_until: '2026-11-24' }],
  });

  assert.equal(routeById(expired, routeId).status, 'VIAVEL');
  assert.equal(expired.blockers.length, 0);

  const active = makeSnapshot({
    blockers: [{ ...baseBlocker, effective_until: '2026-11-25' }],
  });

  assert.equal(routeById(active, routeId).status, 'NAO_VIAVEL');
  assert.ok(active.blockers.some((blocker) => blocker.type === 'INTERDICAO'));
});

test('domain: limiar de status usa IAV sem arredondamento intermediário', () => {
  const segmentId = 'r1-s2-floresta-br319';
  const routeId = 'rota-1-br-319';
  const facts = allFacts({
    overrides: {
      [key(routeId, segmentId, 'nivel')]: { score: 70 },
      [key(routeId, segmentId, 'chuva')]: { score: 70 },
      [key(routeId, segmentId, 'trafego')]: { score: 70 },
      [key(routeId, segmentId, 'qualidade')]: { score: 69.98 },
      [key(routeId, segmentId, 'restricao')]: { score: 70 },
    },
  });

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, routeId);
  const segment = route1.segments.find((item) => item.segment_id === segmentId);

  assert.equal(segment.status, 'VIAVEL_COM_RESSALVAS');
  assert.ok(segment.iav < 70);
  assert.equal(route1.status, 'VIAVEL_COM_RESSALVAS');
  assert.ok(route1.iav < 70);
});

test('domain: evidência preserva effective_from e effective_until', () => {
  const routeId = 'rota-1-br-319';
  const segmentId = 'r1-s2-floresta-br319';
  const facts = allFacts();
  const fact = facts.find(
    (item) =>
      item.route_id === routeId &&
      item.segment_id === segmentId &&
      item.dimension === 'restricao',
  );
  fact.effective_from = '2026-11-01';
  fact.effective_until = '2026-11-30';

  const snapshot = makeSnapshot({ facts });
  const segment = routeById(snapshot, routeId).segments.find((item) => item.segment_id === segmentId);
  const evidence = segment.evidences.find((item) => item.evidence_id === fact.evidence_id);

  assert.equal(evidence.effective_from, '2026-11-01');
  assert.equal(evidence.effective_until, '2026-11-30');
});
