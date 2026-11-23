# Estrutura do repositório — RotaZFM

Status: estrutura vigente  
Data: 23/11/2026

## Princípio

O repositório é um monorepo simples em Node.js/TypeScript. A divisão por apps e packages evita microserviços prematuros, mas separa claramente frontend, API, MCP e regras de negócio.

## Árvore vigente

```text
RotaZFM/
  apps/
    api/                  # API interna e ingestão/orquestração
    mcp/                  # servidor MCP para agentes de IA
    dashboard/            # dashboard web do gestor
  packages/
    contracts/            # tipos/schemas compartilhados do contrato IAV
    domain/               # regras puras: IAV por trecho, bloqueadores, NAO_AVALIAVEL
    ingestion/            # coletores, normalizadores e filtro de notícias
  data/
    routes/               # catálogo versionado das rotas/trechos do MVP
    fixtures/             # payloads e respostas mockadas para testes/dev
  scripts/                # comandos operacionais: iav, collect, seed, smoke
  tests/
    e2e/                  # cenários C01..C20 e testes ponta a ponta
  docs/                   # PRD, SPEC, SDD, plano, decisões, evidências e prompts
  .specs/                 # artefatos tlc-spec-lean do plano aprovado
  .env.example            # variáveis necessárias, sem segredos
```

## Responsabilidades

| Área | Dono principal | Conteúdo esperado |
|---|---|---|
| `packages/contracts` | Cris | Tipos e schemas de `IavQuery`, `LoadProfile`, `DecisionSnapshot`, `Evidence`, `RelatedNews` |
| `packages/domain` | Cris | Cálculo determinístico do IAV por trecho, gates, bloqueadores e `NAO_AVALIAVEL` |
| `packages/ingestion` | Maria | Coleta, parsing, normalização, frescor, conflito e notícias relacionadas |
| `apps/api` | Cris | Persistência, casos de uso e endpoints internos |
| `apps/mcp` | Cris | Exposição MCP, API key, rate limit e resposta estruturada |
| `apps/dashboard` | Lucas | Interface do gestor, trechos, IAV/`NAO_AVALIAVEL`, evidências e notícias |
| `data/routes` | Maria + Lucas | Catálogo versionado das duas rotas e segmentos aprovados |
| `data/fixtures` | Maria + Lucas | Fixtures reais anonimizadas/mockadas para testes e UI |
| `scripts` | Lucas | Automação local de coleta, cálculo, seed e smoke test |
| `tests/e2e` | Samuelson + Lucas | Matriz C01..C20 e fluxos completos dashboard + API/MCP |
| `docs` | Samuelson + time | Escopo, especificação, SDD, decisões, evidências e runbooks |

## Regras de dependência

- `packages/domain` não depende de banco, HTTP ou framework.
- `packages/contracts` não depende de implementação.
- `packages/ingestion` pode depender de `contracts`, mas não de `domain`.
- `apps/api` orquestra ingestion/domain e persiste dados.
- `apps/mcp` consome API/casos de uso; não recalcula IAV por conta própria.
- `apps/dashboard` consome somente API/contratos; nunca acessa banco direto.

## Relação com AIHOT.news

A estrutura atual é uma versão simplificada inspirada no AIHOT.news, mas adaptada ao RotaZFM:

- `apps/api`, `apps/mcp` e `apps/dashboard` separam superfícies de leitura e decisão.
- `packages/contracts`, `packages/domain` e `packages/ingestion` separam contrato, regra pura e coleta.
- Não copiamos scoring editorial, clustering, reports de notícias ou prompts de curadoria.
- Worker/jobs podem evoluir depois; no MVP, scripts e tarefas simples bastam.

Referência completa: `docs/AIHOT_REFERENCE.md`.

## O que ainda não existe

Esta estrutura é propositalmente inicial. Ainda não há código de produto implementado. A primeira implementação deve começar por `packages/contracts`, `packages/domain`, `data/routes/mvp-routes.json` e fixtures — não pelo dashboard.
