function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function copyIfPresent(target, source, fields) {
  for (const field of fields) {
    if (source[field] !== undefined && source[field] !== null) target[field] = source[field];
  }
  return target;
}

export function buildBlockerEvidenceBlockers({ payload, segmentIndex } = {}) {
  if (!isPlainObject(payload) || payload.fixture_kind !== 'blocker_evidence') return [];
  if (!Array.isArray(payload.items)) return [];

  const blockers = [];
  for (const item of payload.items) {
    if (!isPlainObject(item)) continue;

    const routeId = nonEmptyString(item.route_id);
    const segmentId = nonEmptyString(item.segment_id);
    const type = nonEmptyString(item.type);
    if (!routeId || !segmentId || !type) continue;
    if (!segmentIndex?.get?.(routeId, segmentId)) continue;

    const blocker = {
      route_id: routeId,
      segment_id: segmentId,
      type,
      confirmed: item.confirmed === true,
    };

    if (item.id !== undefined && item.id !== null) blocker.evidence_id = item.id;
    else if (item.evidence_id !== undefined && item.evidence_id !== null) blocker.evidence_id = item.evidence_id;

    copyIfPresent(blocker, item, ['description', 'source', 'source_url', 'effective_from', 'effective_until']);
    blockers.push(blocker);
  }

  return blockers.sort(
    (left, right) =>
      left.route_id.localeCompare(right.route_id) ||
      left.segment_id.localeCompare(right.segment_id) ||
      left.type.localeCompare(right.type) ||
      String(left.evidence_id ?? '').localeCompare(String(right.evidence_id ?? '')),
  );
}
