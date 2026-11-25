# Dashboard RotaZFM

Command Center em Next.js 15 (App Router) para o `DecisionSnapshot` do motor IAV. O dashboard não calcula score: ele consulta as rotas serverless `/api/v1/*`, que executam o mesmo domínio determinístico dos pacotes internos com catálogo/fixtures embutidos para deploy serverless.

## Rodar localmente

```bash
source ~/.nvm/nvm.sh
cd /home/ubuntu/repos/RotaZFM
npm install
npm run dev --workspace @rotazfm/dashboard
```

Abra `http://127.0.0.1:3000`.

## Variáveis

- `DASHBOARD_AUTH_TOKEN`: Bearer token exigido nas chamadas `/api/v1/*`; sem ele a página abre, mas os dados não carregam.
- `IAV_MCP_API_KEYS`: chaves operacionais também aceitas pelas rotas serverless, separadas por vírgula.
- `IAV_WEIGHTS_JSON`: override opcional dos pesos do IAV.

O token é digitado no navegador e enviado apenas como `Authorization: Bearer` para as rotas do próprio app.

## Verificação

```bash
npm run lint --workspace @rotazfm/dashboard
npm run test --workspace @rotazfm/dashboard
npm run build --workspace @rotazfm/dashboard
```

Os testes legados de `src/server.js` continuam cobrindo o runner C20; a interface de produção é o App Router em `src/app`.
