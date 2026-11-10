# Quadro de execução — RotaZFM

Status: plano inicial de 4 etapas  
Data: 09/11/2026  
Fonte principal: `Plan.md` v3 e `docs/TEAM_EXECUTION_PLAN.md`

## Papéis do time

| Integrante | Papel | Foco principal |
|---|---|---|
| Samuelson | Produto, validação e pitch | Regulamento, entrevistas, caso retrospectivo, decisões de corte, roteiro e submissão |
| Maria | Dados e fontes | SACE, INMET, DNIT, portarias, qualidade da via, fixtures e validação histórica |
| Cris | Motor, API e MCP | Contratos, schema, IAV, API, autenticação, rate limit e MCP |
| Lucas | Frontend, demo e qualidade | Estrutura do projeto, dashboard, mapa, contrato visual, E2E e documentação de execução |

Se alguém trocar de papel, atualizar este quadro e `docs/TEAM_EXECUTION_PLAN.md` no mesmo PR.

## Regras de trabalho

- Trabalhar sempre em branch + PR; não commitar direto na `main`.
- Cada etapa termina com evidência de validação, não apenas código escrito.
- Must antes de Should/Could/Won’t.
- Nenhum score sem fonte, data e qualidade do dado.
- Nenhum LLM calcula IAV ou escolhe rota.
- Decisões importantes entram em `docs/DECISIONS.md`.
- Bloqueio pendente há mais de 24h deve ser escalado para o time.

## Etapa 1 — Fundação e validação de fontes

Objetivo: sair do papel com repositório estruturado, fontes testadas e contratos iniciais definidos.

| Integrante | Entrega | Como validar |
|---|---|---|
| Lucas | Scaffold do monorepo, scripts base, estrutura de pastas, `.gitignore` e validação estrutural do AIHOT.news | `git status` limpo após commit; estrutura revisada em PR; gaps do AIHOT documentados |
| Maria | Teste manual/automatizado de SACE, INMET, DNIT e portarias; amostras e fallbacks documentados | Cada fonte tem endpoint, exemplo de payload, data e status go/no-go |
| Cris | Contratos iniciais de `Route`, `RouteSegment`, `RawPayload`, `RouteConditionFact` e `IavCalculation` | Tipos/schema revisados pelo time; exemplos JSON válidos |
| Samuelson | Regulamento confirmado, entrevistas marcadas e definição do caso retrospectivo | Documento com prazos, responsáveis e critério de “resultado ruim” |

**Decisão transversal — AIHOT.news:** Cris valida a viabilidade técnica como base; Lucas valida se a estrutura observada serve ao RotaZFM. A saída deve atualizar `docs/DECISIONS.md` com uma de três decisões: base, referência ou descarte. Referência inicial: `docs/AIHOT_REFERENCE.md`.

Critério de saída da Etapa 1:

- Repositório tem estrutura mínima versionada.
- Três fontes principais têm resposta real ou fallback documentado.
- O time sabe exatamente quais dados entram no `route_condition_facts`.
- O caso retrospectivo está escolhido ou descartado formalmente.

## Etapa 2 — Ingestão e normalização

Objetivo: transformar fontes públicas em fatos normalizados e auditáveis.

| Integrante | Entrega | Como validar |
|---|---|---|
| Maria | Coletores de nível do rio, chuva, tráfego e tabelas estáticas de qualidade/peso | Cada coletor grava `raw_payloads` e publica fatos com fonte/data/qualidade |
| Cris | Schema PostgreSQL, repositórios e persistência de payload bruto | Migração local sobe; registros têm origem, timestamp e hash |
| Lucas | Fixtures e massa de dados para dashboard/MCP | UI consegue renderizar IAV parcial, completo e erro sem backend real |
| Samuelson | Checklist de proveniência e critérios de aceite dos dados | Cada dimensão tem fonte, data de referência e fallback declarado |

Critério de saída da Etapa 2:

- Pelo menos três fontes gravam dado bruto.
- Fatos normalizados respeitam o contrato da Etapa 1.
- Falha de fonte gera alerta/último valor válido, não quebra o fluxo.
- Fixtures permitem desenvolver frontend sem depender das APIs externas.

## Etapa 3 — Motor de decisão, API e MCP

Objetivo: transformar fatos em IAV explicável e expor a decisão por API/MCP.

| Integrante | Entrega | Como validar |
|---|---|---|
| Cris | Motor determinístico do IAV, guardrails, API interna e servidor MCP local | Testes unitários passam; MCP Inspector responde `consultar_viabilidade` |
| Maria | Regras de qualidade dos dados: frescor, variação atípica, dado ausente e fonte indisponível | Casos de borda cobertos por testes e fixtures |
| Lucas | Cliente/consumidor do contrato de IAV para o dashboard | Tipos/fixtures atualizados; estados de loading, erro e IAV parcial previstos |
| Samuelson | Checklist de segurança e aceite funcional | 401 sem API key, entrada inválida rejeitada, justificativa auditável |

Critério de saída da Etapa 3:

- `npm run iav` ou equivalente imprime IAV determinístico das duas rotas.
- IAV fica entre 0 e 100; dimensão ausente gera IAV parcial declarado.
- Restrição de peso excedida torna a rota inviável.
- MCP local funciona com API key e rejeita chamada sem chave.

## Etapa 4 — Dashboard, deploy e entrega

Objetivo: transformar o fluxo técnico em demo pública e submissão completa.

| Integrante | Entrega | Como validar |
|---|---|---|
| Lucas | Dashboard com origem, destino, data, mapa, IAV, dimensões, fontes e alertas | E2E passa; usuário vê resultado em menos de 2s na meta |
| Cris | Deploy do MCP na Cloudflare, API key, rate limit e fallback documentado | Endpoint público responde em menos de 3s; teste sem chave retorna 401 |
| Maria | Validação final das fontes, frescor dos dados e runbook de fallback | Rodada final mostra quais dados são atuais, defasados ou indisponíveis |
| Samuelson | Relatório retrospectivo, roteiro, gravação, edição e submissão | Pitch sem claims não validados; submissão feita até 28/11 |

Critério de saída da Etapa 4:

- Fluxo completo funciona de ponta a ponta fora da máquina local.
- 10 chamadas simultâneas ao MCP não geram erro.
- Dashboard e MCP mostram fonte, data e qualidade do dado.
- README final explica arquitetura, como rodar, fontes e limites.

## Sequência imediata — por onde começar

1. **Lucas** confirma esta estrutura de pastas e abre o primeiro PR de scaffold.
2. **Maria** testa SACE, INMET e DNIT/portarias e registra amostras reais ou bloqueios.
3. **Cris** transforma os contratos em tipos/schema inicial para `route_condition_facts`.
4. **Samuelson** confirma regulamento, marca entrevistas e define o caso retrospectivo.

Depois disso, o time entra na Etapa 2 em paralelo, respeitando a dependência: frontend consome fixtures/contratos, não espera scraping perfeito.
