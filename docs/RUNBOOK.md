# Runbook local — RotaZFM

## Pré-requisitos

- Node.js >= 20 via `nvm`.
- Dependências instaladas com `npm install` na raiz do monorepo.

## Comandos de verificação

```bash
npm run lint
npm run test
npm run build
npm run load:local       # 10 chamadas simultâneas em POST /v1/viabilidade
npm run scenarios:run    # matriz C01–C20; relatório em test-results/e2e-scenarios.json
npm run sources:probe    # probe externo opt-in; saída deve ser redirecionada para docs/source-probes/
```

Estado em 24/11/2026: lint/test/build passam; `load:local` passou 10/10; `scenarios:run` passou 20/20; E2E de browser validou `EMPTY_STATE`; detalhes em `docs/VALIDATION.md` seções 7–9.

## Subir serviços locais

API (porta padrão 3001):

```bash
IAV_MCP_API_KEYS=troque-esta-chave npm run start --workspace @rotazfm/api
```

MCP (porta padrão 3002):

```bash
IAV_MCP_API_KEYS=troque-esta-chave npm run start --workspace @rotazfm/mcp
```

Dashboard (use porta diferente quando MCP estiver no ar; padrão do dashboard é 3002):

```bash
ROTAZFM_API_URL=http://127.0.0.1:3001 DASHBOARD_PORT=3003 npm run start --workspace @rotazfm/dashboard
```

Variáveis relevantes:

- `IAV_MCP_API_KEYS`: chaves Bearer aceitas pela API e pelo MCP; o dashboard reutiliza a primeira chave para o proxy server-side.
- `DASHBOARD_AUTH_TOKEN`: Bearer token opcional que protege `/api/*` do dashboard; sem a variável, o proxy fica aberto apenas para uso local. Os assets estáticos ficam públicos e o front pede o token em memória quando a API responde `DASHBOARD_UNAUTHORIZED`.
- `IAV_WEIGHTS_JSON`: override JSON opcional para experimentos de sensibilidade dos pesos do IAV; API e MCP leem a mesma variável e o `rule_version` ganha fingerprint quando os pesos mudam.
- `FIRECRAWL_API_KEY`: opcional para descoberta/filtro de notícias; sem ela, o sistema usa fixtures e declara fonte indisponível.
- `API_PORT`/`PORT` e `HOST`: escuta da API.
- `MCP_PORT`/`PORT` e `HOST`: escuta do MCP.
- `DASHBOARD_PORT`/`PORT` e `HOST`: escuta do dashboard.
- `ROTAZFM_API_URL`: URL base da API usada pelo proxy do dashboard.

## Endpoints

- API: `POST /v1/viabilidade`, `GET /v1/fontes`, `GET /v1/noticias`.
- MCP: `POST /mcp` com JSON-RPC `initialize`, `tools/list` e `tools/call consultar_viabilidade`.
- Dashboard: `GET /` e proxy `/api/v1/*` para a API.

## Segurança operacional

- API e MCP exigem `Authorization: Bearer <chave>`; rate limit de 60 requisições/minuto por chave e corpo limitado a 64 KiB.
- O dashboard deixa assets estáticos públicos e protege `/api/*` com `DASHBOARD_AUTH_TOKEN` quando configurado; o token fica apenas em memória no navegador e a chave da API continua injetada somente no proxy server-side.
- Não versionar `.env`, tokens ou chaves; em produção, usar variáveis de ambiente do provedor.
- O probe de fontes não persiste payload bruto; grava apenas status, content-type, bytes, SHA-256, duração e parseabilidade/fallback.
- Persistência atual é stateless/em memória com fixtures; PostgreSQL está adiado formalmente em `DEC-023`.

## Limitações conhecidas da Etapa 6

- Matriz C01–C20 está fechada em 20/20; E2E de browser do `EMPTY_STATE` foi validado via Playwright.
- DNIT PNCT/ICM deram timeout/`FETCH_ERROR` a partir da VM; fixtures/fallback permanecem e o probe registra warning por fonte.
- Pesos do IAV são injetáveis por `IAV_WEIGHTS_JSON` na API/MCP e documentados em `docs/pesos.md`; não há runner dedicado de sensibilidade neste PR.
- Nível do rio usa boletim ANA gov.br/PDF via `scripts/extract-ana-boletim.py`; não há credencial ANA.
