# Quadro de execução — RotaZFM

Status: plano vigente de 8 etapas  
Data: 23/11/2026  
Fonte principal: `.specs/features/rotazfm-mvp/plan.md`, `docs/SDD.md`, `docs/DECISIONS.md`

## Papéis do time

Samuelson, Maria e Cris são **subagents/papéis operacionais**, não pessoas reais. Lucas é o responsável humano pela validação final e orquestração.

| Papel | Tipo | Foco principal |
|---|---|---|
| Samuelson | subagent operacional | Produto, validação documental, matriz de cenários, decisões de corte, pitch e submissão |
| Maria | subagent operacional | Fontes, evidências, fixtures, rotas/trechos, frescor, conflito, notícias relacionadas |
| Cris | subagent operacional | Contratos, domínio, IAV, persistência, API, MCP, auth, rate limit e testes de contrato |
| Lucas | humano/orquestrador | Aprova decisões, revisa PR, valida aceite final e autoriza deploy |

Prompts de tarefa por papel estão em `docs/SUBAGENT_PROMPTS.md`.

## Regras de trabalho

- Trabalhar sempre em branch + PR; não commitar direto na `main`.
- Cada etapa termina com evidência de validação, não apenas código escrito.
- Must antes de Should/Could/Won’t.
- Nenhum score sem fonte, data e qualidade do dado.
- Nenhum LLM calcula IAV ou escolhe rota.
- Decisões importantes entram em `docs/DECISIONS.md`.
- Não há entrevistas com gestores; toda validação dependente de usuário vira pesquisa documental, fixture, premissa explícita ou caso verificável.
- Deploy público somente na Vercel e somente na etapa final.

## Etapa 0 — Congelar decisões e validação substituta

- **Objetivo:** eliminar ambiguidades antes de codar.
- **Tarefa:** revisar PRD/SPEC/SDD/DECISIONS; confirmar IAV, rotas, carga, política de dado ausente, notícias, Alexandria/Firecrawl e deploy Vercel final; registrar validação substituta em `docs/VALIDATION.md`.
- **Subagent/responsável:** Samuelson propõe; Lucas aprova.
- **Dependências:** decisões de Lucas já registradas.
- **Validação:** documentos sem dependência de entrevista; toda premissa tem critério objetivo.
- **Critério de aceite:** nenhuma etapa posterior depende de "entrevistar gestor"; hipóteses de problema declaradas como hipóteses.

## Etapa 1 — Domínio, contratos e matriz de cenários

- **Objetivo:** congelar o que o sistema deve fazer antes de coletores ou API.
- **Tarefa:** criar `packages/contracts`, `packages/domain` puros, `data/routes/mvp-routes.json`, `tests/e2e/scenarios.json` e testes unitários do motor com fixtures.
- **Subagent/responsável:** Cris implementa domínio/contratos; Maria valida rotas/fontes; Samuelson valida cenários/aceite; Lucas revisa.
- **Dependências:** Etapa 0 aprovada.
- **Validação:** `npm run test` real no pacote; mesma entrada + mesmo `rule_version` = mesmo resultado; motor sem I/O externo.
- **Critério de aceite:** cenários C01–C20 cobertos por testes ou marcados pendentes com motivo; `NAO_AVALIAVEL` sem score numérico.

## Etapa 2 — Evidências, frescor, conflito e notícias

- **Objetivo:** transformar fontes/fixtures em fatos auditáveis sem calcular IAV.
- **Tarefa:** implementar `packages/ingestion` com `raw_payloads` → evidências → fatos; frescor, última atualização, conflito e filtro de notícias relacionadas.
- **Subagent/responsável:** Maria nos coletores/fixtures/notícias; Cris nos contratos/persistência.
- **Dependências:** Etapa 1.
- **Validação:** testes de integração locais; falha de fonte gera fallback/alerta; notícia nunca bloqueia sem confirmação.
- **Critério de aceite:** payload bruto gravado antes da normalização; fatos têm fonte, URL, datas, método, hash, confiança e efeito.

## Etapa 3 — API interna e MCP

- **Objetivo:** expor a decisão de forma segura e rastreável.
- **Tarefa:** implementar `apps/api` e `apps/mcp` com `consultar_viabilidade`, auth Bearer, rate limit, erros e `DecisionSnapshot`.
- **Subagent/responsável:** Cris; Lucas valida contrato de consumo.
- **Dependências:** Etapas 1–2.
- **Validação:** MCP Inspector, testes de contrato/segurança, mesma entrada+snapshot = mesma saída.
- **Critério de aceite:** resposta nunca contém apenas `iav`/`viavel`; agente não altera regras nem contorna bloqueadores.

## Etapa 4 — Dashboard consumindo a mesma decisão

- **Objetivo:** tornar a decisão legível sem duplicar regra.
- **Tarefa:** implementar `apps/dashboard` com formulário de consulta, rotas/trechos, IAV ou `NAO_AVALIAVEL`, bloqueadores, evidências, faltantes, frescor e notícias.
- **Subagent/responsável:** Lucas; Maria fornece fixtures; Cris mantém contrato.
- **Dependências:** Etapa 3 ou contrato estável com fixtures.
- **Validação:** E2E cobre caminho feliz, erro, dado ausente, fonte indisponível e rota não avaliável.
- **Critério de aceite:** dashboard não calcula IAV; todo score vem com fonte/data/qualidade ou status `NAO_AVALIAVEL`.

## Etapa 5 — Fontes reais controladas e retrospectivo documental

- **Objetivo:** provar coleta real sem desperdiçar chamadas.
- **Tarefa:** validar SACE/INMET/DNIT/portarias com amostras mínimas; testar Firecrawl/Alexandria para notícias; escolher ou descartar caso retrospectivo com critérios prévios e registrar o resultado em `docs/VALIDATION.md`.
- **Subagent/responsável:** Maria executa; Samuelson registra decisões de corte; Cris revisa contratos.
- **Dependências:** Etapas 1–4 com fixtures estáveis.
- **Validação:** cada fonte tem endpoint/página, exemplo, data, status, fallback e termos; chamadas externas mínimas e logadas.
- **Critério de aceite:** pelo menos três fontes têm fixture/fallback; retrospectivo reproduzível ou descarte formal documentado.
- **Status 23/11/2026:** probe controlado executado em `docs/source-probes/2026-11-23.json`; INMET e SGB responderam, DNIT deu timeout na VM; CAND-RETRO-01 descartado formalmente; Firecrawl/Alexandria seguem sem chamada paga.

## Etapa 6 — Integração, hardening e documentação

- **Objetivo:** fechar qualidade e evidências antes do deploy.
- **Tarefa:** rodar matriz C01–C20, testes de carga local, sensibilidade de pesos, README/runbook, revisão de segurança e pitch sem números ilustrativos.
- **Subagent/responsável:** todos os papéis; Samuelson coordena aceite; Lucas fecha documentação.
- **Dependências:** Etapas 1–5.
- **Validação:** lint/test/build verdes; 10 chamadas simultâneas sem erro na meta; fontes falhando não derrubam o sistema.
- **Critério de aceite:** nenhuma feature Could/Won’t entrou no caminho crítico; limites declarados.
- **Status 24/11/2026:** `npm run scenarios:run` passou **20/20** após materialização das fixtures C01–C20, `confirmed_restriction`, pesos injetáveis/documentados e auth do dashboard. `npm run load:local` passou 10/10 chamadas simultâneas. E2E de browser via Playwright validou `EMPTY_STATE` sem score. PostgreSQL foi adiado formalmente em `DEC-023`; detalhes em `docs/VALIDATION.md` seções 8–9 e `docs/RUNBOOK.md`.

## Etapa 7 — Deploy final na Vercel e entrega

- **Objetivo:** publicar uma única versão final.
- **Tarefa:** configurar Vercel, `NEXT_PUBLIC_API_URL`, variáveis de ambiente, smoke público e submissão.
- **Subagent/responsável:** Lucas aprova; Cris prepara API/MCP portável; Samuelson fecha submissão.
- **Dependências:** Etapa 6 aprovada por Lucas.
- **Validação:** deploy público responde; demo fora da rede local; plano B gravado.
- **Critério de aceite:** deploy acontece uma vez, na Vercel, após aprovação explícita.

## Sequência imediata

1. Etapas 0–6 concluídas no código/documentação: decisões congeladas, contratos/domínio/testes, fixtures/ingestão, auditoria de cobertura, API interna, MCP, dashboard integrado ao `DecisionSnapshot`, probe de fontes, retrospectivo descartado, matriz C01–C20, load local, runbook, auth do dashboard e nível do rio via boletim ANA gov.br/PDF.
2. Próxima: revisão do PR #1 e correções de review; deploy final Vercel (Etapa 7) somente com aprovação explícita.
3. Pitch/submissão final permanece na entrega da hackathon.
4. Samuelson mantém matriz C01–C20 e decisões de corte; Maria cobre lacunas de fixtures/fontes.
5. Lucas revisa cada PR e só autoriza deploy na Etapa 7.
