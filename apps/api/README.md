# @rotazfm/api

API interna do RotaZFM (MVP local, sem deploy).

## Rotas

- `POST /v1/viabilidade` — body `IavQuery`; retorna `DecisionSnapshot`.
- `GET /v1/fontes` — evidências normalizadas das fixtures.
- `GET /v1/noticias` — `related_news` contextual (nunca blocker).

Todas exigem `Authorization: Bearer <key>` com chaves em `IAV_MCP_API_KEYS` (separadas por vírgula). Limite: 60 req/min por chave.

## Erros

`400 INVALID_QUERY`, `401 UNAUTHORIZED`, `404 ROUTE_NOT_FOUND`/`NOT_FOUND`, `413 PAYLOAD_TOO_LARGE`, `429 RATE_LIMITED` com `retry_after_seconds`, `503 DECISION_UNAVAILABLE` quando não há snapshot.

## Execução

```bash
source ~/.nvm/nvm.sh
IAV_MCP_API_KEYS=chave1,chave2 API_PORT=3001 npm run start --workspace @rotazfm/api
```
