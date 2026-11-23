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

Estado em 23/11/2026: lint/test/build passam; `load:local` passou 10/10; `scenarios:run` está em 7/20 com falhas documentadas em `docs/VALIDATION.md` seção 8.

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
- O dashboard guarda a chave da API no servidor e a injeta no proxy; ele não autentica o chamador local. Isso é aceitável apenas para uso local; exposição não-local/Vercel depende de decisão de autenticação do dashboard.
- Não versionar `.env`, tokens ou chaves; em produção, usar variáveis de ambiente do provedor.
- O probe de fontes não persiste payload bruto; grava apenas status, content-type, bytes, SHA-256, duração e parseabilidade.
- Persistência atual é em memória/fixtures; PostgreSQL está especificado em `docs/SDD.md`, mas ainda não implementado.

## Limitações conhecidas da Etapa 6

- Matriz numérica C01–C20 ainda depende de fixtures por cenário com scores, frescor e reason codes alinhados.
- DNIT PNCT/ICM deram timeout a partir da VM; fixtures/fallback permanecem.
- Sensibilidade de pesos ainda não tem runner porque o domínio usa `IAV_WEIGHTS` fixos.
- C20 (`EMPTY_STATE` do dashboard) exige E2E de browser; o runner HTTP só valida assets estáticos.
