import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(dirname, '../..'),
  outputFileTracingIncludes: {
    '/api/v1/viabilidade': ['../../data/**/*', '../../packages/**/*', '../api/**/*'],
    '/api/v1/fontes': ['../../data/**/*', '../../packages/**/*', '../api/**/*'],
    '/api/v1/noticias': ['../../data/**/*', '../../packages/**/*', '../api/**/*'],
  },
  serverExternalPackages: ['@rotazfm/api', '@rotazfm/contracts', '@rotazfm/domain', '@rotazfm/ingestion'],
  webpack(config) {
    config.resolve.alias['@'] = path.join(dirname, 'src');
    return config;
  },
};

export default nextConfig;
