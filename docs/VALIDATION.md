# VALIDATION — RotaZFM

Status: validação substituta vigente  
Data: 23/11/2026  
Fonte: `docs/PRD.md`, `docs/SPEC.md`, `docs/SDD.md`, `docs/TEST_PLAN.md`, `docs/EXECUTION_BOARD.md`, `docs/DECISIONS.md`, `.specs/features/rotazfm-mvp/plan.md`

## 1. Validação substituta das entrevistas

Não há gestores do PIM disponíveis para entrevista. Toda validação que antes dependeria de usuário vira pesquisa documental, premissa explícita, fixture, caso verificável ou critério objetivo.

| Pergunta que uma entrevista responderia | Substituto adotado | Critério objetivo |
|---|---|---|
| Gestores sofrem para escolher rota? | Hipótese de problema declarada no PRD/pitch; evidência documental de fontes públicas fragmentadas e regras de PBTC/nível do rio/chuva. | Pitch chama de hipótese se não houver confirmação; demo mostra rastreabilidade de fonte/data/qualidade. |
| Quais dados são confiáveis? | `docs/DATA_SOURCES_EVALUATION.md` + fixtures locais + cenários C01–C20. | Cada dimensão tem fonte primária, fallback ou limitação declarada; C03/C04/C05/C06 passam. |
| Qual limiar de IAV significa viável? | Regra documentada em `docs/SDD.md` e `docs/DECISIONS.md`: `VIAVEL >= 70`, `VIAVEL_COM_RESSALVAS 50..69`, `NAO_VIAVEL < 50` ou bloqueador. | Teste de sensibilidade ±5 pontos documenta se a recomendação muda; nenhuma recomendação depende de número ilustrativo. |
| Dado velho pode ser usado? | Última atualização válida com `freshness_hours`, `last_valid_at` e alerta; dimensão obrigatória velha sem fallback fresco vira `NAO_AVALIAVEL`. | C04 prova que valor velho aparece como evidência de atraso e não sustenta score. |
| Notícia pode bloquear rota? | Não. Notícia é `related_news[]`; bloqueio exige `confirmation_status = CONFIRMADO` e regra explícita. | C07 e C08 provam notícia contextual/confirmada sem bloqueio automático. |
| O caso retrospectivo é real? | Caso candidato com fonte primária, período, definição prévia de resultado ruim e descarte formal se falhar. | Ver seção 4. |

## 2. Premissas explícitas

| Premissa | Default adotado | Critério de validação | Status |
|---|---|---|---|
| Nome do índice | IAV — Índice de Antecipação de Viabilidade | Documentos e contratos usam IAV; nenhum uso ambíguo de IVA em docs novos. | Confirmada por Lucas |
| Rotas do MVP | Exatamente `rota-1-br-319` e `rota-2-fluvial-brasilia` em `data/routes/mvp-routes.json` | Catálogo contém as duas rotas e 7 segmentos cada; C17/C18 cobrem trechos críticos. | Confirmada por Lucas |
| Perfil de carga | `tipo` = `SECA`/`CONTEINERIZADA`; `peso_bruto_total_kg` inteiro `1..60000`; `quantidade_caminhoes` opcional | C09/C10/C11 rejeitam entradas inválidas; C19 testa limite de PBTC. | Confirmada por Lucas |
| Dado ausente/desatualizado | Reusar última observação válida só como evidência de atraso; dimensão obrigatória ausente/velha/conflitante sem fallback fresco => `NAO_AVALIAVEL`, `iav=null` | C03/C04/C05/C06 passam com `missing_data[]` preenchido. | Confirmada por Lucas |
| Fórmula do IAV | Soma ponderada por trecho `0,30/0,25/0,20/0,15/0,10`; rota = `min` dos trechos; bloqueadores prevalecem | Testes unitários de domínio + sensibilidade ±5 antes da entrega. | Confirmada por Lucas |
| Notícias relacionadas | Contextuais, filtradas por rota/trecho, com fonte/data/URL; nunca bloqueiam sem confirmação oficial | C07/C08 passam; `related_news[]` separado de `blockers[]`. | Confirmada por Lucas |
| Firecrawl/Alexandria | Spike controlado para descoberta/filtro; não é fonte primária de dimensão do IAV | Sem `FIRECRAWL_API_KEY`, sistema roda só com fixtures e declara fonte indisponível. | Pendente de spike |
| Deploy | Nenhum deploy público antes da Etapa 7; alvo final Vercel | Nenhum PR/etapa intermediária publica endpoint público. | Confirmada por Lucas |
| Runtime | Node `>=22.18` no plano aprovado para `node:test` com type stripping | `package.json` hoje declara `>=20`; alinhar antes da Etapa 1 terminar. | Pendente |
| Rota inexistente | Hoje modelado como par `origem/destino` sem rota no catálogo => `404 ROUTE_NOT_FOUND` | C12 passa sem campo extra no `IavQuery`. Se Lucas quiser `route_id` opcional, vira mudança de contrato. | Pendente |
| Valores de PBTC | PBTC numérico é fixture até portaria oficial ser confirmada | C02/C19 usam fixtures; Etapa 5 substitui por portaria real ou marca `NAO_CONFIRMADO`. | Pendente |
| IAV numérico exato | Status e `iav=null` são vínculos; valores inteiros em `tests/e2e/scenarios.json` são alvos de fixture até normalizadores serem definidos | Testes primeiro validam status/faltantes/bloqueadores; alvo numérico só depois de normalizadores. | Pendente |

## 3. Critérios objetivos de aprovação

| Validação | Evidência exigida | Critério de aprovação |
|---|---|---|
| Contratos e motor | `npm run test` | Casos unitários de IAV, gates, `min`, PBTC, `NAO_AVALIAVEL`, frescor e conflito passam sem I/O externo. |
| Matriz C01–C20 | `tests/e2e/scenarios.json` + testes E2E futuros | Todos os cenários têm `input`, `fixtures`, `expected_status`, `expected_iav` ou `expected_null`, `expected_blockers[]` e `expected_missing_data[]`; pendentes só com motivo registrado. |
| Lint/build | `npm run lint`, `npm run build` | Saem com código `0` sem depender de serviço externo. |
| MCP | MCP Inspector + testes de contrato | `consultar_viabilidade` valida schema; sem chave `401`; acima de 60 req/min `429` com `retry_after_seconds`; resposta tem `scope_warning`. |
| Dashboard | E2E Playwright futuro | Cobre caminho feliz, erro, `NAO_AVALIAVEL`, fonte indisponível, notícia contextual e C20 vazio; nunca mostra score sem fonte/data/qualidade. |
| Segurança/segredos | `.env.example` e `.gitignore` | Nenhum `.env` ou segredo commitado; respostas e logs não expõem chaves. |
| APIs externas | Fixtures e logs de chamada | Nenhuma chamada paga é necessária para testes; chamadas reais da Etapa 5 são mínimas e registradas. |
| Retrospectivo | `docs/VALIDATION.md` seção 4 | Caso escolhido é reproduzível a partir de `raw_payloads`/fixtures ou é descartado formalmente. |

### Definição prévia de resultado ruim

Resultado ruim está definido antes da análise e invalida a validação se ocorrer:

1. Qualquer cenário C01–C20 falhar sem justificativa documentada.
2. Algum score for exibido sem fonte, data, qualidade do dado ou sem aviso de dado ausente.
3. Notícia sem `CONFIRMADO` aparecer em `blockers[]` ou mudar IAV.
4. `NAO_AVALIAVEL` for tratado como aprovação ou receber `iav` numérico.
5. Teste depender de API paga, credencial real ou serviço externo no caminho crítico.
6. Deploy público acontecer antes da Etapa 7.
7. O caso retrospectivo não puder ser reproduzido a partir de payload bruto/evidência ou exigir dado não oficial para fechar dimensão obrigatória.
8. O IAV mudar de recomendação apenas por ajuste ilustrativo de peso, sem teste de sensibilidade documentado.

## 4. Caso retrospectivo

### Candidato — CAND-RETRO-01: Rota 2 fluvial em evento hidrológico de 2023

- **Por que candidato:** a Rota 2 tem o trecho crítico `r2-s1-fluvial-amazonas`; eventos de cheia/vazante do Amazonas são o caso em que nível do rio e restrição de navegação mais podem mudar a decisão.
- **Fonte primária candidata:** SACE/CPRM ou ANA HidroWebService para nível do rio; Capitania Fluvial/Portaria para restrição confirmada; INMET/DNIT somente se houver série equivalente para chuva/tráfego. Se faltar série histórica, a dimensão fica ausente e o resultado esperado é `NAO_AVALIAVEL`, não score inventado.
- **Período:** a definir na Etapa 5 após confirmar cobertura SACE/ANA para 2023; não usar data ilustrativa no pitch.
- **Resultado ruim pré-definido:** descartar se não houver fonte oficial cobrindo nível do rio na data/período, se a restrição depender de notícia não confirmada, se chuva/tráfego/PBTC não puderem ser reconstruídos ou marcados como faltantes, ou se o resultado não for reproduzível a partir de `raw_payloads`.
- **Saída aceitável:** reproduzir `DecisionSnapshot` com fixtures/payloads reais anonimizados ou registrar descarte formal com motivo.

### Descartado — CAND-RETRO-02: BR-319 terrestre em 2023

- **Motivo do descarte preventivo:** exige simultaneamente série histórica de tráfego DNIT, previsão/observação de chuva equivalente à janela do MVP, qualidade da via e PBTC por portaria. Sem confirmar as quatro fontes antes de analisar, o caso tem alto risco de terminar em `NAO_AVALIAVEL` por lacuna de fonte, não por teste útil do motor.
- **Condição para reabrir:** se a Etapa 5 provar que DNIT, INMET/observação histórica, `precviasBR` e portarias DNIT cobrem o mesmo período e trecho, Lucas pode reabrir como segundo caso.

## 5. Perguntas pendentes para Lucas

1. **Rota inexistente:** manter 404 por par `origem/destino` sem rota no catálogo ou adicionar `route_id` opcional ao `IavQuery`? Recomendação: manter par OD no MVP e só adicionar `route_id` se houver caso de uso real.
2. **Runtime:** o plano aprovado cita Node `>=22.18`, mas `package.json` declara `>=20`. Confirmar a versão mínima antes de criar `packages/contracts`/`domain`.
3. **IAV exato:** os valores inteiros em `tests/e2e/scenarios.json` são alvos de fixture. Confirmar que a Etapa 1 pode calibrar fixtures para esses alvos ou se o aceite deve ser apenas por status/faixa até normalizadores serem definidos.
4. **Retrospectivo:** autorizar Etapa 5 a testar cobertura SACE/ANA 2023 sem chamada paga; se não houver cobertura, registrar descarte formal de CAND-RETRO-01.
