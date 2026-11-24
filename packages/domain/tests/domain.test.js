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

function makeSnapshot({ facts = allFacts(), query = makeQuery(), blockers = [], options = {} } = {}) {
  return createDecisionSnapshot({
    query,
    catalog,
    facts,
    blockers,
    referenceDate: REFERENCE_DATE,
    ...options,
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
  const omit = new Set([key('rota-1-br-319', 'r1-s2-floresta-br319', 'chuva')]);
  const snapshot = makeSnapshot({ facts: allFacts({ omit }) });
  const route1 = routeById(snapshot, 'rota-1-br-319');

  assert.equal(route1.status, 'NAO_AVALIAVEL');
  assert.equal(route1.iav, null);
  assert.ok(
    route1.missing_data.some(
      (missing) =>
        missing.segment_id === 'r1-s2-floresta-br319' &&
        missing.dimension === 'chuva' &&
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
  assert.equal(route1.iav, segment.iav);
  assert.equal(route1.worst_segment_id, segmentId);
  assert.equal(segment.status, 'NAO_VIAVEL');
  assert.ok(segment.iav < 50);
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

test('domain: ajuste chuva-nivel atualiza score usado e weighted_score em multimodal', () => {
  const routeId = 'rota-1-br-319';
  const segmentId = 'r1-s1-balsa-inicial';
  const facts = allFacts({
    score: 90,
    overrides: {
      [key(routeId, segmentId, 'chuva')]: { score: 10 },
    },
  });

  const snapshot = makeSnapshot({ facts });
  const segment = routeById(snapshot, routeId).segments.find((item) => item.segment_id === segmentId);
  const nivel = segment.dimensions.nivel;

  assert.equal(segment.mode, 'multimodal');
  assert.equal(nivel.score, 90);
  assert.equal(nivel.score_used, 86);
  assert.equal(nivel.weighted_score, 25.8);
  assert.equal(nivel.hydro_adjustment, -4);
});

test('domain: ajuste chuva-nivel não arredonda nível quando não há penalidade', () => {
  const routeId = 'rota-1-br-319';
  const segmentId = 'r1-s1-balsa-inicial';
  const facts = allFacts({
    overrides: Object.fromEntries(
      IAV_DIMENSIONS.map((dimension) => [
        key(routeId, segmentId, dimension),
        { score: dimension === 'nivel' ? 69.9999999231 : 70 },
      ]),
    ),
  });

  const snapshot = makeSnapshot({ facts });
  const segment = routeById(snapshot, routeId).segments.find((item) => item.segment_id === segmentId);

  assert.equal(segment.mode, 'multimodal');
  assert.equal(segment.status, 'VIAVEL_COM_RESSALVAS');
  assert.ok(segment.iav < 70);
  assert.equal(segment.dimensions.nivel.score_used, 69.9999999231);
  assert.equal(segment.dimensions.nivel.hydro_adjustment, 0);
});

test('domain: breakdown rodoviário reflete pesos renormalizados do IAV', () => {
  const routeId = 'rota-1-br-319';
  const segmentId = 'r1-s2-floresta-br319';
  const snapshot = makeSnapshot({ facts: allFacts({ score: 90 }) });
  const segment = routeById(snapshot, routeId).segments.find((item) => item.segment_id === segmentId);

  assert.equal(segment.mode, 'rodoviario');
  assert.equal(segment.dimensions.nivel.status, 'NAO_APLICAVEL');
  assert.equal(segment.iav, 90);

  const contribution = ['chuva', 'trafego', 'qualidade', 'restricao'].reduce(
    (total, dimension) => total + segment.dimensions[dimension].weighted_score,
    0,
  );
  assert.ok(Math.abs(contribution - segment.iav) < 0.001);
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
      [key('rota-1-br-319', 'r1-s2-floresta-br319', 'chuva')]: { freshness_hours: 25 },
    },
  });

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, 'rota-1-br-319');
  const segment = route1.segments.find((item) => item.segment_id === 'r1-s2-floresta-br319');

  assert.equal(route1.status, 'NAO_AVALIAVEL');
  assert.equal(route1.iav, null);
  assert.ok(
    route1.missing_data.some(
      (missing) =>
        missing.segment_id === 'r1-s2-floresta-br319' &&
        missing.dimension === 'chuva' &&
        missing.reason === 'DESATUALIZADO',
    ),
  );

  const staleEvidence = segment.evidences.find(
    (evidence) => evidence.dimension === 'chuva' && evidence.freshness_hours === 25,
  );
  assert.ok(staleEvidence);
  assert.equal(staleEvidence.last_valid_at, '2026-11-23T00:00:00Z');
});

test('domain: evidência fora da vigência do embarque não sustenta score nem bloqueio', () => {
  const routeId = 'rota-1-br-319';
  const segmentId = 'r1-s2-floresta-br319';
  const restrictionKey = key(routeId, segmentId, 'restricao');

  const expiredFacts = allFacts({
    overrides: { [restrictionKey]: { pbtc_kg: 5000 } },
  });
  const expiredFact = expiredFacts.find(
    (fact) => fact.route_id === routeId && fact.segment_id === segmentId && fact.dimension === 'restricao',
  );
  expiredFact.effective_from = '2026-11-20';
  expiredFact.effective_until = '2026-11-24';

  const expired = makeSnapshot({ facts: expiredFacts });
  const expiredRoute = routeById(expired, routeId);
  assert.equal(expiredRoute.status, 'NAO_AVALIAVEL');
  assert.equal(expired.blockers.length, 0);
  assert.ok(
    expiredRoute.missing_data.some(
      (missing) =>
        missing.segment_id === segmentId &&
        missing.dimension === 'restricao' &&
        missing.reason === 'FORA_DE_VIGENCIA',
    ),
  );

  const expiredSegment = expiredRoute.segments.find((item) => item.segment_id === segmentId);
  const expiredEvidence = expiredSegment.evidences.find(
    (evidence) => evidence.evidence_id === expiredFact.evidence_id,
  );
  assert.ok(expiredEvidence);
  assert.equal(expiredEvidence.effective_until, '2026-11-24');
  assert.equal(expiredEvidence.last_valid_at, '2026-11-23T00:00:00Z');

  const futureFacts = allFacts({
    overrides: { [restrictionKey]: { pbtc_kg: 5000 } },
  });
  const futureFact = futureFacts.find(
    (fact) => fact.route_id === routeId && fact.segment_id === segmentId && fact.dimension === 'restricao',
  );
  futureFact.effective_from = '2026-11-26';

  const future = makeSnapshot({ facts: futureFacts });
  assert.equal(routeById(future, routeId).status, 'NAO_AVALIAVEL');
  assert.equal(future.blockers.length, 0);
});

test('domain: par origem/destino sem rota no catálogo retorna ROUTE_NOT_FOUND', () => {
  assert.throws(
    () => makeSnapshot({ query: { ...makeQuery(), origem: 'BELEM' } }),
    (error) => error?.code === 'ROUTE_NOT_FOUND',
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

test('domain: bloqueador confirmado que começa depois do embarque não bloqueia', () => {
  const segmentId = 'r1-s2-floresta-br319';
  const routeId = 'rota-1-br-319';
  const baseBlocker = {
    route_id: routeId,
    segment_id: segmentId,
    type: 'INTERDICAO',
    confirmed: true,
    description: 'Interdição futura confirmada',
    source: 'DNIT',
    effective_from: '2026-11-26',
  };

  const future = makeSnapshot({ blockers: [baseBlocker] });
  assert.equal(routeById(future, routeId).status, 'VIAVEL');
  assert.equal(future.blockers.length, 0);

  const current = makeSnapshot({
    blockers: [{ ...baseBlocker, effective_from: '2026-11-25' }],
  });
  assert.equal(routeById(current, routeId).status, 'NAO_VIAVEL');
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

test('domain: limiares exatos de IAV não caem por erro de ponto flutuante', () => {
  const routeId = 'rota-1-br-319';
  const exact70Segment = 'r1-s2-floresta-br319';
  const exact50Segment = 'r1-s3-rondonia-br364';
  const scores70 = [0, 70, 70, 70, 70];
  const scores50 = [0, 50, 50, 50, 50];
  const facts = allFacts({
    overrides: Object.fromEntries(
      IAV_DIMENSIONS.flatMap((dimension, index) => [
        [key(routeId, exact70Segment, dimension), { score: scores70[index] }],
        [key(routeId, exact50Segment, dimension), { score: scores50[index] }],
      ]),
    ),
  });

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, routeId);
  const segment70 = route1.segments.find((item) => item.segment_id === exact70Segment);
  const segment50 = route1.segments.find((item) => item.segment_id === exact50Segment);

  assert.equal(segment70.status, 'VIAVEL');
  assert.equal(segment70.iav, 70);
  assert.equal(segment50.status, 'VIAVEL_COM_RESSALVAS');
  assert.equal(segment50.iav, 50);
});

test('domain: bloqueador com data de expiração inválida é rejeitado', () => {
  assert.throws(
    () =>
      makeSnapshot({
        blockers: [
          {
            route_id: 'rota-1-br-319',
            segment_id: 'r1-s2-floresta-br319',
            type: 'INTERDICAO',
            confirmed: true,
            effective_until: '2026-11-24T25:99:99Z',
          },
        ],
      }),
    (error) => error?.code === 'INVALID_BLOCKER',
  );
});

test('domain: bloqueador aceita timestamp ISO com espaço', () => {
  const segmentId = 'r1-s2-floresta-br319';
  const routeId = 'rota-1-br-319';
  const baseBlocker = {
    route_id: routeId,
    segment_id: segmentId,
    type: 'INTERDICAO',
    confirmed: true,
    description: 'Interdição temporária',
    source: 'DNIT',
  };

  const expired = makeSnapshot({
    blockers: [{ ...baseBlocker, effective_until: '2026-11-24 23:59:59Z' }],
  });
  assert.equal(routeById(expired, routeId).status, 'VIAVEL');

  const active = makeSnapshot({
    blockers: [{ ...baseBlocker, effective_until: '2026-11-25 00:00:00Z' }],
  });
  assert.equal(routeById(active, routeId).status, 'NAO_VIAVEL');
});

test('domain: score abaixo do limiar não sobe por arredondamento', () => {
  const routeId = 'rota-1-br-319';
  const below70Segment = 'r1-s2-floresta-br319';
  const below50Segment = 'r1-s3-rondonia-br364';
  const scores70 = [70.0000000076, 69.9999999231, 70.0000000522, 70.0000000394, 70.0000000059];
  const scores50 = [50.0000000261, 49.9999999391, 50.0000000067, 50.0000000589, 49.9999999717];

  const below70 = makeSnapshot({
    facts: allFacts({
      overrides: Object.fromEntries(
        IAV_DIMENSIONS.map((dimension, index) => [
          key(routeId, below70Segment, dimension),
          { score: scores70[index] },
        ]),
      ),
    }),
  });
  const route70 = routeById(below70, routeId);
  const segment70 = route70.segments.find((item) => item.segment_id === below70Segment);
  assert.equal(segment70.status, 'VIAVEL_COM_RESSALVAS');
  assert.ok(segment70.iav < 70);
  assert.equal(route70.status, 'VIAVEL_COM_RESSALVAS');
  assert.ok(route70.iav < 70);

  const below50 = makeSnapshot({
    facts: allFacts({
      overrides: Object.fromEntries(
        IAV_DIMENSIONS.map((dimension, index) => [
          key(routeId, below50Segment, dimension),
          { score: scores50[index] },
        ]),
      ),
    }),
  });
  const route50 = routeById(below50, routeId);
  const segment50 = route50.segments.find((item) => item.segment_id === below50Segment);
  assert.equal(segment50.status, 'NAO_VIAVEL');
  assert.ok(segment50.iav < 50);
  assert.equal(route50.status, 'NAO_VIAVEL');
  assert.ok(route50.iav < 50);
});

test('domain: IAV publicado não contradiz status em limiar', () => {
  const routeId = 'rota-1-br-319';
  const below70Segment = 'r1-s2-floresta-br319';
  const below50Segment = 'r1-s3-rondonia-br364';
  const scores70 = [70, 70, 70, 70, 69.999999999999];
  const scores50 = [50, 50, 50, 50, 49.999999999999];

  const snapshot70 = makeSnapshot({
    facts: allFacts({
      overrides: Object.fromEntries(
        IAV_DIMENSIONS.map((dimension, index) => [
          key(routeId, below70Segment, dimension),
          { score: scores70[index] },
        ]),
      ),
    }),
  });
  const route70 = routeById(snapshot70, routeId);
  const segment70 = route70.segments.find((item) => item.segment_id === below70Segment);
  assert.equal(segment70.status, 'VIAVEL_COM_RESSALVAS');
  assert.ok(segment70.iav < 70);
  assert.equal(route70.status, 'VIAVEL_COM_RESSALVAS');
  assert.ok(route70.iav < 70);

  const snapshot50 = makeSnapshot({
    facts: allFacts({
      overrides: Object.fromEntries(
        IAV_DIMENSIONS.map((dimension, index) => [
          key(routeId, below50Segment, dimension),
          { score: scores50[index] },
        ]),
      ),
    }),
  });
  const route50 = routeById(snapshot50, routeId);
  const segment50 = route50.segments.find((item) => item.segment_id === below50Segment);
  assert.equal(segment50.status, 'NAO_VIAVEL');
  assert.ok(segment50.iav < 50);
  assert.equal(route50.status, 'NAO_VIAVEL');
  assert.ok(route50.iav < 50);
});

test('domain: fato confirmado sem score não sustenta dimensão', () => {
  const routeId = 'rota-1-br-319';
  const segmentId = 'r1-s3-rondonia-br364';
  const facts = allFacts();
  const fact = facts.find(
    (item) =>
      item.route_id === routeId && item.segment_id === segmentId && item.dimension === 'chuva',
  );
  fact.score = null;

  const snapshot = makeSnapshot({ facts });
  const route1 = routeById(snapshot, routeId);

  assert.equal(route1.status, 'NAO_AVALIAVEL');
  assert.equal(route1.iav, null);
  assert.ok(
    route1.missing_data.some(
      (missing) =>
        missing.segment_id === segmentId &&
        missing.dimension === 'chuva' &&
        missing.reason === 'SCORE_AUSENTE',
    ),
  );
});

test('domain: leitura fluvial fresca sem score não é escondida por leitura velha com score', () => {
  const routeId = 'rota-1-br-319';
  const segmentId = 'r1-s1-balsa-inicial';
  const dimensionKey = key(routeId, segmentId, 'nivel');
  const facts = allFacts({ omit: new Set([dimensionKey]) });

  facts.push(
    {
      route_id: routeId,
      segment_id: segmentId,
      dimension: 'nivel',
      score: 80,
      confirmation_status: 'CONFIRMADO',
      freshness_hours: 96,
      source: 'SGB/SAH Amazonas',
      source_url: 'https://sace.sgb.gov.br/amazonas/',
      evidence_id: 'sgb-stale-river',
      last_valid_at: '2026-11-19T17:15:00-04:00',
      effective_from: '2026-11-01',
      effective_until: '2026-11-30',
      value: { level_m: 4.07 },
    },
    {
      route_id: routeId,
      segment_id: segmentId,
      dimension: 'nivel',
      confirmation_status: 'CONFIRMADO',
      freshness_hours: 1,
      source: 'ANA Sala de Situação — Boletins diários Rio Amazonas',
      source_url:
        'https://www.gov.br/ana/pt-br/sala-de-situacao/rio-amazonas/boletins/diario/boletim_01_amazonas_publica2411-1.pdf/@@download/file',
      evidence_id: 'ana-fresh-river',
      published_at: '2026-11-24T16:01:00-04:00',
      collected_at: '2026-11-24T19:37:21-04:00',
      effective_from: '2026-11-24',
      effective_until: '2026-11-26',
      value: { station: 'Manaus', station_code: '14990000', level_m: 15.86 },
    },
  );

  const snapshot = makeSnapshot({ facts });
  const segment = routeById(snapshot, routeId).segments.find((item) => item.segment_id === segmentId);

  assert.equal(segment.status, 'NAO_AVALIAVEL');
  assert.equal(segment.iav, null);
  assert.ok(
    segment.missing_data.some(
      (missing) => missing.dimension === 'nivel' && missing.reason === 'SCORE_AUSENTE',
    ),
  );

  const evidenceIds = segment.evidences.map((evidence) => evidence.evidence_id);
  assert.ok(evidenceIds.includes('ana-fresh-river'));
  assert.ok(evidenceIds.includes('sgb-stale-river'));
});

test('domain: pesos injetáveis alteram IAV determinísticamente', () => {
  const routeId = 'rota-2-fluvial-brasilia';
  const segmentId = 'r2-s1-fluvial-amazonas';
  const facts = allFacts({
    overrides: Object.fromEntries(
      IAV_DIMENSIONS.map((dimension, index) => [
        key(routeId, segmentId, dimension),
        { score: [90, 50, 60, 70, 80][index] },
      ]),
    ),
  });

  const snapshot = makeSnapshot({ facts });
  const custom = makeSnapshot({
    facts,
    options: {
      iavWeights: { nivel: 0.1, chuva: 0.4, trafego: 0.2, qualidade: 0.2, restricao: 0.1 },
    },
  });
  const defaultSegment = routeById(snapshot, routeId).segments.find(
    (item) => item.segment_id === segmentId,
  );
  const customSegment = routeById(custom, routeId).segments.find(
    (item) => item.segment_id === segmentId,
  );

  assert.equal(defaultSegment.iav, 70);
  assert.equal(customSegment.iav, 63);
  assert.equal(customSegment.dimensions.nivel.weight, 0.1);
  assert.equal(snapshot.rule_version, RULE_VERSION);
  assert.ok(custom.rule_version.includes('+w-'));
  assert.notEqual(custom.rule_version, snapshot.rule_version);
});

test('domain: pesos sem dimensões rodoviárias falham com INVALID_WEIGHTS', () => {
  assert.throws(
    () =>
      makeSnapshot({
        options: {
          iavWeights: { nivel: 1, chuva: 0, trafego: 0, qualidade: 0, restricao: 0 },
        },
      }),
    (error) => error.code === 'INVALID_WEIGHTS',
  );
});
