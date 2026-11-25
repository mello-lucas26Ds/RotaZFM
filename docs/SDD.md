# SDD — RotaZFM MVP

Status: desenho técnico vigente  
Data: 23/11/2026

## 1. Arquitetura de alto nível

O MVP é um monorepo modular Node.js/TypeScript. Não há microserviços reais no MVP; as fronteiras existem para permitir extração futura sem reescrever o domínio.

```text
fontes públicas / fixtures
  → raw_payloads
  → evidences + route_condition_facts + related_news
  → packages/domain (IAV por trecho, bloqueadores, NAO_AVALIAVEL)
  → DecisionSnapshot
  → apps/api / apps/mcp / apps/dashboard
```

Regra central: **o domínio não conhece Firecrawl, Cloudflare, Next.js, PostgreSQL, Vercel ou MCP.** Ele recebe fatos normalizados e devolve decisão determinística.

## 2. Componentes e responsabilidades

| Componente | Responsabilidade | Não faz |
|---|---|---|
| `packages/contracts` | Validar `IavQuery`, `LoadProfile`, `DecisionSnapshot`, `Evidence`, `RelatedNews` | Coletar, calcular ou persistir |
| `packages/domain` | Calcular IAV por trecho, consolidar rota por `min`, aplicar bloqueadores e `NAO_AVALIAVEL` | Acessar rede, banco ou framework |
| `packages/ingestion` | Coletar fontes, gravar bruto, normalizar evidências, filtrar notícias | Calcular IAV ou escolher rota |
| `apps/api` | Orquestrar consulta, carregar catálogo, persistir snapshots, expor HTTP interno | Recalcular regra de domínio |
| `apps/mcp` | Expor `consultar_viabilidade` com auth/rate limit | Ter regra própria de IAV |
| `apps/dashboard` | Renderizar `DecisionSnapshot` e notícias contextuais | Calcular IAV ou acessar banco |
| `data/routes` | Catálogo versionado das duas rotas/trechos | Ser consultado por request externo |
| `data/fixtures` | Payloads e fatos para testes/dev sem depender de fonte externa | Ser fonte de produção |

## 3. Modelo de domínio

Entidades mínimas:

- `Route`: corredor candidato (`rota-1-br-319`, `rota-2-fluvial-brasilia`).
- `RouteSegment`: trecho com `from`, `to`, `road`, `mode`, `critical`.
- `LoadProfile`: `tipo` (`SECA`/`CONTEINERIZADA`), `peso_bruto_total_kg`, `quantidade_caminhoes?`.
- `Evidence`: fonte, URL, datas, método, hash, confirmação, janela de validade.
- `Observation`: valor bruto normalizado de uma evidência para uma dimensão/trecho.
- `RuleSet`: pesos, limiares e versão das regras.
- `SegmentAssessment`: IAV e status de um trecho.
- `RouteAssessment`: pior trecho, IAV consolidado, bloqueadores, faltantes.
- `DecisionSnapshot`: resposta completa e auditável de uma consulta.

Invariantes:

- `RouteAssessment.status = NAO_AVALIAVEL` se qualquer dimensão obrigatória do pior trecho estiver ausente, velha além do limite ou `CONFLITANTE`.
- `RouteAssessment.iav = min(SegmentAssessment.iav)` somente quando todos os trechos têm IAV numérico; caso contrário `iav = null`.
- Bloqueador confirmado prevalece sobre qualquer score.
- Notícia é `RelatedNews`, nunca `Blocker`, sem `confirmation_status = CONFIRMADO`.

## 4. Cálculo do IAV no MVP

Para cada trecho, cada dimensão aplicável é convertida em score `0..100` por normalizadores específicos. A composição do MVP é soma ponderada com gates. Dimensões obrigatórias dependem do modo do trecho: `hidroviario`/`multimodal` usam as cinco dimensões; `rodoviario` usa chuva, tráfego, qualidade e restrição, com peso renormalizado.

```text
IAV_hidro/multimodal = 0,30 × nivel_efetivo + 0,25 × chuva + 0,20 × trafego + 0,15 × qualidade + 0,10 × restricao
IAV_rodoviario = (0,25 × chuva + 0,20 × trafego + 0,15 × qualidade + 0,10 × restricao) / 0,70

nivel_efetivo = nivel - min(5; 0,10 × max(0; 50 - chuva))
```

`nivel_efetivo` só existe para trechos hidroviários/multimodais: chuva forte reduz o nível efetivo em até 5 pontos por risco de cheia/entulho; não premia estiagem nem substitui o dado de nível. O `nivel` bruto continua preservado na evidência.

Classificação por trecho:

| Status | Regra proposta |
|---|---|
| `VIAVEL` | IAV >= 70 e nenhum bloqueador |
| `VIAVEL_COM_RESSALVAS` | 50 <= IAV < 70 e nenhum bloqueador |
| `NAO_VIAVEL` | IAV < 50 ou bloqueador confirmado |
| `NAO_AVALIAVEL` | dimensão obrigatória ausente, velha ou conflitante |

Política de composição:

- Dimensão ausente não entra como zero; ela marca `missing_data[]` e pode levar a `NAO_AVALIAVEL`.
- Dimensão com `freshness_hours > 24` é marcada como defasada; a última observação válida aparece com `last_valid_at` e alerta. Se a dimensão for obrigatória e não houver fallback mais fresco, o trecho vira `NAO_AVALIAVEL` sem IAV numérico.
- Conflito entre fontes oficiais vira `CONFLITANTE` e `NAO_AVALIAVEL` para aquela dimensão.
- A fórmula é decisão de produto documentada em `docs/DECISIONS.md`; teste de sensibilidade ±5 pontos é obrigatório antes da entrega.

## 5. Catálogo de rotas

Fonte única: `data/routes/mvp-routes.json`.

- Rota 1: `rota-1-br-319`, ~3.850 km, 7 segmentos, críticos: balsa inicial e BR-319 floresta.
- Rota 2: `rota-2-fluvial-brasilia`, ~4.400 km equivalentes, 7 segmentos, crítico: trecho fluvial Amazonas.

O catálogo é versionado por `version` e não deve ser alterado sem atualização de `rule_version`/fixtures.

## 6. Evidências, frescor e conflito

Campos obrigatórios de evidência: `source`, `source_url`, `published_at`, `collected_at`, `method`, `content_hash`, `confirmation_status`, `effective_from`, `effective_until`.

Regras:

- `raw_payloads` é gravado antes de qualquer normalização.
- `content_hash` deduplica payload idêntico.
- `freshness_hours` é calculado contra a data de referência do dado, não contra `collected_at`.
- `last_valid_at` é exibido quando o valor é reutilizado.
- Conflito oficial → `CONFLITANTE`; notícia não oficial → no máximo `NAO_CONFIRMADO`.

## 7. Fontes e coleta

| Dimensão | Primária | Fallback | Observação |
|---|---|---|---|
| Nível do rio | ANA gov.br/Sala de Situação boletim diário PDF via `scripts/extract-ana-boletim.py` | SACE/CPRM ou último valor válido; sem API ANA | converter cm→m e manter threshold de navegabilidade configurável; sem score sem regra aprovada |
| Chuva | INMET direto por geocódigo | scraping INMET via Firecrawl | previsão municipal 4 dias |
| Tráfego | DNIT/parseforge | tabela estática datada | trecho crítico BR-319 |
| Qualidade da via | índice estático `precviasBR`/similar | valor fixo documentado | sem dinâmica no MVP |
| Restrição de peso/PBTC | portarias DNIT via HTTP/Firecrawl | tabela estática "não verificada" | nunca assumir liberado |
| Notícias relacionadas | Firecrawl/Alexandria search | fixtures locais | contextual, não bloqueador |

Firecrawl/Alexandria:

- Alexandria é uma biblioteca de providers dentro do Firecrawl; exige conta/time com Alexandria habilitado e créditos por chamada.
- Uso permitido no MVP: descoberta de fontes, monitoramento de páginas oficiais e filtro de notícias relacionadas.
- Uso proibido: Alexandria como fonte primária de dimensão do IAV sem normalização e confirmação oficial.
- Sem `FIRECRAWL_API_KEY`, o sistema roda com fixtures e declara fonte indisponível.

Filtro de notícias:

- Query por rota/trecho + janela de tempo.
- Classificação determinística por palavras-chave/entidades do catálogo; LLM opcional futuro, nunca para score.
- Saída: `related_news[]` com fonte, URL, data e `matched_segments[]`.

## 8. Contratos

### `IavQuery`

```json
{
  "origem": "MANAUS",
  "destino": "SAO_PAULO",
  "data_embarque": "2026-11-25",
  "carga": {
    "tipo": "SECA",
    "peso_bruto_total_kg": 10000,
    "quantidade_caminhoes": 1
  }
}
```

Regras: campos extras rejeitados; `origem`/`destino` são resolvidos contra `data/routes/mvp-routes.json` e par sem rota retorna `404 ROUTE_NOT_FOUND`; `data_embarque` entre hoje (`America/Manaus`) e hoje+4 dias; `peso_bruto_total_kg` entre `1` e `60000`.

### `DecisionSnapshot`

```json
{
  "rule_version": "iav-mvp-2026-11-23",
  "query": {},
  "routes": [
    {
      "route_id": "rota-1-br-319",
      "status": "VIAVEL_COM_RESSALVAS",
      "iav": 64,
      "worst_segment_id": "r1-s2-floresta-br319",
      "segments": [],
      "blockers": [],
      "missing_data": [],
      "evidences": [],
      "related_news": []
    }
  ],
  "missing_data": [],
  "scope_warning": "IAV mede viabilidade física/regulatória; não mede custo, disponibilidade de caminhão ou eventos fora das fontes."
}
```

## 9. API e MCP

API interna mínima:

- `POST /v1/viabilidade`
- `GET /v1/fontes`
- `GET /v1/noticias`

MCP:

- Tool única `consultar_viabilidade`.
- Auth: `Authorization: Bearer <IAV_MCP_API_KEY>`.
- Rate limit: `60` req/min/chave.
- Erros: `400` entrada inválida, `401` sem chave, `404` par `origem/destino` sem rota no catálogo, `429` rate limit, `503` indisponibilidade total sem `DecisionSnapshot`; fonte crítica sem fallback vira `NAO_AVALIAVEL` na rota afetada.

## 10. Persistência

Banco: PostgreSQL. Tabelas mínimas: `routes`, `route_segments`, `raw_payloads`, `evidences`, `route_condition_facts`, `related_news`, `rule_sets`, `iav_calculations`, `decision_snapshots`, `cost_assumptions`.

Ordem de gravação obrigatória: `raw_payloads` → `evidences`/`route_condition_facts`/`related_news` → `iav_calculations` → `decision_snapshots`.

## 11. Segurança

- Validar entrada na borda; rejeitar extras.
- Nunca logar `IAV_MCP_API_KEYS`, `FIRECRAWL_API_KEY` ou payload com segredo.
- API key por ambiente; `.env` nunca commitado.
- Resposta MCP inclui `scope_warning` e não expõe detalhes internos de stack.
- Notícia/fonte externa é dado não confiável até normalização e confirmação.

## 12. Observabilidade mínima

- Log estruturado por coleta: fonte, status, `content_hash`, `freshness_hours`.
- Métricas mínimas: latência da consulta, status da fonte, taxa de `NAO_AVALIAVEL`, rate limit hits.
- Alertas: fonte crítica indisponível, conflito oficial, payload bruto ausente.

## 13. Testes

- Unitários de domínio: fórmula, gates, `min` por trecho, PBTC, `NAO_AVALIAVEL`, conflito.
- Integração: coletor → raw → evidência → fato → snapshot.
- Contrato: `IavQuery` e `DecisionSnapshot` válidos/inválidos.
- MCP: auth, rate limit, schema, erros.
- E2E/dashboard: caminho feliz, fonte indisponível, `NAO_AVALIAVEL`, notícia contextual.
- Matriz `C01..C20` em `tests/e2e/scenarios.json`.

## 14. Deploy

- Desenvolvimento e validação acontecem localmente com fixtures.
- Nenhum deploy público antes da etapa final.
- Deploy final na Vercel; dashboard usa `NEXT_PUBLIC_API_URL`; API/MCP devem ser portáteis o suficiente para rodar em Vercel/serverless ou em processo Node exposto por URL.

## 15. Evolução futura

A arquitetura permite adicionar serviços/dados sem reescrever o domínio:

- Novas fontes entram como `Evidence`/`Observation` com `source` versionado.
- Novas dimensões entram como `RuleSet` versionado e testes.
- Novos corredores entram como novos arquivos em `data/routes/` e fixtures.
- Microserviços reais só se justificados por escala; o contrato `DecisionSnapshot` permanece estável.
