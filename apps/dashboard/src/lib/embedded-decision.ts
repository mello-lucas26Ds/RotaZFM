import { createHash } from 'node:crypto';
import { buildDecisionInput } from '@rotazfm/ingestion';
import catalogJson from '../../../../data/routes/mvp-routes.json';
import anaBoletim from '../../../../data/fixtures/ana_boletim_river_level.fixture.json';
import rain from '../../../../data/fixtures/rain.fixture.json';
import relatedNews from '../../../../data/fixtures/related_news.fixture.json';
import riverLevel from '../../../../data/fixtures/river_level.fixture.json';
import roadQuality from '../../../../data/fixtures/road_quality.fixture.json';
import routesCatalog from '../../../../data/fixtures/routes.catalog.fixture.json';
import traffic from '../../../../data/fixtures/traffic.fixture.json';
import weightRestrictions from '../../../../data/fixtures/weight_restrictions.fixture.json';

const FIXTURES = [
  ['ana_boletim_river_level.fixture.json', anaBoletim],
  ['rain.fixture.json', rain],
  ['related_news.fixture.json', relatedNews],
  ['river_level.fixture.json', riverLevel],
  ['road_quality.fixture.json', roadQuality],
  ['routes.catalog.fixture.json', routesCatalog],
  ['traffic.fixture.json', traffic],
  ['weight_restrictions.fixture.json', weightRestrictions],
] as const;

function contentHash(payload: unknown) {
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

export const embeddedCatalog = catalogJson;

export const embeddedFixtureFiles = FIXTURES.map(([fileName, payload]) => ({
  fileName,
  filePath: `embedded:${fileName}`,
  rawText: JSON.stringify(payload),
  contentHash: contentHash(payload),
  payload,
}));

type DecisionInputOptions = {
  query?: unknown;
  catalog?: unknown;
  fixtureFiles?: unknown[];
};

const buildInput = buildDecisionInput as (options: DecisionInputOptions) => ReturnType<typeof buildDecisionInput>;

export function buildEmbeddedDecisionInput(query?: unknown) {
  return buildInput({
    query,
    catalog: embeddedCatalog,
    fixtureFiles: embeddedFixtureFiles,
  });
}
