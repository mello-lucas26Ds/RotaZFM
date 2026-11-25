# @rotazfm/mcp

Servidor MCP mínimo do RotaZFM, sem dependências externas.

## Escopo

- `POST /mcp` com JSON-RPC 2.0.
- Métodos: `initialize`, `ping`, `tools/list`, `tools/call`.
- Única tool: `consultar_viabilidade`, com o mesmo `IavQuery`/`DecisionSnapshot` da API e `scope_warning`.
- Auth Bearer via `IAV_MCP_API_KEYS` e rate limit de 60 req/min por chave.

## Limitações do MVP

Transporte mínimo compatível com Streamable HTTP: apenas POST JSON estático. Não há SSE/GET stream, `Mcp-Session-Id`, resume de stream nem progresso de notificações. Clientes devem aceitar `application/json`.

## Execução

```bash
source ~/.nvm/nvm.sh
IAV_MCP_API_KEYS=chave1,chave2 MCP_PORT=3002 npm run start --workspace @rotazfm/mcp
```
