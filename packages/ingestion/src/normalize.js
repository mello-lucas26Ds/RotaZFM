const DIMENSION_BY_FIXTURE = Object.freeze({
  rain: 'chuva',
  river_level: 'nivel',
  traffic: 'trafego',
  road_quality: 'qualidade',
  weight_restriction: 'restricao',
});

const IAV_DIMENSIONS = new Set(['nivel', 'chuva', 'trafego', 'qualidade', 'restricao']);

const STATUS_MAP = Object.freeze({
  CONFIRMADO: 'CONFIRMADO',
  NAO_CONFIRMADO: 'NAO_CONFIRMADO',
  CONFLITANTE: 'CONFLITANTE',
  INDISPONIVEL: 'INDISPONIVEL',
  EXPIRADO: 'EXPIRADO',
  NAO_AVALIAVEL: 'NAO_AVALIAVEL',
  'NÃO_ENCONTRADO': 'INDISPONIVEL',
  PARCIAL: 'NAO_CONFIRMADO',
});

const EVIDENCE_FIELDS = [
  'collected_at',
  'published_at',
  'method',
  'content_hash',
  'last_valid_at',
  'effective_from',
  'effective_until',
];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapConfirmationStatus(status, fallback = 'NAO_CONFIRMADO') {
  if (typeof status !== 'string') return fallback;
  return STATUS_MAP[status] ?? fallback;
}

function sourceUrlOf(record) {
  if (typeof record.source_url === 'string' && record.source_url.trim() !== '') {
    return record.source_url;
  }
  if (typeof record.url === 'string' && record.url.trim() !== '') {
    return record.url;
  }
  if (Array.isArray(record.source_urls)) {
    return record.source_urls.find((url) => typeof url === 'string' && url.trim() !== '') ?? null;
  }
  return null;
}

function copyPresent(target, source, fields) {
  for (const field of fields) {
    if (source[field] !== undefined) target[field] = source[field];
  }
  return target;
}

function pick(record, fields) {
  const value = {};
  for (const field of fields) {
    if (record[field] !== undefined) value[field] = record[field];
  }
  return value;
}

function parseTimestamp(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function computeFreshnessHours(record, payload) {
  const collectedRaw = record.collected_at ?? payload?.created_at;
  const baseRaw =
    record.last_valid_at ??
    record.published_at ??
    record.observed_at ??
    record.period_date ??
    record.effective_from;
  const collected = parseTimestamp(collectedRaw);
  const base = parseTimestamp(baseRaw);
  if (collected === null || base === null) return undefined;
  return Math.round(Math.max(0, (collected - base) / 3_600_000) * 100) / 100;
}

function rainValue(record) {
  return pick(record, [
    'municipality',
    'geocode',
    'period_date',
    'period',
    'summary_pt',
    'temp_max_c',
    'temp_min_c',
    'rain_signal',
    'precipitation_mm',
  ]);
}

function riverValue(record) {
  return pick(record, ['station', 'river', 'level_m', 'unit', 'observed_at']);
}

function trafficValue(record) {
  if (record.value !== undefined) return record.value;
  return pick(record, ['traffic_status', 'coverage', 'vmd_estimated', 'unit', 'fallback', 'road', 'critical']);
}

function roadQualityValue(record) {
  return pick(record, ['road', 'uf', 'surface', 'km_range', 'municipalities', 'icm_value', 'icm_classification']);
}

function weightValue(record) {
  return pick(record, ['road', 'uf', 'km_range', 'restriction_type', 'legal_instrument', 'rules']);
}

function inferRouteAndSegment(record, segmentIndex) {
  const segmentId = record.segment_id ?? null;
  const fromSegment = segmentId ? segmentIndex.findBySegmentId(segmentId) : null;
  const routeId = record.route_id ?? fromSegment?.routeId ?? null;
  const resolvedSegmentId = segmentId ?? fromSegment?.segmentId ?? null;
  return { routeId, segmentId: resolvedSegmentId };
}

function candidatesFromFixture(fixtureFile, segmentIndex) {
  const payload = fixtureFile.payload;
  if (!isPlainObject(payload) || payload.fixture_kind !== 'dimension_evidence') return [];

  const dimension = DIMENSION_BY_FIXTURE[payload.dimension];
  if (!dimension) return [];

  const candidates = [];
  const push = (record, status, value) => {
    if (!isPlainObject(record)) return;
    const { routeId, segmentId } = inferRouteAndSegment(record, segmentIndex);
    candidates.push({
      fixtureFile,
      payload,
      dimension,
      record,
      status: status ?? mapConfirmationStatus(record.confirmation_status, payload.source_status),
      routeId,
      segmentId,
      value: value ?? {},
    });
  };

  if (payload.dimension === 'rain') {
    for (const record of payload.observations ?? []) {
      push(record, undefined, rainValue(record));
    }
  } else if (payload.dimension === 'river_level') {
    for (const record of payload.official_readings ?? []) {
      push(record, undefined, riverValue(record));
    }
    for (const record of payload.coverage_gaps ?? []) {
      push(record, record.confirmation_status, riverValue(record));
    }
  } else if (payload.dimension === 'traffic') {
    for (const record of payload.evidence ?? []) {
      push(record, undefined, trafficValue(record));
    }
    for (const record of payload.segment_coverage ?? []) {
      push(record, record.traffic_status ?? record.confirmation_status, trafficValue(record));
    }
  } else if (payload.dimension === 'road_quality') {
    for (const record of payload.records ?? []) {
      push(record, undefined, roadQualityValue(record));
    }
  } else if (payload.dimension === 'weight_restriction') {
    for (const record of payload.restrictions ?? []) {
      push(record, undefined, weightValue(record));
    }
    for (const record of payload.coverage_gaps ?? []) {
      push(record, record.status ?? record.confirmation_status, weightValue(record));
    }
    for (const record of payload.overlaps_and_conflicts ?? []) {
      push(record, record.status ?? record.confirmation_status, pick(record, ['description', 'conservative_rule', 'requires_confirmation_from']));
    }
  }

  return candidates.map((candidate, index) => ({
    ...candidate,
    evidenceId: candidate.record.id ?? `${payload.dimension}:${index}`,
  }));
}

function baseEvidence(candidate) {
  const { record, payload, fixtureFile } = candidate;
  const evidence = {
    evidence_id: candidate.evidenceId,
    fixture_file: fixtureFile.fileName,
    fixture_dimension: payload.dimension,
    dimension: candidate.dimension,
    route_id: candidate.routeId,
    segment_id: candidate.segmentId,
    confirmation_status: mapConfirmationStatus(candidate.status),
    source_confirmation_status: candidate.status ?? null,
    value: candidate.value,
  };

  if (typeof record.source === 'string' && record.source.trim() !== '') {
    evidence.source = record.source;
  }
  const sourceUrl = sourceUrlOf(record);
  if (sourceUrl !== null) evidence.source_url = sourceUrl;
  if (Array.isArray(record.source_urls) && record.source_urls.length > 0) {
    evidence.source_urls = record.source_urls;
  }

  copyPresent(evidence, record, EVIDENCE_FIELDS);
  const freshnessHours = computeFreshnessHours(record, payload);
  if (freshnessHours !== undefined) evidence.freshness_hours = freshnessHours;
  if (record.notes !== undefined) evidence.notes = record.notes;

  return evidence;
}

function extractScore(record) {
  const candidates = [record.score, record.score_0_100, record.value?.score];
  for (const candidate of candidates) {
    if (Number.isFinite(candidate) && candidate >= 0 && candidate <= 100) return candidate;
  }
  return null;
}

function factFromCandidate(candidate, segmentIndex) {
  if (!candidate.routeId || !candidate.segmentId) return null;
  if (!IAV_DIMENSIONS.has(candidate.dimension)) return null;

  const segment = segmentIndex.get(candidate.routeId, candidate.segmentId);
  if (!segment) return null;
  if (candidate.dimension === 'nivel' && !segmentIndex.isHydroMode(segment.mode)) return null;

  const record = candidate.record;
  const source = typeof record.source === 'string' && record.source.trim() !== '' ? record.source : null;
  const sourceUrl = sourceUrlOf(record);
  if (!source || !sourceUrl) return null;

  const fact = {
    route_id: candidate.routeId,
    segment_id: candidate.segmentId,
    dimension: candidate.dimension,
    confirmation_status: mapConfirmationStatus(candidate.status),
    source,
    source_url: sourceUrl,
    evidence_id: candidate.evidenceId,
    raw_payload_id: `fixture:${candidate.fixtureFile.fileName}`,
  };

  const score = extractScore(record);
  if (score !== null) fact.score = score;
  if (Number.isFinite(record.pbtc_kg) && record.pbtc_kg > 0) fact.pbtc_kg = record.pbtc_kg;
  if (candidate.value && Object.keys(candidate.value).length > 0) fact.value = candidate.value;

  copyPresent(fact, record, EVIDENCE_FIELDS);
  const freshnessHours = computeFreshnessHours(record, candidate.payload);
  if (freshnessHours !== undefined) fact.freshness_hours = freshnessHours;
  if (fact.collected_at === undefined && candidate.payload?.created_at !== undefined) {
    fact.collected_at = candidate.payload.created_at;
  }
  if (fact.method === undefined) fact.method = 'local_fixture_file';
  if (fact.content_hash === undefined) fact.content_hash = candidate.fixtureFile.contentHash;

  return fact;
}

export function normalizeDimensionFixtures(fixtureFiles, segmentIndex) {
  const evidences = [];
  const facts = [];

  for (const fixtureFile of fixtureFiles) {
    for (const candidate of candidatesFromFixture(fixtureFile, segmentIndex)) {
      evidences.push(baseEvidence(candidate));
      const fact = factFromCandidate(candidate, segmentIndex);
      if (fact) facts.push(fact);
    }
  }

  return { evidences, facts };
}

export function normalizeRelatedNews(payload) {
  if (!isPlainObject(payload) || payload.fixture_kind !== 'related_news') return [];

  return (payload.items ?? [])
    .filter(isPlainObject)
    .map((item, index) => {
      const news = {
        evidence_id: item.id ?? `related_news:${index}`,
        title: item.title ?? null,
        url: item.url ?? null,
        source: item.source ?? item.source_name ?? null,
        source_url: item.source_url ?? item.url ?? null,
        published_at: item.published_at ?? null,
        collected_at: item.collected_at ?? null,
        matched_segments: Array.isArray(item.matched_segments) ? item.matched_segments : [],
        confirmation_status: mapConfirmationStatus(item.confirmation_status),
        blocker: false,
      };

      for (const field of ['route_id', 'segment_id', 'updated_at', 'relevance', 'evidence_role', 'freshness_hours', 'last_valid_at', 'follow_up_url']) {
        if (item[field] !== undefined) news[field] = item[field];
      }

      return news;
    })
    .sort((left, right) => String(left.evidence_id).localeCompare(String(right.evidence_id)));
}

export { DIMENSION_BY_FIXTURE };
