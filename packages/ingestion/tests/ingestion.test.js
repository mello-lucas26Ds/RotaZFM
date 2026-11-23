import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionInput } from '../src/index.js';
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
      evidence.fixture_dimension === 'river_level' &&
      evidence.segment_id === 'r2-s1-fluvial-amazonas' &&
      evidence.confirmation_status === 'CONFIRMADO',
  );
  assert.ok(riverEvidence);
  assert.ok(riverEvidence.freshness_hours > 24);
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
