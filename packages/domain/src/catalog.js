import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ROUTE_CATALOG_PATH = fileURLToPath(
  new URL('../../../data/routes/mvp-routes.json', import.meta.url),
);

export function loadRouteCatalog(path = DEFAULT_ROUTE_CATALOG_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
