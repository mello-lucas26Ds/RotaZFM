# Estrutura do repositório — RotaZFM

Status: estrutura inicial  
Data: 09/11/2026

## Princípio

O repositório começa como monorepo simples em Node.js/TypeScript. A divisão por apps e packages evita microserviços prematuros, mas separa claramente frontend, API, MCP e regras de negócio.

## Árvore inicial

```text
RotaZFM/
  apps/
    api/                  # API interna e ingestão/orquestração
      src/
        presentation/     # rotas HTTP, controllers, DTOs
        application/      # casos de uso e orquestração
        infrastructure/   # banco, HTTP clients, workers
      tests/
    mcp/                  # servidor MCP para agentes de IA
      src/
      tests/
    dashboard/            # dashboard web do gestor
      src/
      tests/
  packages/
    contracts/            # tipos/schemas compartilhados do contrato IAV
    domain/               # regras puras: IAV, guardrails, fórmulas
    ingestion/            # coletores e normalizadores de fontes públicas
  data/
    fixtures/             # payloads e respostas mockadas para testes/dev
  scripts/                # comandos operacionais: iav, collect, seed, smoke
  tests/
    e2e/                  # testes ponta a ponta do dashboard/MCP
  docs/                   # PRD, SPEC, plano, decisões e evidências
```

## Responsabilidades

| Área | Dono principal | Conteúdo esperado |
|---|---|---|
| `packages/contracts` | Cris | Tipos e schemas de rotas, fatos, payloads e resultado do IAV |
| `packages/domain` | Cris | Cálculo determinístico do IAV e regras de viabilidade |
| `packages/ingestion` | Maria | Coleta, parsing, normalização e qualidade dos dados |
| `apps/api` | Cris | Persistência, casos de uso e endpoints internos |
| `apps/mcp` | Cris | Exposição MCP, API key, rate limit e resposta estruturada |
| `apps/dashboard` | Lucas | Interface do gestor, mapa, justificativa e estados de erro |
| `data/fixtures` | Maria + Lucas | Fixtures reais anonimizadas/mockadas para testes e UI |
| `scripts` | Lucas | Automação local de coleta, cálculo, seed e smoke test |
| `tests/e2e` | Lucas | Fluxos completos dashboard + API/MCP |
| `docs` | Samuelson + time | Escopo, especificação, decisões, evidências e runbooks |

## Regras de dependência

- `packages/domain` não depende de banco, HTTP ou framework.
- `packages/contracts` não depende de implementação.
- `packages/ingestion` pode depender de `contracts`, mas não de `domain`.
- `apps/api` orquestra ingestion/domain e persiste dados.
- `apps/mcp` consome API/casos de uso; não recalcula IAV por conta própria.
- `apps/dashboard` consome somente API/contratos; nunca acessa banco direto.

## O que ainda não existe

Esta estrutura é propositalmente inicial. Não há código de produto, dependências externas, migrations ou telas implementadas. A primeira implementação deve começar pelos contratos e pela persistência mínima, não pelo dashboard.
