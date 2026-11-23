function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function monthOf(dateValue) {
  if (typeof dateValue !== 'string') return null;
  const month = Number(dateValue.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function applicableLimitsTonnes(rules, month) {
  const limits = [];
  const novMay = [11, 12, 1, 2, 3, 4, 5];
  const junOct = [6, 7, 8, 9, 10];
  const decJun = [12, 1, 2, 3, 4, 5, 6];

  if (novMay.includes(month) && Number.isFinite(rules.pbtc_max_t_nov_may)) {
    limits.push(rules.pbtc_max_t_nov_may);
  }
  if (junOct.includes(month) && Number.isFinite(rules.pbtc_max_t_jun_oct)) {
    limits.push(rules.pbtc_max_t_jun_oct);
  }
  if (decJun.includes(month) && Number.isFinite(rules.pbtc_max_t_dec_jun)) {
    limits.push(rules.pbtc_max_t_dec_jun);
  }

  return limits;
}

function segmentKey(routeId, segmentId) {
  return `${routeId}\u0000${segmentId}`;
}

function copyIfPresent(target, source, fields) {
  for (const field of fields) {
    if (source[field] !== undefined && source[field] !== null) target[field] = source[field];
  }
  return target;
}

export function buildPbtcBlockers({ payload, query, segmentIndex }) {
  if (!isPlainObject(payload) || payload.dimension !== 'weight_restriction') return [];
  if (!isPlainObject(query?.carga) || !Number.isInteger(query.carga.peso_bruto_total_kg)) return [];

  const month = monthOf(query.data_embarque);
  if (month === null) return [];

  const weightKg = query.carga.peso_bruto_total_kg;
  const candidates = new Map();

  for (const record of payload.restrictions ?? []) {
    if (!isPlainObject(record)) continue;
    if (record.confirmation_status !== 'CONFIRMADO') continue;
    if (!record.route_id || !record.segment_id) continue;
    if (!isPlainObject(record.rules)) continue;

    const segment = segmentIndex.get(record.route_id, record.segment_id);
    if (!segment) continue;

    const limits = applicableLimitsTonnes(record.rules, month);
    if (limits.length === 0) continue;

    const pbtcKg = Math.round(Math.min(...limits) * 1000);
    if (!Number.isFinite(pbtcKg) || pbtcKg <= 0) continue;

    const candidate = {
      route_id: record.route_id,
      segment_id: record.segment_id,
      pbtc_kg: pbtcKg,
      evidence_id: record.id ?? null,
      source: record.source ?? null,
      source_url: record.source_url ?? record.source_urls?.[0] ?? null,
      effective_from: record.effective_from ?? null,
      effective_until: record.effective_until ?? null,
      legal_instrument: record.legal_instrument ?? record.rules?.legal_instrument ?? null,
    };

    const key = segmentKey(candidate.route_id, candidate.segment_id);
    const current = candidates.get(key);
    const candidateTie = candidate.evidence_id ?? '';
    const currentTie = current?.evidence_id ?? '';
    if (
      !current ||
      candidate.pbtc_kg < current.pbtc_kg ||
      (candidate.pbtc_kg === current.pbtc_kg && candidateTie < currentTie)
    ) {
      candidates.set(key, candidate);
    }
  }

  const blockers = [];
  for (const candidate of candidates.values()) {
    if (weightKg <= candidate.pbtc_kg) continue;

    const blocker = {
      route_id: candidate.route_id,
      segment_id: candidate.segment_id,
      type: 'PBTC',
      confirmed: true,
      description: 'PESO_BRUTO_TOTAL_EXCEDE_PBTC',
      weight_kg: weightKg,
      pbtc_kg: candidate.pbtc_kg,
    };

    copyIfPresent(blocker, candidate, ['source', 'source_url', 'evidence_id', 'effective_from', 'effective_until']);
    blockers.push(blocker);
  }

  return blockers.sort(
    (left, right) =>
      left.route_id.localeCompare(right.route_id) ||
      left.segment_id.localeCompare(right.segment_id) ||
      left.type.localeCompare(right.type),
  );
}
