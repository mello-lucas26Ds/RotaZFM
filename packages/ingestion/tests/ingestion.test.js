import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionInput, buildPbtcBlockers } from '../src/index.js';
import { createDecisionSnapshot } from '../../domain/src/index.js';

const REFERENCE_DATE = '2026-11-23';

function makeQuery({ peso = 10000, dataEmbarque = '2026-11-25' } = {}) {
  return {
    origem: 'MANAUS',
    destino: 'SAO_PAULO',
    data_embarque: dataEmbarque,
    carga: {
      tipo: 'SECA',
      peso_bruto_total_kg: peso,
    },
  };
}

function snapshotFrom(input, query) {
  return createDecisionSnapshot({
    query,
    catalog: input.catalog,
    facts: input.facts,
    blockers: input.blockers,
    relatedNews: input.relatedNews,
    referenceDate: REFERENCE_DATE,
  });
}

test('ingestion: fixtures viram raw payloads, evidências e fatos determinísticos/idempotentes', () => {
  const query = makeQuery();
  const first = buildDecisionInput({ query });
  const second = buildDecisionInput({ query });

  assert.deepEqual(first, second);
  assert.ok(first.rawPayloads.length >= 7);
  assert.ok(first.evidences.length > 0);
  assert.ok(first.facts.length > 0);
  assert.ok(first.relatedNews.length > 0);

  for (const fact of first.facts) {
    assert.equal('score' in fact, false, `fato ${fact.evidence_id} não deve inventar score`);
    assert.ok(['CONFIRMADO', 'NAO_CONFIRMADO', 'CONFLITANTE', 'INDISPONIVEL', 'EXPIRADO', 'NAO_AVALIAVEL'].includes(fact.confirmation_status));
  }

  for (const evidence of first.evidences) {
    assert.ok(evidence.evidence_id);
    assert.ok(evidence.confirmation_status);
  }
});

test('ingestion: não emite fato de nivel para segmento rodoviário', () => {
  const input = buildDecisionInput({ query: makeQuery() });
  const modeBySegment = new Map();
  for (const route of input.catalog.routes) {
    for (const segment of route.segments) {
      modeBySegment.set(`${route.id}:${segment.id}`, segment.mode);
    }
  }

  const nivelFacts = input.facts.filter((fact) => fact.dimension === 'nivel');
  assert.ok(nivelFacts.length > 0);
  for (const fact of nivelFacts) {
    const mode = modeBySegment.get(`${fact.route_id}:${fact.segment_id}`);
    assert.ok(mode === 'hidroviario' || mode === 'multimodal', `nivel emitido para modo ${mode}`);
  }
});

test('ingestion: dimensão obrigatória sem score objetivo vira NAO_AVALIAVEL', () => {
  const query = makeQuery();
  const input = buildDecisionInput({ query });
  const snapshot = snapshotFrom(input, query);

  assert.equal(snapshot.routes.length, 2);
  for (const route of snapshot.routes) {
    assert.equal(route.status, 'NAO_AVALIAVEL');
    assert.equal(route.iav, null);
  }

  const route1 = snapshot.routes.find((route) => route.route_id === 'rota-1-br-319');
  const roadSegment = route1.segments.find((segment) => segment.segment_id === 'r1-s3-rondonia-br364');
  assert.equal(roadSegment.dimensions.nivel.status, 'NAO_APLICAVEL');
  assert.ok(route1.missing_data.length > 0);
  assert.ok(snapshot.missing_data.some((missing) => missing.dimension === 'trafego'));
});

test('ingestion: PBTC confirmado vira bloqueador duro apenas quando a carga excede o limite', () => {
  const heavyQuery = makeQuery({ peso: 20000 });
  const heavyInput = buildDecisionInput({ query: heavyQuery });
  const heavySnapshot = snapshotFrom(heavyInput, heavyQuery);

  assert.equal(heavyInput.blockers.length, 1);
  assert.equal(heavyInput.blockers[0].type, 'PBTC');
  assert.equal(heavyInput.blockers[0].segment_id, 'r1-s2-floresta-br319');
  assert.equal(heavyInput.blockers[0].pbtc_kg, 17000);
  assert.equal(heavyInput.blockers[0].weight_kg, 20000);

  const route1 = heavySnapshot.routes.find((route) => route.route_id === 'rota-1-br-319');
  assert.equal(route1.status, 'NAO_VIAVEL');
  assert.ok(
    route1.blockers.some(
      (blocker) =>
        blocker.type === 'PBTC' &&
        blocker.pbtc_kg === 17000 &&
        blocker.weight_kg === 20000,
    ),
  );

  const lightQuery = makeQuery({ peso: 10000 });
  const lightInput = buildDecisionInput({ query: lightQuery });
  assert.equal(lightInput.blockers.length, 0);
  const lightSnapshot = snapshotFrom(lightInput, lightQuery);
  assert.equal(lightSnapshot.blockers.length, 0);
  assert.equal(
    lightSnapshot.routes.find((route) => route.route_id === 'rota-1-br-319').status,
    'NAO_AVALIAVEL',
  );
});

test('ingestion: PBTC escolhe o menor limite numérico vigente no trecho', () => {
  const payload = {
    dimension: 'weight_restriction',
    restrictions: [
      {
        id: 'pbtc-17t',
        route_id: 'rota-1-br-319',
        segment_id: 'r1-s2-floresta-br319',
        confirmation_status: 'CONFIRMADO',
        source: 'DNIT',
        source_url: 'https://example.com/pbtc',
        rules: { pbtc_max_t_nov_may: 17 },
      },
      {
        id: 'pbtc-9t',
        route_id: 'rota-1-br-319',
        segment_id: 'r1-s2-floresta-br319',
        confirmation_status: 'CONFIRMADO',
        source: 'DNIT',
        source_url: 'https://example.com/pbtc',
        rules: { pbtc_max_t_nov_may: 9 },
      },
    ],
  };
  const segmentIndex = { get: () => ({ mode: 'rodoviario' }) };

  const blockers = buildPbtcBlockers({
    payload,
    query: makeQuery({ peso: 10000 }),
    segmentIndex,
  });

  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].pbtc_kg, 9000);
  assert.equal(blockers[0].evidence_id, 'pbtc-9t');
});

test('ingestion: PBTC ignora limite vencido antes de escolher o vigente', () => {
  const payload = {
    dimension: 'weight_restriction',
    restrictions: [
      {
        id: 'pbtc-9t-vencido',
        route_id: 'rota-1-br-319',
        segment_id: 'r1-s2-floresta-br319',
        confirmation_status: 'CONFIRMADO',
        source: 'DNIT',
        source_url: 'https://example.com/pbtc',
        effective_until: '2026-11-20',
        rules: { pbtc_max_t_nov_may: 9 },
      },
      {
        id: 'pbtc-17t-vigente',
        route_id: 'rota-1-br-319',
        segment_id: 'r1-s2-floresta-br319',
        confirmation_status: 'CONFIRMADO',
        source: 'DNIT',
        source_url: 'https://example.com/pbtc',
        effective_from: '2026-11-21',
        rules: { pbtc_max_t_nov_may: 17 },
      },
    ],
  };
  const segmentIndex = { get: () => ({ mode: 'rodoviario' }) };

  const light = buildPbtcBlockers({
    payload,
    query: makeQuery({ peso: 10000 }),
    segmentIndex,
  });
  assert.equal(light.length, 0);

  const heavy = buildPbtcBlockers({
    payload,
    query: makeQuery({ peso: 18000 }),
    segmentIndex,
  });
  assert.equal(heavy.length, 1);
  assert.equal(heavy[0].pbtc_kg, 17000);
  assert.equal(heavy[0].evidence_id, 'pbtc-17t-vigente');
});

test('ingestion: fatos carregam valor medido e rastreabilidade do fixture', () => {
  const query = makeQuery();
  const input = buildDecisionInput({ query });
  const rainFact = input.facts.find(
    (item) => item.dimension === 'chuva' && item.value?.municipality === 'Manaus',
  );
  assert.ok(rainFact);
  assert.equal(rainFact.raw_payload_id, 'fixture:rain.fixture.json');
  assert.equal(rainFact.method, 'inmet_api_fixture');
  assert.ok(rainFact.content_hash);
  assert.ok(rainFact.collected_at);
  assert.equal(rainFact.value?.municipality, 'Manaus');

  const trafficFact = input.facts.find(
    (item) => item.dimension === 'trafego' && item.value?.traffic_status === 'NAO_CONFIRMADO',
  );
  assert.ok(trafficFact);
  assert.equal(trafficFact.raw_payload_id, 'fixture:traffic.fixture.json');
  assert.equal(trafficFact.method, 'local_fixture_file');
  assert.ok(trafficFact.content_hash);
  assert.ok(trafficFact.collected_at);
  assert.equal(trafficFact.value?.traffic_status, 'NAO_CONFIRMADO');

  const snapshot = snapshotFrom(input, query);
  const segment = snapshot.routes
    .find((route) => route.route_id === rainFact.route_id)
    .segments.find((item) => item.segment_id === rainFact.segment_id);
  const evidence = segment.evidences.find(
    (item) => item.evidence_id === rainFact.evidence_id && item.dimension === 'chuva',
  );
  assert.equal(evidence.value?.municipality, 'Manaus');
  assert.equal(evidence.raw_payload_id, 'fixture:rain.fixture.json');
  assert.equal(evidence.method, 'inmet_api_fixture');
});

test('ingestion: related_news permanece contexto e nunca vira blocker', () => {
  const query = makeQuery();
  const input = buildDecisionInput({ query });
  const snapshot = snapshotFrom(input, query);

  assert.ok(input.relatedNews.length > 0);
  assert.ok(input.relatedNews.every((item) => item.blocker === false));
  assert.ok(input.relatedNews.every((item) => item.title && item.url && item.source));
  assert.equal(snapshot.blockers.length, 0);
  assert.ok(snapshot.related_news.length > 0);
});

test('ingestion: freshness_hours é calculado, não copiado da fixture', () => {
  const input = buildDecisionInput({ query: makeQuery() });

  assert.ok(input.evidences.length > 0);
  assert.ok(input.evidences.every((evidence) => evidence.freshness_hours !== 96));

  const rainEvidence = input.evidences.find(
    (evidence) => evidence.fixture_dimension === 'rain' && evidence.value?.municipality === 'Manaus',
  );
  assert.ok(rainEvidence);
  assert.ok(rainEvidence.freshness_hours <= 1);

  const riverEvidence = input.evidences.find(
    (evidence) =>
      evidence.fixture_file === 'river_level.fixture.json' &&
      evidence.fixture_dimension === 'river_level' &&
      evidence.segment_id === 'r2-s1-fluvial-amazonas' &&
      evidence.confirmation_status === 'CONFIRMADO',
  );
  assert.ok(riverEvidence);
  assert.ok(riverEvidence.freshness_hours > 24);

  const snapshot = snapshotFrom(input, makeQuery());
  const riverSegment = snapshot.routes
    .find((route) => route.route_id === riverEvidence.route_id)
    .segments.find((segment) => segment.segment_id === riverEvidence.segment_id);
  const riverSnapshotEvidence = riverSegment.evidences.find(
    (evidence) => evidence.evidence_id === riverEvidence.evidence_id && evidence.dimension === 'nivel',
  );
  assert.equal(riverSnapshotEvidence.value?.station, riverEvidence.value?.station);
  assert.equal(riverSnapshotEvidence.value?.level_m, riverEvidence.value?.level_m);
});

test('ingestion: não depende de rede para normalizar fixtures', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('rede não permitida na ingestão de fixtures');
  };

  try {
    const input = buildDecisionInput({ query: makeQuery() });
    assert.ok(input.facts.length > 0);
    assert.ok(input.evidences.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ingestion: PBTC escolhe o limite mais restritivo por segmento', () => {
  const payload = {
    fixture_kind: 'dimension_evidence',
    dimension: 'weight_restriction',
    restrictions: [
      {
        id: 'ev-10t',
        route_id: 'rota-1-br-319',
        segment_id: 'r1-s2-floresta-br319',
        confirmation_status: 'CONFIRMADO',
        source: 'DNIT',
        source_url: 'https://example.com/10t',
        rules: { pbtc_max_t_jun_oct: 10 },
      },
      {
        id: 'ev-9t',
        route_id: 'rota-1-br-319',
        segment_id: 'r1-s2-floresta-br319',
        confirmation_status: 'CONFIRMADO',
        source: 'DNIT',
        source_url: 'https://example.com/9t',
        rules: { pbtc_max_t_jun_oct: 9 },
      },
    ],
  };
  const segmentIndex = { get: () => ({ mode: 'rodoviario' }) };

  const blockers = buildPbtcBlockers({
    payload,
    query: makeQuery({ peso: 9500, dataEmbarque: '2026-06-15' }),
    segmentIndex,
  });

  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].pbtc_kg, 9000);
  assert.equal(blockers[0].evidence_id, 'ev-9t');
});

test('ingestion: conflito de PBTC do trecho BR-319 vira fato CONFLITANTE', () => {
  const query = makeQuery({ peso: 10000 });
  const input = buildDecisionInput({ query });
  const snapshot = snapshotFrom(input, query);

  assert.ok(
    input.facts.some(
      (fact) =>
        fact.dimension === 'restricao' &&
        fact.segment_id === 'r1-s2-floresta-br319' &&
        fact.confirmation_status === 'CONFLITANTE',
    ),
  );

  const route = snapshot.routes.find((item) => item.route_id === 'rota-1-br-319');
  const segment = route.segments.find((item) => item.segment_id === 'r1-s2-floresta-br319');
  assert.equal(segment.dimensions.restricao.status, 'NAO_AVALIAVEL');
  assert.equal(segment.dimensions.restricao.reason, 'CONFLITANTE');
});
