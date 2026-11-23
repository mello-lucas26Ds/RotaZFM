import { DEFAULT_CATALOG_PATH, buildSegmentIndex, loadCatalog } from './catalog.js';
import { DEFAULT_FIXTURE_DIR, loadFixtureFiles } from './fixtures.js';
import { normalizeDimensionFixtures, normalizeRelatedNews } from './normalize.js';
import { buildPbtcBlockers } from './restrictions.js';

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function sortEvidences(evidences) {
  return evidences.sort(
    (left, right) =>
      compareText(left.fixture_file, right.fixture_file) ||
      compareText(left.dimension, right.dimension) ||
      compareText(left.route_id, right.route_id) ||
      compareText(left.segment_id, right.segment_id) ||
      compareText(left.evidence_id, right.evidence_id),
  );
}

function sortFacts(facts) {
  return facts.sort(
    (left, right) =>
      compareText(left.route_id, right.route_id) ||
      compareText(left.segment_id, right.segment_id) ||
      compareText(left.dimension, right.dimension) ||
      compareText(left.evidence_id, right.evidence_id),
  );
}

export function buildDecisionInput({
  fixtureDir = DEFAULT_FIXTURE_DIR,
  catalogPath = DEFAULT_CATALOG_PATH,
  query,
} = {}) {
  const fixtureFiles = loadFixtureFiles(fixtureDir);
  const catalog = loadCatalog(catalogPath);
  const segmentIndex = buildSegmentIndex(catalog);

  const rawPayloads = fixtureFiles.map((fixtureFile) => ({
    raw_payload_id: `fixture:${fixtureFile.fileName}`,
    source: `data/fixtures/${fixtureFile.fileName}`,
    source_url: null,
    collected_at: fixtureFile.payload?.created_at ?? null,
    method: 'local_fixture_file',
    content_hash: fixtureFile.contentHash,
    payload: fixtureFile.payload,
  }));

  const evidences = [];
  const facts = [];
  const relatedNews = [];
  const blockers = [];

  for (const fixtureFile of fixtureFiles) {
    const payload = fixtureFile.payload;
    if (!payload || typeof payload !== 'object') continue;

    if (payload.fixture_kind === 'related_news') {
      relatedNews.push(...normalizeRelatedNews(payload));
      continue;
    }

    if (payload.fixture_kind !== 'dimension_evidence') continue;

    const normalized = normalizeDimensionFixtures([fixtureFile], segmentIndex);
    evidences.push(...normalized.evidences);
    facts.push(...normalized.facts);

    if (payload.dimension === 'weight_restriction') {
      blockers.push(...buildPbtcBlockers({ payload, query, segmentIndex }));
    }
  }

  return {
    catalog,
    rawPayloads,
    evidences: sortEvidences(evidences),
    facts: sortFacts(facts),
    blockers,
    relatedNews,
  };
}
