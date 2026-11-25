import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let cachedCatalogPath = null;

export function getDefaultRouteCatalogPath() {
  if (cachedCatalogPath === null) {
    const catalogRelativePath = '../../../data/routes/' + 'mvp-routes.json';
    cachedCatalogPath = fileURLToPath(new URL(catalogRelativePath, import.meta.url));
  }
  return cachedCatalogPath;
}

export function loadRouteCatalog(path = getDefaultRouteCatalogPath()) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
