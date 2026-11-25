import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedFixtureDir = null;
export function getDefaultFixtureDir() {
  if (cachedFixtureDir === null) {
    const fixtureRelativePath = '../../../data/' + 'fixtures';
    cachedFixtureDir = fileURLToPath(new URL(fixtureRelativePath, import.meta.url));
  }
  return cachedFixtureDir;
}

function sha256(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

export function loadFixtureFiles(fixtureDir = getDefaultFixtureDir()) {
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
