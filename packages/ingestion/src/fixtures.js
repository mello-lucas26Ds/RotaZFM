import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_FIXTURE_DIR = fileURLToPath(
  new URL('../../../data/fixtures', import.meta.url),
);

function sha256(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

export function loadFixtureFiles(fixtureDir = DEFAULT_FIXTURE_DIR) {
  return readdirSync(fixtureDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => {
      const filePath = join(fixtureDir, fileName);
      const rawText = readFileSync(filePath, 'utf8');
      return {
        fileName,
        filePath,
        rawText,
        contentHash: sha256(rawText),
        payload: JSON.parse(rawText),
      };
    });
}
