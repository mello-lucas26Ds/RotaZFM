# TEST_PLAN — RotaZFM MVP

Status: plano vigente  
Data: 23/11/2026

## Escopo testado

- Contratos `IavQuery`, `LoadProfile`, `DecisionSnapshot`, `Evidence`, `RelatedNews`.
- Motor determinístico do IAV por trecho e consolidação por `min`.
- Bloqueadores, frescor, conflito, `NAO_AVALIAVEL` e última atualização válida.
- Filtro de notícias relacionadas como evidência contextual.
- API interna, MCP, auth, rate limit e erros.
- Dashboard com estados de erro, `NAO_AVALIAVEL` e notícias.
- Matriz de cenários `C01..C20` com fixtures.

## Escopo não testado no MVP

- Custo real de frete.
- Disponibilidade de caminhão/motorista.
- Eventos políticos, greves ou bloqueios fora das fontes.
- Calibração estatística dos pesos.
- Deploy público antes da etapa final.

## Tipos de teste

| Nível | O que testar | Ferramenta prevista |
|---|---|---|
| Unitário | Fórmula IAV, gates, `min` por trecho, PBTC, `NAO_AVALIAVEL`, frescor, conflito | `node:test` |
| Contrato | Schemas de entrada/saída, rejeição de extras, enums | `node:test` |
| Integração | Coletor → `raw_payloads` → evidência → fato → snapshot | banco local/fixtures |
| MCP | Auth, rate limit, schema, erros 400/401/404/429/503 | MCP Inspector/testes HTTP |
| E2E | Dashboard recebe entrada e mostra decisão/notícias | Playwright |
| Segurança | Sem chave, chave inválida, payload malicioso, rate limit | testes automatizados |
| Smoke | Coleta, motor e MCP rodam com fixtures | script local |
| Sensibilidade | Pesos ±5 pontos; documentar se recomendação muda | script/manual |

## Matriz de cenários C01..C20

A matriz executável fica em `tests/e2e/scenarios.json`. Cada cenário tem `input`, `fixtures`, `expected_status`, `expected_iav` ou `expected_null`, `expected_blockers[]` e `expected_missing_data[]`.

| ID | Cenário | Esperado |
|---|---|---|
| C01 | Consulta válida, duas rotas com dados frescos | `VIAVEL` ou `VIAVEL_COM_RESSALVAS` com IAV numérico |
| C02 | PBTC do trecho crítico menor que `peso_bruto_total_kg` | `NAO_VIAVEL` com blocker de peso |
| C03 | Dimensão obrigatória ausente | `NAO_AVALIAVEL`, `iav = null`, `missing_data[]` preenchido |
| C04 | Dado com `freshness_hours > 24` | valor reutilizado com `last_valid_at` e alerta |
| C05 | Conflito entre fontes oficiais | `CONFLITANTE` → `NAO_AVALIAVEL` na dimensão |
| C06 | Fonte indisponível sem fallback | `503` na borda ou `NAO_AVALIAVEL` no trecho afetado |
| C07 | Notícia relacionada sem confirmação | aparece em `related_news[]`, não em `blockers[]` |
| C08 | Notícia confirmada por fonte oficial | pode virar evidência; ainda exige regra de bloqueio |
| C09 | Entrada com campo extra | `400 INVALID_QUERY` |
| C10 | `data_embarque` fora da janela | `400 INVALID_QUERY` |
| C11 | `peso_bruto_total_kg` fora de `1..60000` | `400 INVALID_QUERY` |
| C12 | Rota fora do catálogo | `404 ROUTE_NOT_FOUND` |
| C13 | MCP sem API key | `401` sem executar coleta/cálculo |
| C14 | MCP com chave inválida | `401` |
| C15 | MCP acima de 60 req/min | `429` com `retry_after_seconds` |
| C16 | Mesmo input + mesmo `rule_version` | mesmo `DecisionSnapshot` |
| C17 | Trecho crítico da BR-319 sem asfalto com chuva forte | rota 1 `NAO_VIAVEL` ou `NAO_AVALIAVEL` conforme fixture |
| C18 | Rota 2 com nível do rio fora da faixa | trecho fluvial bloqueado/`NAO_AVALIAVEL` |
| C19 | Carga `CONTEINERIZADA` com peso no limite do PBTC | decisão muda apenas se PBTC mudar |
| C20 | Dashboard sem dados | mostra estado vazio com orientação, sem score |

## Dados de teste

- Fixtures em `data/fixtures` para cada fonte e cenário.
- Payloads brutos anonimizados quando possível.
- Massa de dados para IAV completo, parcial, inválido, fonte indisponível e notícia contextual.
- `tests/e2e/scenarios.json` é a fonte executável da matriz.

## Critérios de aprovação

- `npm run lint` sem erros.
- `npm run test` sem falhas.
- `npm run build` concluído.
- MCP Inspector valida `consultar_viabilidade`.
- Dashboard E2E cobre caminho feliz, erro, `NAO_AVALIAVEL` e notícia.
- Nenhuma decisão é exibida sem fonte/data/qualidade.
- Validação retrospectiva documental registrada em `docs/VALIDATION.md` ou descarte formal documentado.

## Comandos previstos

Os comandos finais serão ajustados quando a stack mínima for implementada. Base esperada:

```bash
source ~/.nvm/nvm.sh
npm install
npm run lint
npm run test
npm run build
```
