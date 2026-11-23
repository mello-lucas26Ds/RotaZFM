import { assertIavQuery } from '@rotazfm/contracts';
import { loadRouteCatalog } from './catalog.js';

export const RULE_VERSION = 'iav-mvp-2026-11-23-r2';
export const IAV_WEIGHTS = Object.freeze({
  nivel: 0.3,
  chuva: 0.25,
  trafego: 0.2,
  qualidade: 0.15,
  restricao: 0.1,
});
export const IAV_DIMENSIONS = Object.freeze(Object.keys(IAV_WEIGHTS));
const IAV_WEIGHT_UNITS = Object.freeze(
  Object.fromEntries(
    IAV_DIMENSIONS.map((dimension) => [dimension, Math.round(IAV_WEIGHTS[dimension] * 100)]),
  ),
);
const SEGMENT_STATUS_RANK = Object.freeze({
  NAO_VIAVEL: 0,
  VIAVEL_COM_RESSALVAS: 1,
  VIAVEL: 2,
});

const HYDRO_MODES = new Set(['hidroviario', 'multimodal']);
const RODOVIARIO_DIMENSIONS = Object.freeze(['chuva', 'trafego', 'qualidade', 'restricao']);

function applicableDimensions(mode) {
  return HYDRO_MODES.has(mode) ? IAV_DIMENSIONS : RODOVIARIO_DIMENSIONS;
}

function hydroNivelAdjustment(nivelScore, chuvaScore) {
  const rainSeverity = decimalSubtract({ digits: 50n, power: 0 }, scoreDecimalParts(chuvaScore));
  if (rainSeverity.digits <= 0n) {
    const scoreParts = scoreDecimalParts(nivelScore);
    return { score: decimalToNumber(scoreParts), adjustment: 0, scoreParts };
  }

  const penaltyParts = decimalDivideByTen(rainSeverity);
  const adjustedParts = decimalSubtract(scoreDecimalParts(nivelScore), penaltyParts);
  const clampedParts = adjustedParts.digits < 0n ? { digits: 0n, power: 0 } : adjustedParts;

  return {
    score: decimalToNumber(clampedParts),
    adjustment: -decimalToNumber(penaltyParts),
    scoreParts: clampedParts,
  };
}

export const SCOPE_WARNING =
  'IAV mede viabilidade física/regulatória; não mede custo, disponibilidade de caminhão ou eventos fora das fontes.';

const MAX_FRESHNESS_HOURS = 24;
const VIABLE_THRESHOLD = 70;
const NOT_VIABLE_THRESHOLD = 50;
const DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const CONFIRMATION_STATUSES = new Set([
  'CONFIRMADO',
  'NAO_CONFIRMADO',
  'CONFLITANTE',
  'INDISPONIVEL',
  'EXPIRADO',
  'NAO_AVALIAVEL',
]);
const OPTIONAL_FACT_FIELDS = [
  'source',
  'source_url',
  'evidence_id',
  'collected_at',
  'published_at',
  'method',
  'content_hash',
  'raw_payload_id',
  'last_valid_at',
  'effective_from',
  'effective_until',
];

export class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

function fail(message, code = 'DOMAIN_ERROR') {
  throw new DomainError(message, code);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${field} deve ser string não vazia`, 'INVALID_FACT');
  }
  return value;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function dateParts(value) {
  const match = DATE_PREFIX_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { dateOnly: `${match[1]}-${match[2]}-${match[3]}` };
}

function normalizeDateValue(value, field) {
  if (typeof value !== 'string') {
    fail(`${field} deve ser uma data válida`, 'INVALID_BLOCKER');
  }

  const parts = dateParts(value);
  if (!parts) {
    fail(`${field} deve ser uma data válida`, 'INVALID_BLOCKER');
  }
  if (value === parts.dateOnly) return value;

  const separator = value[parts.dateOnly.length];
  if ((separator !== 'T' && separator !== ' ') || Number.isNaN(Date.parse(value))) {
    fail(`${field} deve ser uma data válida`, 'INVALID_BLOCKER');
  }
  return value;
}

function dateOnly(value) {
  return dateParts(value)?.dateOnly ?? null;
}

function blockerActiveOn(blocker, shippingDate) {
  const effectiveFrom = blocker.effective_from ? dateOnly(blocker.effective_from) : null;
  const effectiveUntil = blocker.effective_until ? dateOnly(blocker.effective_until) : null;

  if (effectiveFrom !== null && shippingDate < effectiveFrom) return false;
  if (effectiveUntil !== null && shippingDate > effectiveUntil) return false;
  return true;
}

function factCoversShippingDate(fact, shippingDate) {
  if (fact.effective_from !== undefined && fact.effective_from !== null) {
    const effectiveFrom = dateOnly(fact.effective_from);
    if (effectiveFrom === null || shippingDate < effectiveFrom) return false;
  }
  if (fact.effective_until !== undefined && fact.effective_until !== null) {
    const effectiveUntil = dateOnly(fact.effective_until);
    if (effectiveUntil === null || shippingDate > effectiveUntil) return false;
  }
  return true;
}

function segmentKey(routeId, segmentId) {
  return `${routeId}\u0000${segmentId}`;
}

function factKey(routeId, segmentId, dimension) {
  return `${segmentKey(routeId, segmentId)}\u0000${dimension}`;
}

function normalizeFact(rawFact, index) {
  if (!isPlainObject(rawFact)) {
    fail(`facts[${index}] deve ser um objeto`, 'INVALID_FACT');
  }

  const fact = {
    route_id: requireNonEmptyString(rawFact.route_id, `facts[${index}].route_id`),
    segment_id: requireNonEmptyString(rawFact.segment_id, `facts[${index}].segment_id`),
    dimension: requireNonEmptyString(rawFact.dimension, `facts[${index}].dimension`),
  };

  if (!IAV_DIMENSIONS.includes(fact.dimension)) {
    fail(`Dimensão inválida: ${fact.dimension}`, 'INVALID_FACT');
  }

  if (
    typeof rawFact.confirmation_status !== 'string' ||
    !CONFIRMATION_STATUSES.has(rawFact.confirmation_status)
  ) {
    fail(`facts[${index}].confirmation_status inválido`, 'INVALID_FACT');
  }
  fact.confirmation_status = rawFact.confirmation_status;

  if (rawFact.score === undefined || rawFact.score === null) {
    fact.score = null;
  } else {
    if (!Number.isFinite(rawFact.score) || rawFact.score < 0 || rawFact.score > 100) {
      fail(`facts[${index}].score deve estar entre 0 e 100`, 'INVALID_SCORE');
    }
    fact.score = rawFact.score;
  }

  if (rawFact.freshness_hours !== undefined && rawFact.freshness_hours !== null) {
    if (!Number.isFinite(rawFact.freshness_hours) || rawFact.freshness_hours < 0) {
      fail(`facts[${index}].freshness_hours deve ser número >= 0`, 'INVALID_FACT');
    }
    fact.freshness_hours = rawFact.freshness_hours;
  }

  if (rawFact.pbtc_kg !== undefined && rawFact.pbtc_kg !== null) {
    if (!isPositiveFinite(rawFact.pbtc_kg)) {
      fail(`facts[${index}].pbtc_kg deve ser número > 0`, 'INVALID_FACT');
    }
    fact.pbtc_kg = rawFact.pbtc_kg;
  }

  if (rawFact.value !== undefined) {
    if (rawFact.value !== null && !isPlainObject(rawFact.value)) {
      fail(`facts[${index}].value deve ser objeto`, 'INVALID_FACT');
    }
    fact.value = rawFact.value;
  }

  for (const field of OPTIONAL_FACT_FIELDS) {
    if (rawFact[field] !== undefined) fact[field] = rawFact[field];
  }

  return fact;
}

function normalizeBlocker(rawBlocker, index) {
  if (!isPlainObject(rawBlocker)) {
    fail(`blockers[${index}] deve ser um objeto`, 'INVALID_BLOCKER');
  }

  const blocker = {
    route_id: requireNonEmptyString(rawBlocker.route_id, `blockers[${index}].route_id`),
    segment_id: requireNonEmptyString(rawBlocker.segment_id, `blockers[${index}].segment_id`),
    type: requireNonEmptyString(rawBlocker.type, `blockers[${index}].type`),
    confirmed: rawBlocker.confirmed === true,
  };

  for (const field of ['pbtc_kg', 'weight_kg']) {
    if (rawBlocker[field] !== undefined && rawBlocker[field] !== null) {
      if (!isPositiveFinite(rawBlocker[field])) {
        fail(`blockers[${index}].${field} deve ser número > 0`, 'INVALID_BLOCKER');
      }
      blocker[field] = rawBlocker[field];
    }
  }

  for (const field of ['description', 'source', 'source_url', 'evidence_id']) {
    if (rawBlocker[field] !== undefined) blocker[field] = rawBlocker[field];
  }

  if (rawBlocker.effective_from !== undefined) {
    blocker.effective_from = normalizeDateValue(
      rawBlocker.effective_from,
      `blockers[${index}].effective_from`,
    );
  }
  if (rawBlocker.effective_until !== undefined) {
    blocker.effective_until = normalizeDateValue(
      rawBlocker.effective_until,
      `blockers[${index}].effective_until`,
    );
  }

  return blocker;
}

function scoreSortValue(fact) {
  return Number.isFinite(fact.score) ? fact.score : Number.POSITIVE_INFINITY;
}

function compareFactScores(left, right) {
  const leftScore = scoreSortValue(left);
  const rightScore = scoreSortValue(right);
  return leftScore === rightScore ? 0 : leftScore - rightScore;
}

function compareFacts(left, right) {
  const freshnessLeft = Number.isFinite(left.freshness_hours) ? left.freshness_hours : Number.POSITIVE_INFINITY;
  const freshnessRight = Number.isFinite(right.freshness_hours)
    ? right.freshness_hours
    : Number.POSITIVE_INFINITY;

  return (
    freshnessLeft - freshnessRight ||
    String(left.source ?? '').localeCompare(String(right.source ?? '')) ||
    String(left.source_url ?? '').localeCompare(String(right.source_url ?? '')) ||
    String(left.evidence_id ?? '').localeCompare(String(right.evidence_id ?? '')) ||
    compareFactScores(left, right)
  );
}

function factSignature(fact) {
  return JSON.stringify([fact.score, fact.pbtc_kg ?? null]);
}

function evaluateActiveDimension(facts) {
  if (!facts || facts.length === 0) {
    return { ok: false, reason: 'AUSENTE' };
  }

  if (facts.some((fact) => fact.confirmation_status === 'CONFLITANTE')) {
    return { ok: false, reason: 'CONFLITANTE', facts };
  }

  const confirmed = facts.filter((fact) => fact.confirmation_status === 'CONFIRMADO');
  const scoredConfirmed = confirmed.filter((fact) => Number.isFinite(fact.score));
  const freshScored = scoredConfirmed.filter(
    (fact) => Number.isFinite(fact.freshness_hours) && fact.freshness_hours <= MAX_FRESHNESS_HOURS,
  );

  if (freshScored.length > 0) {
    const signatures = new Set(freshScored.map(factSignature));
    if (signatures.size > 1) {
      return { ok: false, reason: 'CONFLITANTE', facts: freshScored };
    }

    const selected = [...freshScored].sort(compareFacts)[0];
    if (selected.dimension === 'restricao' && !isPositiveFinite(selected.pbtc_kg)) {
      return { ok: false, reason: 'PBTC_AUSENTE', fact: selected };
    }
    return { ok: true, fact: selected };
  }

  const staleConfirmed = confirmed.filter(
    (fact) => Number.isFinite(fact.freshness_hours) && fact.freshness_hours > MAX_FRESHNESS_HOURS,
  );
  if (staleConfirmed.length > 0) {
    return { ok: false, reason: 'DESATUALIZADO', facts: staleConfirmed };
  }

  if (confirmed.some((fact) => !Number.isFinite(fact.freshness_hours))) {
    return { ok: false, reason: 'FRESCOR_AUSENTE', facts: confirmed };
  }

  const freshUnscored = confirmed.filter(
    (fact) =>
      Number.isFinite(fact.freshness_hours) &&
      fact.freshness_hours <= MAX_FRESHNESS_HOURS &&
      !Number.isFinite(fact.score),
  );
  if (freshUnscored.length > 0) {
    return { ok: false, reason: 'SCORE_AUSENTE', facts: freshUnscored };
  }

  const nonConfirmed = facts.find((fact) => fact.confirmation_status !== 'CONFIRMADO');
  if (nonConfirmed) {
    return { ok: false, reason: nonConfirmed.confirmation_status, facts };
  }

  return { ok: false, reason: 'AUSENTE' };
}

function evaluateDimension(facts, shippingDate) {
  if (!facts || facts.length === 0) {
    return { ok: false, reason: 'AUSENTE' };
  }

  const activeFacts = facts.filter((fact) => factCoversShippingDate(fact, shippingDate));
  if (activeFacts.length === 0) {
    return { ok: false, reason: 'FORA_DE_VIGENCIA', facts };
  }

  return evaluateActiveDimension(activeFacts);
}

function dimensionResult(dimension, evaluation, weight = IAV_WEIGHTS[dimension]) {

  if (!evaluation.ok) {
    return {
      dimension,
      weight,
      score: null,
      weighted_score: null,
      status: 'NAO_AVALIAVEL',
      reason: evaluation.reason,
    };
  }

  const fact = evaluation.fact;
  const result = {
    dimension,
    weight,
    score: fact.score,
    weighted_score: round(fact.score * weight, 4),
    status: 'CONFIRMADO',
    confirmation_status: fact.confirmation_status,
    freshness_hours: fact.freshness_hours,
    source: fact.source,
    source_url: fact.source_url,
    evidence_id: fact.evidence_id,
    last_valid_at: fact.last_valid_at,
    effective_from: fact.effective_from,
    effective_until: fact.effective_until,
  };

  if (fact.pbtc_kg !== undefined) result.pbtc_kg = fact.pbtc_kg;

  return result;
}

function dimensionNotApplicable(dimension) {
  return {
    dimension,
    weight: 0,
    score: null,
    weighted_score: null,
    status: 'NAO_APLICAVEL',
    reason: 'DIMENSAO_NAO_APLICAVEL',
  };
}

function evidenceFromFact(fact, routeId, segmentId, dimension) {
  const evidence = {
    route_id: routeId,
    segment_id: segmentId,
    dimension,
    source: fact.source,
    source_url: fact.source_url,
    evidence_id: fact.evidence_id,
    confirmation_status: fact.confirmation_status,
    freshness_hours: fact.freshness_hours,
    last_valid_at: fact.last_valid_at,
    effective_from: fact.effective_from,
    effective_until: fact.effective_until,
  };

  for (const field of ['collected_at', 'published_at', 'method', 'content_hash', 'raw_payload_id', 'value']) {
    if (fact[field] !== undefined) evidence[field] = fact[field];
  }

  return Object.fromEntries(Object.entries(evidence).filter(([, value]) => value !== undefined));
}

function evidenceFromBlocker(blocker) {
  return Object.fromEntries(
    Object.entries({
      route_id: blocker.route_id,
      segment_id: blocker.segment_id,
      type: blocker.type,
      source: blocker.source,
      source_url: blocker.source_url,
      evidence_id: blocker.evidence_id,
      effective_from: blocker.effective_from,
      effective_until: blocker.effective_until,
    }).filter(([, value]) => value !== undefined),
  );
}

function uniqueEvidences(evidences) {
  const seen = new Set();
  const result = [];

  for (const evidence of evidences) {
    const key = JSON.stringify(evidence);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(evidence);
    }
  }

  return result;
}

function addBlocker(blockers, blocker) {
  const key = JSON.stringify([
    blocker.type,
    blocker.route_id,
    blocker.segment_id,
    blocker.description ?? null,
    blocker.pbtc_kg ?? null,
    blocker.weight_kg ?? null,
  ]);
  if (!blockers.some((existing) => JSON.stringify([
    existing.type,
    existing.route_id,
    existing.segment_id,
    existing.description ?? null,
    existing.pbtc_kg ?? null,
    existing.weight_kg ?? null,
  ]) === key)) {
    blockers.push(blocker);
  }
}

function blockerSort(left, right) {
  return (
    left.route_id.localeCompare(right.route_id) ||
    left.segment_id.localeCompare(right.segment_id) ||
    left.type.localeCompare(right.type)
  );
}

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
const IAV_OUTPUT_SCALE = 1_000_000_000_000n;
const IAV_OUTPUT_SCALE_NUMBER = 1_000_000_000_000;

function scoreDecimalParts(value) {
  const match = DECIMAL_PATTERN.exec(String(value));
  if (!match) {
    fail(`Score inválido: ${value}`, 'INVALID_SCORE');
  }

  const [, integerPart, fractionPart = '', exponentPart] = match;
  const exponent = exponentPart === undefined ? 0 : Number(exponentPart);
  return {
    digits: BigInt(`${integerPart}${fractionPart}`),
    power: exponent - fractionPart.length,
  };
}

function decimalAlign(left, right) {
  const power = Math.min(left.power, right.power);
  return [
    { digits: left.digits * 10n ** BigInt(left.power - power), power },
    { digits: right.digits * 10n ** BigInt(right.power - power), power },
  ];
}

function decimalSubtract(left, right) {
  const [leftAligned, rightAligned] = decimalAlign(left, right);
  return { digits: leftAligned.digits - rightAligned.digits, power: leftAligned.power };
}

function decimalDivideByTen(parts) {
  return { digits: parts.digits, power: parts.power - 1 };
}

function decimalToString({ digits, power }) {
  const negative = digits < 0n;
  const absolute = negative ? -digits : digits;
  let text = absolute.toString();

  if (power >= 0) {
    text += '0'.repeat(power);
  } else {
    const point = text.length + power;
    if (point > 0) {
      text = `${text.slice(0, point)}.${text.slice(point)}`;
    } else {
      text = `0.${'0'.repeat(-point)}${text}`;
    }
  }

  return `${negative ? '-' : ''}${text}`;
}

function decimalToNumber(parts) {
  return Number(decimalToString(parts));
}

function rationalToNumber(numerator, denominator) {
  // floor evita publicar um IAV arredondado para cima que contradiga o status exato
  return Number((numerator * IAV_OUTPUT_SCALE) / denominator) / IAV_OUTPUT_SCALE_NUMBER;
}

function calculateIav(scores, dimensionList) {
  const entries = dimensionList.map((dimension) => ({
    dimension,
    ...scoreDecimalParts(scores[dimension]),
  }));
  const weightSum = dimensionList.reduce((total, dimension) => total + IAV_WEIGHT_UNITS[dimension], 0);
  const scale = Math.max(0, ...entries.map((entry) => -entry.power));
  const denominator = BigInt(weightSum) * 10n ** BigInt(scale);
  const numerator = entries.reduce((total, entry) => {
    const scaledScore = entry.digits * 10n ** BigInt(entry.power + scale);
    return total + BigInt(IAV_WEIGHT_UNITS[entry.dimension]) * scaledScore;
  }, 0n);

  return { iav: rationalToNumber(numerator, denominator), numerator, denominator };
}

function assessSegment({ route, segment, factsBySegment, explicitBlockers, loadProfile, ruleVersion, shippingDate }) {
  const dimensions = {};
  const evaluations = {};
  const missingData = [];
  const evidences = [];
  const blockers = [];
  const applicable = applicableDimensions(segment.mode);
  const applicableSet = new Set(applicable);
  const applicableWeightUnits = applicable.reduce(
    (total, dimension) => total + IAV_WEIGHT_UNITS[dimension],
    0,
  );
  const weightForDimension = (dimension) => {
    if (!applicableSet.has(dimension)) return 0;
    if (applicable.length === IAV_DIMENSIONS.length) return IAV_WEIGHTS[dimension];
    return IAV_WEIGHT_UNITS[dimension] / applicableWeightUnits;
  };

  for (const dimension of IAV_DIMENSIONS) {
    if (!applicableSet.has(dimension)) {
      dimensions[dimension] = dimensionNotApplicable(dimension);
      continue;
    }
    const key = factKey(route.id, segment.id, dimension);
    const evaluation = evaluateDimension(factsBySegment.get(key), shippingDate);
    evaluations[dimension] = evaluation;
    dimensions[dimension] = dimensionResult(dimension, evaluation, weightForDimension(dimension));

    if (!evaluation.ok) {
      missingData.push({
        route_id: route.id,
        segment_id: segment.id,
        dimension,
        reason: evaluation.reason,
      });
      for (const fact of evaluation.facts ?? []) {
        evidences.push(evidenceFromFact(fact, route.id, segment.id, dimension));
      }
    } else {
      evidences.push(evidenceFromFact(evaluation.fact, route.id, segment.id, dimension));
    }
  }

  const restriction = dimensions.restricao;
  if (
    restriction.score !== null &&
    isPositiveFinite(restriction.pbtc_kg) &&
    loadProfile.peso_bruto_total_kg > restriction.pbtc_kg
  ) {
    const fact = evaluations.restricao.fact;
    addBlocker(blockers, {
      route_id: route.id,
      segment_id: segment.id,
      type: 'PBTC',
      description: 'PESO_BRUTO_TOTAL_EXCEDE_PBTC',
      weight_kg: loadProfile.peso_bruto_total_kg,
      pbtc_kg: restriction.pbtc_kg,
      source: fact.source,
      source_url: fact.source_url,
      evidence_id: fact.evidence_id,
      confirmed: true,
    });
  }

  const segmentBlockerKey = segmentKey(route.id, segment.id);
  for (const blocker of explicitBlockers.get(segmentBlockerKey) ?? []) {
    blockers.push({ ...blocker, confirmed: true });
    evidences.push(evidenceFromBlocker(blocker));
  }

  blockers.sort(blockerSort);

  const allDimensionsValid = applicable.every((dimension) => dimensions[dimension].score !== null);
  const calculationScores = {};
  for (const dimension of applicable) calculationScores[dimension] = dimensions[dimension].score;

  let calculation = null;
  if (allDimensionsValid) {
    if (applicableSet.has('nivel') && applicableSet.has('chuva')) {
      const adjustment = hydroNivelAdjustment(dimensions.nivel.score, dimensions.chuva.score);
      calculationScores.nivel = decimalToString(adjustment.scoreParts);
      dimensions.nivel.score_used = adjustment.score;
      dimensions.nivel.weighted_score = round(adjustment.score * weightForDimension('nivel'), 4);
      dimensions.nivel.hydro_adjustment = adjustment.adjustment;
    }
    calculation = calculateIav(calculationScores, applicable);
  }
  const iav = calculation?.iav ?? null;
  const meetsThreshold = (threshold) =>
    calculation !== null && calculation.numerator >= BigInt(threshold) * calculation.denominator;

  if (iav !== null && (iav < 0 || iav > 100)) {
    fail(`IAV fora do intervalo 0..100 no trecho ${segment.id}`, 'INVALID_SCORE');
  }

  let status;
  if (blockers.length > 0) {
    status = 'NAO_VIAVEL';
  } else if (!allDimensionsValid) {
    status = 'NAO_AVALIAVEL';
  } else if (!meetsThreshold(NOT_VIABLE_THRESHOLD)) {
    status = 'NAO_VIAVEL';
  } else if (!meetsThreshold(VIABLE_THRESHOLD)) {
    status = 'VIAVEL_COM_RESSALVAS';
  } else {
    status = 'VIAVEL';
  }

  return {
    segment_id: segment.id,
    name: segment.name,
    from: segment.from,
    to: segment.to,
    road: segment.road,
    mode: segment.mode,
    critical: segment.critical === true,
    status,
    iav,
    rule_version: ruleVersion,
    dimensions,
    blockers,
    missing_data: missingData,
    evidences: uniqueEvidences(evidences),
  };
}

function newsBelongsToRoute(newsItem, route, segmentIds) {
  if (!isPlainObject(newsItem)) return false;
  if (newsItem.route_id !== undefined) return newsItem.route_id === route.id;
  if (Array.isArray(newsItem.matched_route_ids)) return newsItem.matched_route_ids.includes(route.id);
  if (Array.isArray(newsItem.matched_segments)) {
    return newsItem.matched_segments.some((segmentId) => segmentIds.has(segmentId));
  }
  return false;
}

function assessRoute(route, context) {
  const segmentIds = new Set(route.segments.map((segment) => segment.id));
  const segments = route.segments.map((segment) => assessSegment({
    route,
    segment,
    ...context,
  }));

  const blockers = segments.flatMap((segment) => segment.blockers);
  const missingData = segments.flatMap((segment) => segment.missing_data);
  const evidences = uniqueEvidences(segments.flatMap((segment) => segment.evidences));
  const numericSegments = segments.filter((segment) => segment.iav !== null);
  const allSegmentsNumeric = numericSegments.length === segments.length && segments.length > 0;
  const minimumIav = allSegmentsNumeric
    ? Math.min(...segments.map((segment) => segment.iav))
    : null;

  let worstSegment = null;
  let status;
  if (blockers.length > 0) {
    const blockerSegmentIds = new Set(blockers.map((blocker) => blocker.segment_id));
    worstSegment = segments.find((segment) => blockerSegmentIds.has(segment.segment_id)) ?? null;
    status = 'NAO_VIAVEL';
  } else if (segments.some((segment) => segment.iav === null)) {
    worstSegment = segments.find((segment) => segment.iav === null) ?? null;
    status = 'NAO_AVALIAVEL';
  } else {
    const worstStatus = segments.reduce(
      (worst, segment) =>
        SEGMENT_STATUS_RANK[segment.status] < SEGMENT_STATUS_RANK[worst] ? segment.status : worst,
      'VIAVEL',
    );
    worstSegment = segments
      .filter((segment) => segment.status === worstStatus)
      .reduce((minimum, segment) => (segment.iav < minimum.iav ? segment : minimum));
    status = worstStatus;
  }

  return {
    route_id: route.id,
    name: route.name,
    mode: route.mode,
    origin: route.origin,
    destination: route.destination,
    approx_distance_km: route.approx_distance_km,
    distance_note: route.distance_note,
    status,
    iav: minimumIav,
    worst_segment_id: worstSegment?.segment_id ?? null,
    rule_version: context.ruleVersion,
    segments,
    blockers,
    missing_data: missingData,
    evidences,
    related_news: context.relatedNews.filter((item) => newsBelongsToRoute(item, route, segmentIds)),
  };
}

function buildJustification(routes, ruleVersion) {
  const counts = routes.reduce(
    (result, route) => {
      result[route.status] = (result[route.status] ?? 0) + 1;
      return result;
    },
    {},
  );

  return `IAV ${ruleVersion}: ${counts.VIAVEL ?? 0} viável(is), ${counts.VIAVEL_COM_RESSALVAS ?? 0} viável(is) com ressalvas, ${counts.NAO_VIAVEL ?? 0} não viável(is), ${counts.NAO_AVALIAVEL ?? 0} não avaliável(is).`;
}

function validateCatalog(catalog, query) {
  if (!isPlainObject(catalog) || !Array.isArray(catalog.routes)) {
    fail('Catálogo de rotas inválido', 'INVALID_CATALOG');
  }

  const routes = catalog.routes.filter(
    (route) => route.origin === query.origem && route.destination === query.destino,
  );

  if (routes.length === 0) {
    fail('ROUTE_NOT_FOUND', 'ROUTE_NOT_FOUND');
  }

  for (const route of routes) {
    requireNonEmptyString(route.id, 'route.id');
    if (!Array.isArray(route.segments) || route.segments.length === 0) {
      fail(`Rota ${route.id} não possui segmentos`, 'INVALID_CATALOG');
    }
    for (const segment of route.segments) {
      requireNonEmptyString(segment.id, `route ${route.id} segment.id`);
    }
  }

  return routes;
}

function indexFacts(facts, routes) {
  const knownSegments = new Set();
  for (const route of routes) {
    for (const segment of route.segments) {
      knownSegments.add(segmentKey(route.id, segment.id));
    }
  }

  const normalizedFacts = [...facts]
    .map((fact, index) => normalizeFact(fact, index))
    .sort(compareFacts);

  for (const fact of normalizedFacts) {
    if (!knownSegments.has(segmentKey(fact.route_id, fact.segment_id))) {
      fail(`Fato para trecho desconhecido: ${fact.route_id}/${fact.segment_id}`, 'UNKNOWN_SEGMENT');
    }
  }

  const factsBySegment = new Map();
  for (const fact of normalizedFacts) {
    const key = factKey(fact.route_id, fact.segment_id, fact.dimension);
    if (!factsBySegment.has(key)) factsBySegment.set(key, []);
    factsBySegment.get(key).push(fact);
  }

  return factsBySegment;
}

function indexBlockers(blockers, routes, shippingDate) {
  const knownSegments = new Set();
  for (const route of routes) {
    for (const segment of route.segments) {
      knownSegments.add(segmentKey(route.id, segment.id));
    }
  }

  const confirmedBlockers = [...blockers]
    .map((blocker, index) => normalizeBlocker(blocker, index))
    .filter((blocker) => blocker.confirmed && blockerActiveOn(blocker, shippingDate))
    .sort(blockerSort);

  for (const blocker of confirmedBlockers) {
    if (!knownSegments.has(segmentKey(blocker.route_id, blocker.segment_id))) {
      fail(`Bloqueador para trecho desconhecido: ${blocker.route_id}/${blocker.segment_id}`, 'UNKNOWN_SEGMENT');
    }
  }

  const blockersBySegment = new Map();
  for (const blocker of confirmedBlockers) {
    const key = segmentKey(blocker.route_id, blocker.segment_id);
    if (!blockersBySegment.has(key)) blockersBySegment.set(key, []);
    blockersBySegment.get(key).push(blocker);
  }

  return blockersBySegment;
}

export function assessDecision({
  query,
  catalog,
  facts = [],
  blockers = [],
  relatedNews = [],
  ruleVersion = RULE_VERSION,
  referenceDate,
}) {
  const validQuery = assertIavQuery(query, { referenceDate });
  if (typeof ruleVersion !== 'string' || ruleVersion.trim() === '') {
    fail('ruleVersion é obrigatório', 'INVALID_RULE_VERSION');
  }
  if (!Array.isArray(facts)) fail('facts deve ser array', 'INVALID_FACT');
  if (!Array.isArray(blockers)) fail('blockers deve ser array', 'INVALID_BLOCKER');
  if (!Array.isArray(relatedNews)) fail('relatedNews deve ser array', 'INVALID_NEWS');

  const routes = validateCatalog(catalog, validQuery);
  const context = {
    factsBySegment: indexFacts(facts, routes),
    shippingDate: validQuery.data_embarque,
    explicitBlockers: indexBlockers(blockers, routes, validQuery.data_embarque),
    loadProfile: validQuery.carga,
    relatedNews,
    ruleVersion,
  };

  const routeAssessments = routes.map((route) => assessRoute(route, context));
  const missingData = routeAssessments.flatMap((route) => route.missing_data);
  const allBlockers = routeAssessments.flatMap((route) => route.blockers);
  const allEvidences = uniqueEvidences(routeAssessments.flatMap((route) => route.evidences));

  return {
    rule_version: ruleVersion,
    catalog_version: catalog.version,
    query: validQuery,
    routes: routeAssessments,
    missing_data: missingData,
    blockers: allBlockers,
    evidences: allEvidences,
    related_news: relatedNews,
    justification_template: buildJustification(routeAssessments, ruleVersion),
    scope_warning: SCOPE_WARNING,
  };
}

export function createDecisionSnapshot({
  query,
  catalog,
  catalogPath,
  facts = [],
  blockers = [],
  relatedNews = [],
  ruleVersion = RULE_VERSION,
  referenceDate,
}) {
  return assessDecision({
    query,
    catalog: catalog ?? loadRouteCatalog(catalogPath),
    facts,
    blockers,
    relatedNews,
    ruleVersion,
    referenceDate,
  });
}
