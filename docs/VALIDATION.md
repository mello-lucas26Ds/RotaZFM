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
| Fórmula do IAV | v2 determinística por modo: hidro/multimodal `0,30×nivel_efetivo + 0,25×chuva + 0,20×trafego + 0,15×qualidade + 0,10×restricao`; rodoviário renormaliza chuva/tráfego/qualidade/restrição; `nivel_efetivo = nivel - min(5; 0,10 × max(0; 50 - chuva))`; rota = `min` dos trechos; bloqueadores prevalecem | Testes unitários de domínio + sensibilidade ±5 antes da entrega. | Revisada por Lucas em 23/11/2026 |
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

**Resultado da Etapa 5:** CAND-RETRO-01 descartado formalmente. Não há cobertura oficial confirmada para todas as dimensões obrigatórias no mesmo período sem ANA autorizada/Firecrawl pago; tentar reproduzir terminaria em `NAO_AVALIAVEL` por lacuna de fonte, não por teste útil do motor. Detalhes na seção 7.

### Descartado — CAND-RETRO-02: BR-319 terrestre em 2023

- **Motivo do descarte preventivo:** exige simultaneamente série histórica de tráfego DNIT, previsão/observação de chuva equivalente à janela do MVP, qualidade da via e PBTC por portaria. Sem confirmar as quatro fontes antes de analisar, o caso tem alto risco de terminar em `NAO_AVALIAVEL` por lacuna de fonte, não por teste útil do motor.
- **Condição para reabrir:** se a Etapa 5 provar que DNIT, INMET/observação histórica, `precviasBR` e portarias DNIT cobrem o mesmo período e trecho, Lucas pode reabrir como segundo caso.

## 5. Perguntas pendentes para Lucas

1. **Rota inexistente:** manter 404 por par `origem/destino` sem rota no catálogo ou adicionar `route_id` opcional ao `IavQuery`? Recomendação: manter par OD no MVP e só adicionar `route_id` se houver caso de uso real.
2. **Runtime:** o plano aprovado cita Node `>=22.18`, mas `package.json` declara `>=20`. Confirmar a versão mínima antes de criar `packages/contracts`/`domain`.
3. **IAV exato:** os valores inteiros em `tests/e2e/scenarios.json` são alvos de fixture. Confirmar que a Etapa 1 pode calibrar fixtures para esses alvos ou se o aceite deve ser apenas por status/faixa até normalizadores serem definidos.
4. **Retrospectivo:** autorizar Etapa 5 a testar cobertura SACE/ANA 2023 sem chamada paga; se não houver cobertura, registrar descarte formal de CAND-RETRO-01.

## 6. Evidências documentais da Etapa 1 — fontes, fixtures e pendências

Escopo executado: validação documental e fixtures, sem implementação de IAV/API/MCP/dashboard e sem chamadas pagas a Firecrawl/Alexandria/routekit. Custo desta etapa: R$0.

### 6.1 Trechos críticos validados

| Trecho | Evidência documental | Status | Observação |
|---|---|---|---|
| `r1-s2-floresta-br319` — BR-319 Careiro da Várzea → Porto Velho | RIMA DNIT indica segmento km 250,7–656,4, extensão 405,7 km, municípios Borba, Beruri, Manicoré, Tapauá, Canutama e Humaitá; notícias DNIT de 2026 confirmam Lote C km 198,2–218,2 e manutenção/conservação. | CONFIRMADO | Trecho crítico com extenso trecho não pavimentado; obras pontuais não devem ser generalizadas. |
| `r2-s1-fluvial-amazonas` — Manaus → Belém/Barcarena | SGB/SAH monitora estações em Itacoatiara, Parintins, Óbidos, Almeirim e Careiro; notícias de seca/vazante e operação portuária contextualizam o trecho. | CONFIRMADO | Leitura específica de Santarém/Breves ficou como lacuna; operacionalidade depende de calado, terminais e avisos. |
| PBTC/restrições BR-319 | Portaria 5.455/2022 e Portaria 13/2025 confirmadas em página DNIT/DOU; AET temporárias 10/2026 localizadas por UF. | PARCIAL | Sobreposição de regras exige confirmação da vigência consolidada; regra conservadora adotada nas fixtures. |

### 6.2 Fontes mínimas por dimensão

| Dimensão | Fonte primária | Verificação | Status | Fallback |
|---|---|---|---|---|
| Nível do rio | SGB/SAH Amazonas — `https://sace.sgb.gov.br/` | 23/11/2026 | CONFIRMADO | último valor válido com atraso; ANA futura após autorização |
| Chuva | INMET direto — `https://apiprevmet3.inmet.gov.br/previsao/{geocodigo}` | 23/11/2026 | CONFIRMADO | scraping INMET via Firecrawl somente com custo/limite registrado |
| Tráfego | DNIT PNCT/dados abertos — `https://servicos.dnit.gov.br/dadosabertos/dataset/contagem-de-trafego` | 23/11/2026 | PARCIAL | tabela estática datada; BR-319/AM sem contagem atual confirmada |
| Qualidade da via | DNIT ICM — `https://servicos.dnit.gov.br/dadosabertos/dataset/condicoes-do-pavimento` + RIMA BR-319 | 23/11/2026 | PARCIAL | valor fixo documentado; SP-330 e trecho fluvial sem fonte terrestre confirmada |
| Restrição de peso | Portarias DNIT/DOU — Portaria 5.455/2022 e Portaria 13/2025 | 23/11/2026 | PARCIAL | tabela estática "não verificada"; regra conservadora em sobreposição |
| Notícias relacionadas | Busca documental + fontes oficiais/noticiosas | 23/11/2026 | PARCIAL | fixtures locais; Firecrawl/Alexandria só para descoberta/filtro contextual |

### 6.3 Fixtures criadas

| Arquivo | Conteúdo | Uso esperado |
|---|---|---|
| `data/fixtures/routes.catalog.fixture.json` | Snapshot dos IDs de rotas/trechos críticos a partir de `data/routes/mvp-routes.json` | Testes de contrato RF-001 sem duplicar catálogo canônico |
| `data/fixtures/river_level.fixture.json` | Leituras SGB/SAH, lacunas Santarém/Breves e cenários mock de vazante/baixa | Testar dimensão nível do rio, frescor e `NAO_AVALIAVEL` |
| `data/fixtures/rain.fixture.json` | Previsões INMET por geocódigo para Manaus, Humaitá, Porto Velho, Itacoatiara, Parintins, Santarém, Almeirim, Óbidos e Belém | Testar dimensão chuva sem scraping |
| `data/fixtures/traffic.fixture.json` | Cobertura PNCT por segmento, com status e fallback; sem VMD inventado | Testar `NAO_AVALIAVEL`/fallback e pendência de extração DNIT |
| `data/fixtures/road_quality.fixture.json` | BR-319 não pavimentado confirmado; ICM pendente; SP-330 e fluvial sem fonte terrestre | Testar qualidade da via e exceções modais |
| `data/fixtures/weight_restrictions.fixture.json` | Portarias 5.455/2022 e 13/2025, AET 10/2026 e conflito conservador | Testar bloqueio PBTC e sobreposição sazonal |
| `data/fixtures/related_news.fixture.json` | Notícias/contextos por rota/trecho, incluindo itens expirados/parciais | Testar `related_news[]` contextual, nunca bloqueador sem confirmação |

Validação executada: todos os JSONs foram parseados com `python -m json.tool` e passaram. Nos fixtures, `confirmation_status` segue o enum de RF-004 (`CONFIRMADO | NAO_CONFIRMADO | CONFLITANTE | INDISPONIVEL | EXPIRADO | NAO_AVALIAVEL`); os status documentais `PARCIAL`/`NÃO_ENCONTRADO` ficam em `source_status`, `coverage` ou notas de lacuna.

### 6.4 Firecrawl/Alexandria — avaliação sem chamadas pagas

- **Pode ajudar:** descoberta de fontes oficiais, leitura de páginas/PDFs difíceis e filtro de notícias por rota/trecho.
- **Não pode ser fonte primária do IAV:** saída precisa ser normalizada em `raw_payloads`/`route_condition_facts` e confirmada por fonte oficial quando a dimensão exigir.
- **Limites registrados:** Firecrawl cobra créditos por endpoint; Search = 2 créditos/10 resultados, Scrape = 1 crédito/página; planos variam. Alexandria tem discovery gratuito, execução por preço da tool e pode exigir aceite de termos por provider/admin. Acesso keyless não inclui Alexandria.
- **Termos:** termos Firecrawl revisados em 07/10/2026; providers terceiros podem impor termos adicionais.
- **Custo/limite desta etapa:** nenhuma chamada paga realizada; custo R$0. Qualquer spike futuro deve registrar créditos estimados, endpoint, provider e fallback antes de executar.

### 6.5 Perguntas adicionais da Etapa 1

1. **PBTC BR-319:** a Portaria 5.455/2022 continua vigente para km 250,7–679,3 em paralelo à Portaria 13/2025, ou existe ato posterior que a revoga/substitui? Até confirmação, podemos adotar a regra conservadora documentada na fixture?
2. **Tráfego BR-319/AM:** existe fonte atual confiável de contagem de tráfego para o trecho florestal, ou devemos aceitar explicitamente `NAO_AVALIAVEL`/fallback estático não verificado para essa dimensão no MVP?
3. **Nível do rio:** quais estações e limites operacionais devem ser usados para classificar navegabilidade Manaus–Belém? SACE/SGB fornece nível, mas o MVP precisa de threshold ou referência de calado/terminal.
4. **Notícias:** quais fontes noticiosas são aceitas como contexto oficial do projeto e há orçamento/conta Firecrawl prevista para spike controlado de filtro de notícias?

### 6.6 Riscos e pendências da Etapa 1

- Extração de linhas específicas dos CSVs DNIT de tráfego e ICM ainda está pendente; por isso tráfego e qualidade da via estão `PARCIAL`.
- SP-330 é rodovia estadual e pode ficar fora do escopo DNIT; precisa fonte estadual ou fallback documentado.
- O trecho fluvial não tem dimensão "qualidade da via" terrestre; é necessário decidir se usa proxy de navegabilidade ou trata como N/A no IAV.
- Na VM do subagent de dados, Node/npm não estavam disponíveis; os JSONs foram validados localmente. Na VM orquestradora, `npm install`, `npm run lint`, `npm run test` e `npm run build` passam sem serviço externo.

## 7. Evidências da Etapa 5 — probe de fontes e retrospectivo

Data: 23/11/2026. Escopo: chamadas externas mínimas e gratuitas; nenhuma chamada paga Firecrawl/Alexandria; payloads não são persistidos, apenas hash/tamanho. Script: `scripts/probe-sources.mjs` (`npm run sources:probe`); resultado: `docs/source-probes/2026-11-23.json`.

| Fonte | Dimensão | Resultado do probe | Decisão |
|---|---|---|---|
| INMET previsão Manaus | chuva | HTTP 200, JSON parseável, 236.567 bytes | CONFIRMADO para fixture/fallback; valor numérico ainda depende de normalizador. |
| SGB/SACE | nível | HTTP 200, HTML 12.132 bytes em `https://sace.sgb.gov.br/` | CONFIRMADO endpoint; série histórica 2023 não validada. |
| DNIT PNCT contagem | tráfego | `FETCH_ERROR`/timeout a partir da VM | Mantém fixture/fallback; extração PNCT segue pendente. |
| DNIT ICM pavimento | qualidade | `FETCH_ERROR`/timeout a partir da VM | Mantém fixture/fallback; extração ICM segue pendente. |
| Portarias DNIT/DOU | restrição | Sem chamada nova; evidência documental anterior mantida | Mantém regra conservadora e conflito BR-319 documentado. |

Firecrawl/Alexandria: nenhuma chamada paga nesta etapa. Permanecem discovery/filtro de notícias; não são fonte primária de IAV. Retrospectivo: CAND-RETRO-01 descartado formalmente conforme seção 4; CAND-RETRO-02 permanece descartado. Critério de resultado ruim atendido: nenhum score retrospectivo foi inventado.

## 8. Evidências da Etapa 6 — matriz C01–C20 executável

Data: 23/11/2026. Script: `scripts/run-scenarios.mjs` (`npm run scenarios:run`). O runner executa `tests/e2e/scenarios.json` contra API/MCP/dashboard locais e grava relatório em `test-results/e2e-scenarios.json` (diretório gitignored).

Resultado nesta rodada: **7/20 passaram, 1 pendente (`pending_browser_e2e`), 12 falharam**. Passaram C09–C15, que cobrem contrato de entrada, data fora da janela, peso inválido, rota inexistente, auth MCP e rate limit. C20 é reportado como `pending_browser_e2e`: o runner HTTP continua validando `GET /` e `/app.js`, mas `EMPTY_STATE` exige evidência de browser (E2E/Playwright) que ainda não existe. Falharam C01–C08 e C16–C19 porque as fixtures lógicas da matriz ainda não foram materializadas com `score`, frescor e bloqueadores por cenário (`fixture_fallback_default`).

Alinhamentos desta rodada:

- `expected_missing_data` em `tests/e2e/scenarios.json` passou a usar as dimensões do IAV (`nivel`, `chuva`, `trafego`, `qualidade`, `restricao`) e os reason codes reais do domínio (`AUSENTE`, `CONFLITANTE`, `DESATUALIZADO`, `FRESCOR_AUSENTE`, `SCORE_AUSENTE`, `PBTC_AUSENTE`, `FORA_DE_VIGENCIA` ou `confirmation_status`). Reason codes públicos mais ricos (ex.: `SOURCE_UNAVAILABLE_NO_FALLBACK`) ficam como pendência de contrato, sem mudança no domínio.
- A ingestão aceita `fixture_kind: "blocker_evidence"` com `items[]` genéricos e emite blockers explícitos no formato do domínio (`route_id`, `segment_id`, `type`, `confirmed`, `description`, `source`, `source_url`, `evidence_id`, `effective_from`, `effective_until`); `CONFIRMED_RESTRICTION` aparece como `confirmed_restriction` no runner. O PBTC atual permanece inalterado.

Implicação: o runner está pronto e determinístico, mas a matriz numérica só fecha depois que Maria materializar fixtures por cenário. Persistência PostgreSQL (`raw_payloads`, `evidences`, `route_condition_facts`, `iav_calculations`, `decision_snapshots`) segue como pendência de decisão antes do deploy.

## 9. Evidências da Etapa 6 — carga local e runbook

Data: 23/11/2026. Script: `scripts/load-test.mjs` (`npm run load:local`). O teste sobe a API local e dispara 10 chamadas simultâneas a `POST /v1/viabilidade` com a mesma query válida.

Resultado: **10/10 chamadas OK**, 0 falhas, elapsed ~90 ms, duração por chamada min ~38 ms, p50 ~57 ms, max ~74 ms na VM local. Isso valida o critério de "10 chamadas simultâneas sem erro" para a carga de referência do MVP; não substitui teste com dados reais externos.

Runbook operacional criado em `docs/RUNBOOK.md` com comandos, variáveis (`IAV_MCP_API_KEYS`, `API_PORT`, `MCP_PORT`, `DASHBOARD_PORT`, `ROTAZFM_API_URL`), endpoints e limites de segurança. Revisão de segurança da Etapa 6: API/MCP têm Bearer auth, rate limit por chave e limite de corpo; dashboard injeta a chave no proxy server-side e ainda não autentica o chamador, portanto exposição não-local/Vercel depende de decisão explícita.
