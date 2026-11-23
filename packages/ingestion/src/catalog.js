import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_CATALOG_PATH = fileURLToPath(
  new URL('../../../data/routes/mvp-routes.json', import.meta.url),
);

const HYDRO_MODES = new Set(['hidroviario', 'multimodal']);

export function loadCatalog(path = DEFAULT_CATALOG_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function segmentKey(routeId, segmentId) {
  return `${routeId}\u0000${segmentId}`;
}

export function buildSegmentIndex(catalog) {
  const byKey = new Map();
  const bySegmentId = new Map();

  for (const route of catalog.routes ?? []) {
    for (const segment of route.segments ?? []) {
      const entry = {
        routeId: route.id,
        segmentId: segment.id,
        mode: segment.mode,
        road: segment.road ?? null,
        critical: segment.critical === true,
      };
      byKey.set(segmentKey(route.id, segment.id), entry);
      if (!bySegmentId.has(segment.id)) bySegmentId.set(segment.id, entry);
    }
  }

  return {
    get(routeId, segmentId) {
      return byKey.get(segmentKey(routeId, segmentId)) ?? null;
    },
    findBySegmentId(segmentId) {
      return bySegmentId.get(segmentId) ?? null;
    },
    isHydroMode(mode) {
      return HYDRO_MODES.has(mode);
    },
  };
}
