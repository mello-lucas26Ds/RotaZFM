# Dashboard RotaZFM

Dashboard mínimo da Etapa 4. Ele renderiza o `DecisionSnapshot` produzido pela API; não calcula IAV.

## Rodar localmente

Em terminais separados, com Node via nvm:

```bash
source ~/.nvm/nvm.sh
cd /home/ubuntu/repos/RotaZFM

# API (terminal 1)
IAV_MCP_API_KEYS=dev-key npm run start --workspace @rotazfm/api

# Dashboard (terminal 2)
IAV_MCP_API_KEYS=dev-key ROTAZFM_API_URL=http://127.0.0.1:3001 npm run start --workspace @rotazfm/dashboard
```

Abra `http://127.0.0.1:3002`.

O dashboard usa `ROTAZFM_API_URL` para saber onde está a API e reutiliza a primeira chave de `IAV_MCP_API_KEYS` para o proxy `/api/v1/*`. O browser não recebe a chave.

Para expor o dashboard fora de localhost, defina `DASHBOARD_AUTH_TOKEN` e envie `Authorization: Bearer <token>` nas requisições. Sem a variável, o modo atual permanece sem autenticação apenas para uso local.

## Testes

```bash
source ~/.nvm/nvm.sh
npm run test --workspace @rotazfm/dashboard
npm run build --workspace @rotazfm/dashboard
```

## Limites do MVP

- Sem mapa interativo.
- Sem framework frontend/build de assets.
- Sem deploy público; Vercel só na Etapa 7.
