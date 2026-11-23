# RotaZFM

Plataforma de apoio à decisão de escoamento do Polo Industrial de Manaus, com IAV explicável por trecho, dashboard e exposição via MCP para agentes de IA.

Trilha: **Logística & Automação — Hack Brasil 2026**

> Status: documentação e plano aprovados; código do produto ainda não implementado. Deploy público somente na Vercel e somente na etapa final.

## Documentos principais

- [`Plan.md`](Plan.md) — baseline histórico de 09/11/2026; decisões vigentes estão em `docs/`.
- [`docs/PRD.md`](docs/PRD.md) — problema, objetivo, MVP e critérios de sucesso.
- [`docs/SPEC.md`](docs/SPEC.md) — requisitos funcionais, modelo de dados e contratos.
- [`docs/SDD.md`](docs/SDD.md) — arquitetura, domínio, fontes, evidências, API/MCP, segurança e deploy.
- [`docs/VALIDATION.md`](docs/VALIDATION.md) — validação substituta, premissas, critérios objetivos e caso retrospectivo.
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — matriz C01..C20 e estratégia de testes.
- [`docs/EXECUTION_BOARD.md`](docs/EXECUTION_BOARD.md) — etapas e papéis dos subagents.
- [`docs/SUBAGENT_PROMPTS.md`](docs/SUBAGENT_PROMPTS.md) — prompts executáveis para Samuelson, Maria e Cris.
- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) — estrutura de pastas e responsabilidades.
- [`docs/PREMORTEM.md`](docs/PREMORTEM.md) — análise de fracasso, riscos e gates de decisão.
- [`docs/PLATFORM_DRAFT.md`](docs/PLATFORM_DRAFT.md) — rascunho da ideia para submissão na plataforma.
- [`docs/TEAM_EXECUTION_PLAN.md`](docs/TEAM_EXECUTION_PLAN.md) — detalhe histórico de papéis; quadro vigente está em `EXECUTION_BOARD.md`.
- [`docs/DATA_SOURCES_EVALUATION.md`](docs/DATA_SOURCES_EVALUATION.md) — avaliação de fontes, ferramentas e substituições.
- [`docs/AIHOT_REFERENCE.md`](docs/AIHOT_REFERENCE.md) — referência estrutural oficial do AIHOT.news e limites de reuso.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisões técnicas e de escopo registradas.
- [`.specs/features/rotazfm-mvp/plan.md`](.specs/features/rotazfm-mvp/plan.md) — plano tlc-spec-lean aprovado.

## Princípio do MVP

O RotaZFM mede **viabilidade**, não custo. O núcleo é o **IAV — Índice de Antecipação de Viabilidade** — determinístico, calculado por trecho e consolidado pelo pior trecho. Cada decisão mostra fonte, data, qualidade do dado, bloqueadores, faltantes e notícias contextuais.

Regras centrais:

1. Dado bruto é gravado antes da normalização.
2. Ausência de dado nunca vira aprovação: dimensão obrigatória ausente, velha ou conflitante gera `NAO_AVALIAVEL` sem score numérico.
3. Quando houver fallback, usa-se a última atualização válida com `freshness_hours` e `last_valid_at` visíveis.
4. Bloqueadores confirmados prevalecem sobre qualquer score.
5. Notícia relacionada é contextual e nunca bloqueia sem confirmação oficial.
6. LLM não calcula IAV nem escolhe rota.

## Estrutura de dados planejada

```text
fontes públicas/fixtures → raw_payloads → evidences/facts/news → IAV por trecho → DecisionSnapshot → API/MCP → dashboard
```

## Estado atual

- Nome oficial: **RotaZFM**.
- Índice oficial: **IAV — Índice de Antecipação de Viabilidade**.
- Rotas do MVP: `rota-1-br-319` e `rota-2-fluvial-brasilia`, em `data/routes/mvp-routes.json`.
- Perfil de carga: `SECA` ou `CONTEINERIZADA`, com `peso_bruto_total_kg`.
- Deploy: Vercel somente na etapa final.
- Fase atual: Etapa 1 — contratos, domínio, catálogo e matriz de cenários.
