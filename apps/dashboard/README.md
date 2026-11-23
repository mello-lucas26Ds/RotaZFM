# @rotazfm/dashboard

Dashboard mínimo do RotaZFM: página única vanilla + proxy same-origin para a API. Não calcula IAV; só renderiza o `DecisionSnapshot`.

## Como subir

```bash
source ~/.nvm/nvm.sh
IAV_MCP_API_KEYS=chave1,chave2 API_PORT=3001 npm run start --workspace @rotazfm/api
DASHBOARD_PORT=3003 npm run start --workspace @rotazfm/dashboard
```

Abra `http://127.0.0.1:3003`. A API key é digitada no painel e fica só em `sessionStorage` da aba (nunca em `localStorage` nem em logs). O proxy `/v1/*` encaminha `Authorization` para `API_URL`/`NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:3001`).

## Escopo

- Formulário: origem, destino, data de embarque, tipo de carga, peso bruto total e quantidade de caminhões.
- Renderiza rotas, status, IAV ou `sem score objetivo`, `worst_segment_id`, trechos, blockers, missing_data, evidências e related_news, além de `rule_version`, `catalog_version` e `scope_warning`.
- Estados: loading, erro 400/401/404/429/500/502, `NAO_AVALIAVEL`, `NAO_VIAVEL` e estado inicial vazio.

## Fora do escopo

Deploy, framework, mapa, E2E/Playwright e qualquer cálculo de score no cliente.
