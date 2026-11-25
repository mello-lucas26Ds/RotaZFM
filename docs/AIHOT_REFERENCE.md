# Referência — AIHOT.news / KKKKhazix/AIHOT

Status: referência estrutural oficial e base de direcionamento; spike de reuso de código pendente
Data: 09/11/2026
Repositório: https://github.com/KKKKhazix/AIHOT  
Commit inspecionado: `ad3e934d376e4399ce350d981b4b5eb7a61f860e`

## Como usar no RotaZFM

O AIHOT.news passa a ser a referência arquitetural oficial do projeto. Toda pessoa nova deve ler este documento antes de propor mudanças de estrutura.

Use o AIHOT para:

- entender separação entre API, worker e web;
- comparar camadas de ingestão, domínio, publicação e apresentação;
- avaliar se uma nova dependência ou processo se justifica;
- manter decisões de arquitetura documentadas.

Não copie do AIHOT:

- scoring editorial por LLM;
- clustering de notícias;
- geração de reports/newsletter;
- prompts e taxonomias de curadoria;
- qualquer lógica que faça LLM calcular IAV ou escolher rota.

## O que é

AIHOT é um framework open source, licença MIT, para criar sites de tópicos quentes/curadoria por indústria. Ele coleta fontes, filtra com LLM, pontua conteúdos, agrupa eventos, calcula popularidade e publica newsletters/digest.

Stack observada:

- Node.js 24
- TypeScript
- npm workspaces
- Fastify API
- worker com pg-boss
- React Router SSR web
- PostgreSQL 17
- Docker Compose
- MCP e API pública

## Estrutura observada

Arquitetura em três processos:

| Processo | Caminho | Papel |
|---|---|---|
| api | `apps/api/` | Fastify: site API, public API, RSS, MCP, admin, imagens, share images |
| worker | `apps/worker/` | pg-boss: coleta, modelos, agrupamento, heat, newsletters, alertas, limpeza |
| web | `apps/web/` | React Router SSR; só fala HTTP com api |

Pacotes e áreas relevantes:

| Caminho | Conteúdo |
|---|---|
| `packages/backend/src/sources/` | leitores de fontes RSS/web/JSON/X/WeChat/external |
| `packages/backend/src/content/` | ingestão, deduplicação, extração/limpeza de conteúdo |
| `packages/backend/src/editorial/` | análise editorial: prefilter, scoring, títulos, resumos, estrutura |
| `packages/backend/src/events/` | agrupamento de eventos, heat, story digest |
| `packages/backend/src/publication/` | camada única de leitura pública |
| `packages/backend/src/reports/` | daily/weekly/monthly |
| `packages/backend/src/providers/` | providers pagos, receipts, budget circuit breaker |
| `apps/web/app/routes/` | uma rota por página |
| `site/` | identidade do site, modelos, marca, páginas, arquivos públicos |
| `industry/` | taxonomia, tópicos, fontes, prompts, thresholds |
| `modules/` | funcionalidades específicas do site como módulos isolados |
| `database/migrations/` | migrations versionadas |

## Pontos fortes para referência

- Separação clara entre API, worker e web.
- Banco PostgreSQL + fila de tarefas.
- Camada pública única para web/RSS/API/MCP.
- MCP já aparece como superfície pública.
- Módulos isolados permitem adicionar funcionalidade sem mexer no núcleo.
- Docker Compose facilita subir ambiente local.
- Regras de segurança operacional e testes são explícitas.

## Incompatibilidades com RotaZFM

O AIHOT resolve um problema diferente: curadoria e escrita de notícias com LLM. O RotaZFM precisa de:

- coleta de dados públicos estruturados;
- normalização e validação de séries temporais;
- motor determinístico de viabilidade;
- grafo/segmentos de rota;
- cálculo de IAV com dimensões, fontes, datas e guardrails;
- MCP de consulta operacional;
- dashboard de decisão.

Portanto, não devemos copiar prompts, scoring editorial, clustering, reports de notícias ou fluxo de conteúdo. O próprio `Plan.md` já determina que LLM não calcula score nem escolhe rota.

## Veredito

**AIHOT é base de direcionamento e referência estrutural oficial do RotaZFM.**

Recomendação:

1. Usar AIHOT como mapa mental de arquitetura para todas as próximas decisões.
2. Fazer um spike de até 2 dias somente para avaliar reuso real de código.
3. Se o spike mostrar que é preciso remover scoring LLM, clustering, reports e prompts para chegar ao RotaZFM, manter AIHOT como referência e não como base de código.
4. Se houver reuso claro, congelar commit e não depender de atualização upstream durante o hackathon.

## Estrutura de referência adotada

Enquanto o spike de reuso não aprovar código do AIHOT, o RotaZFM segue a estrutura simplificada documentada em `docs/PROJECT_STRUCTURE.md`:

```text
apps/
  api/          # API interna, ingestão/orquestração e persistência
  mcp/          # servidor MCP para agentes de IA
  dashboard/    # dashboard do gestor
packages/
  contracts/    # tipos e schemas compartilhados
  domain/       # regras puras do IAV e viabilidade
  ingestion/    # coletores e normalizadores
```

O AIHOT inspira a separação entre superfícies e pacotes, mas o MVP não precisa de worker editorial, reports de notícias, prompts de curadoria ou clustering. Jobs simples ficam em `scripts/` ou na infraestrutura da API até surgir necessidade real de um processo worker separado.
