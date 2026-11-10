# RotaZFM

Plataforma de apoio à decisão de escoamento do Polo Industrial de Manaus, com índice explicável de viabilidade, dashboard e exposição via MCP para agentes de IA.

Trilha: **Logística & Automação — Hack Brasil 2026**

> Status: fase de planejamento e validação. Ainda não há código de produto.

## Documentos principais

- [`Plan.md`](Plan.md) — documento bruto consolidado do projeto.
- [`docs/PRD.md`](docs/PRD.md) — problema, objetivo, MVP e critérios de sucesso.
- [`docs/SPEC.md`](docs/SPEC.md) — requisitos funcionais e modelo de dados inicial.
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — estratégia de testes e aceite.
- [`docs/EXECUTION_BOARD.md`](docs/EXECUTION_BOARD.md) — 4 etapas e divisões por integrante.
- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) — estrutura de pastas e responsabilidades.
- [`docs/PREMORTEM.md`](docs/PREMORTEM.md) — análise de fracasso, riscos e gates de decisão.
- [`docs/PLATFORM_DRAFT.md`](docs/PLATFORM_DRAFT.md) — rascunho da ideia para submissão na plataforma.
- [`docs/TEAM_EXECUTION_PLAN.md`](docs/TEAM_EXECUTION_PLAN.md) — etapas, papéis e divisões do time.
- [`docs/DATA_SOURCES_EVALUATION.md`](docs/DATA_SOURCES_EVALUATION.md) — avaliação de fontes, ferramentas e substituições.
- [`docs/AIHOT_REFERENCE.md`](docs/AIHOT_REFERENCE.md) — referência estrutural oficial do AIHOT.news e limites de reuso.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisões técnicas e de escopo registradas.

## Princípio do MVP

O RotaZFM mede **viabilidade**, não custo. O núcleo é o IAV — Índice de Antecipação de Viabilidade — calculado de forma determinística sobre cinco dimensões:

1. Nível do rio.
2. Previsão de chuva.
3. Volume de tráfego.
4. Qualidade da via.
5. Restrição de peso.

Cada decisão deve mostrar fonte, data, dimensões faltantes e alertas de qualidade do dado.

## Estrutura de dados planejada

```text
fontes públicas → raw_payloads → route_condition_facts → IAV → API/MCP → dashboard
```

## Estado atual

- Nome oficial: **RotaZFM**.
- Repositório público dedicado ao projeto.
- Estrutura inicial de monorepo criada em `apps/`, `packages/`, `data/`, `scripts/` e `tests/`.
- Documentação inicial de PRD, SPEC, plano de testes e execução criada.
- Fase atual: Etapa 1 — fundação e validação de fontes.
- Código do produto ainda não implementado.
