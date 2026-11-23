import { createHash } from 'node:crypto';

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 1_000_000;

const SOURCES = [
  {
    id: 'inmet-previsao-manaus',
    dimension: 'chuva',
    url: 'https://apiprevmet3.inmet.gov.br/previsao/1302603',
    expected: 'json',
  },
  {
    id: 'sgb-sace-amazonas',
    dimension: 'nivel',
    url: 'https://sace.sgb.gov.br/',
    expected: 'html',
  },
  {
    id: 'dnit-pnct-contagem',
    dimension: 'trafego',
    url: 'https://servicos.dnit.gov.br/dadosabertos/dataset/contagem-de-trafego',
    expected: 'html',
  },
  {
    id: 'dnit-icm-pavimento',
    dimension: 'qualidade',
    url: 'https://servicos.dnit.gov.br/dadosabertos/dataset/condicoes-do-pavimento',
    expected: 'html',
  },
];

async function readLimited(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;

  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = MAX_BYTES - size;
    if (value.length > remaining) {
      chunks.push(value.subarray(0, remaining));
      size += remaining;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.length;
  }

  return { body: Buffer.concat(chunks).toString('utf8'), truncated };
}

async function probe(source) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: source.expected === 'json' ? 'application/json,text/html;q=0.8,*/*;q=0.5' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'user-agent': 'RotaZFM-MVP/0.1 validacao-documental',
      },
    });
    const { body, truncated } = await readLimited(response);
    const contentType = response.headers.get('content-type') ?? '';
    const result = {
      id: source.id,
      dimension: source.dimension,
      url: source.url,
      expected: source.expected,
      http_status: response.status,
      ok: response.ok,
      content_type: contentType,
      bytes: Buffer.byteLength(body, 'utf8'),
      truncated,
      duration_ms: Date.now() - started,
      sha256: createHash('sha256').update(body).digest('hex'),
    };

    if (source.expected === 'json') {
      try {
        const parsed = JSON.parse(body);
        result.json_parseable = true;
        result.top_level_keys = Object.keys(parsed).slice(0, 12);
      } catch {
        result.json_parseable = false;
      }
    }

    return result;
  } catch (error) {
    return {
      id: source.id,
      dimension: source.dimension,
      url: source.url,
      expected: source.expected,
      http_status: null,
      ok: false,
      content_type: null,
      bytes: 0,
      truncated: false,
      duration_ms: Date.now() - started,
      sha256: null,
      error: error?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR',
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (const source of SOURCES) {
  results.push(await probe(source));
}

console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  policy: 'GETs publicos minimos; timeout 12s; sem Firecrawl/Alexandria pago; sem credenciais; payload nao e persistido, apenas hash/tamanho',
  sources: results,
}, null, 2));
