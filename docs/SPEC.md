# SPEC — RotaZFM MVP

Status: especificação vigente  
Data: 23/11/2026

## Requisitos funcionais

### RF-001 — Catálogo de rotas e trechos

**Regra:** o sistema deve carregar `data/routes/mvp-routes.json` como fonte versionada das duas rotas e segmentos do MVP.

**Critérios de aceite:**
- O catálogo contém `rota-1-br-319` e `rota-2-fluvial-brasilia`, cada uma com segmentos `from`, `to`, `road`, `mode` e `critical`.
- `origin` deve ser `MANAUS` e `destination` deve ser `SAO_PAULO`.
- Qualquer rota fora do catálogo retorna `404`.

### RF-002 — Perfil mínimo de carga

**Regra:** toda consulta deve informar `carga.tipo` (`SECA` ou `CONTEINERIZADA`) e `carga.peso_bruto_total_kg`.

**Critérios de aceite:**
- `peso_bruto_total_kg` deve ser inteiro entre `1` e `60000`.
- `quantidade_caminhoes` é opcional e, quando ausente, assume `1`.
- Campos extras na carga ou na consulta raiz são rejeitados com `400`.

### RF-003 — Coleta com dado bruto primeiro

**Regra:** todo coletor deve gravar `raw_payloads` com payload bruto, origem, `collected_at`, `source_url`, método e `content_hash` antes de normalizar.

**Critérios de aceite:**
- Nenhum fato normalizado existe sem `raw_payload` associado.
- Payload bruto é imutável e versionado por `content_hash`.
- Falha de coleta não apaga o último payload válido.

### RF-004 — Evidência normalizada

**Regra:** cada evidência deve ter `source`, `source_url`, `published_at`, `collected_at`, `method`, `content_hash`, `confirmation_status`, `effective_from`, `effective_until`, `freshness_hours` e `last_valid_at` quando reutilizada.

**Critérios de aceite:**
- `confirmation_status` ∈ `CONFIRMADO | NAO_CONFIRMADO | CONFLITANTE | INDISPONIVEL | EXPIRADO | NAO_AVALIAVEL`.
- Evidência sem `source` ou `source_url` não entra em `route_condition_facts`.
- `freshness_hours` é calculado a partir de `collected_at` e da data de referência do dado.

### RF-005 — Frescor, conflito e última atualização

**Regra:** quando a fonte falhar ou o dado estiver velho, o sistema deve reutilizar a última observação válida com alerta de atraso; quando houver conflito entre fontes oficiais, a dimensão fica `CONFLITANTE`.

**Critérios de aceite:**
- Dado com `freshness_hours > 24` é marcado como defasado.
- Valor com variação atípica é descartado ou marcado `NAO_AVALIAVEL`.
- Conflito entre fontes oficiais gera `CONFLITANTE`, nunca média silenciosa.
- Último valor válido sempre aparece com `last_valid_at` e `freshness_hours`.

### RF-006 — IAV por trecho

**Regra:** o IAV é determinístico, de `0` a `100`, calculado por trecho a partir das cinco dimensões: nível do rio, chuva, tráfego, qualidade da via e restrição de peso.

**Critérios de aceite:**
- Cada `SegmentAssessment` tem `iav`, `dimensions`, `blockers[]`, `missing_data[]`, `evidences[]` e `rule_version`.
- Pesos são fixos no MVP e registrados em `rule_version`.
- Nenhum LLM participa do cálculo.
- Score fora de `0..100` falha internamente e não é publicado.

### RF-007 — Consolidação por pior trecho

**Regra:** a rota é avaliada pelo pior `SegmentAssessment`, não por média de trechos.

**Critérios de aceite:**
- `RouteAssessment.iav = min(SegmentAssessment.iav)` entre trechos avaliáveis.
- Se qualquer trecho for `NAO_AVALIAVEL`, a rota herda `NAO_AVALIAVEL` com `missing_data[]` do trecho.
- `worst_segment_id` aponta o trecho que determinou o resultado.

### RF-008 — Bloqueadores

**Regra:** bloqueadores são corte duro e prevalecem sobre IAV.

**Critérios de aceite:**
- PBTC do trecho menor que `carga.peso_bruto_total_kg` torna a rota `NAO_VIAVEL`.
- Interdição ou restrição confirmada por fonte oficial torna a rota `NAO_VIAVEL`.
- Restrição não verificada aparece como `NAO_CONFIRMADO`, nunca como liberada.
- Notícia sem confirmação oficial não cria bloqueador.

### RF-009 — Não avaliável

**Regra:** se dimensão obrigatória estiver ausente, desatualizada além do limite ou conflitante, o sistema não publica IAV numérico.

**Critérios de aceite:**
- Retorna `status = "NAO_AVALIAVEL"`, `iav = null` e `missing_data[]` com dimensão, trecho e motivo.
- `NAO_AVALIAVEL` não é tratado como aprovação.
- Dashboard e MCP exibem a lacuna em vez de score parcial.

### RF-010 — Notícias relacionadas

**Regra:** o sistema deve filtrar notícias por rota/trecho e exibi-las como evidência contextual.

**Critérios de aceite:**
- Cada notícia tem `title`, `url`, `source`, `published_at`, `collected_at`, `matched_segments[]` e `confirmation_status`.
- Notícia entra em `related_news[]`, nunca em `blockers[]` sem `CONFIRMADO`.
- Sem `FIRECRAWL_API_KEY`, o filtro usa fixtures locais e declara fonte indisponível.

### RF-011 — MCP `consultar_viabilidade`

**Regra:** o servidor MCP deve expor `consultar_viabilidade` com o mesmo contrato da API.

**Critérios de aceite:**
- Entrada segue `IavQuery`; extras são rejeitados.
- Resposta inclui `routes[]`, `evidences[]`, `blockers[]`, `missing_data[]`, `related_news[]`, `justification_template`, `rule_version` e `scope_warning`.
- Chamada leva menos de `3s` na meta com fixtures.
- Resposta sempre declara que não substitui decisão do gestor.

### RF-012 — Autenticação e rate limit

**Regra:** chamadas à API/MCP exigem `Authorization: Bearer <IAV_MCP_API_KEY>`.

**Critérios de aceite:**
- Sem chave ou chave inválida retorna `401`.
- Limite de `60` requisições/minuto por chave; excesso retorna `429` com `retry_after_seconds`.
- Nenhum segredo aparece em logs, fixtures ou respostas.

### RF-013 — Dashboard

**Regra:** o usuário informa origem, destino, data e carga e vê as rotas, IAV ou `NAO_AVALIAVEL`, trechos, bloqueadores, evidências, faltantes e notícias.

**Critérios de aceite:**
- Mapa ou lista mostra os trechos do catálogo.
- Estados de loading, erro, `NAO_AVALIAVEL` e rota inviável são tratados.
- Nenhum score aparece sem fonte/data/qualidade ou sem aviso de dado ausente.
- Dashboard não calcula IAV; consome `DecisionSnapshot`.

### RF-014 — Segredos e ambiente

**Regra:** `.env.example` lista todas as variáveis necessárias sem valores secretos.

**Critérios de aceite:**
- Variáveis: `DATABASE_URL`, `API_PORT`, `MCP_PORT`, `IAV_MCP_API_KEYS`, `NEXT_PUBLIC_API_URL`, `FIRECRAWL_API_KEY`, `ROUTEKIT_API_KEY` opcional, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- `.env` real está no `.gitignore`.
- Sem `FIRECRAWL_API_KEY`, coleta externa é desabilitada e fixtures assumem.

### RF-015 — Versionamento e idempotência

**Regra:** regras, pesos, fontes e catálogo são versionados; consultas repetidas com o mesmo snapshot são idempotentes.

**Critérios de aceite:**
- `DecisionSnapshot.rule_version` referencia a versão das regras/pesos/fontes.
- Mesma entrada + mesmo `rule_version` + mesmos fatos retorna mesmo resultado.
- Coleta repetida do mesmo payload não duplica `raw_payloads` (`content_hash` único).

## Modelo de dados inicial

| Entidade | Campos essenciais |
|---|---|
| `routes` | id, nome, modo, origem, destino, status, version |
| `route_segments` | route_id, id, nome, from, to, road, mode, critical |
| `raw_payloads` | id, source, source_url, collected_at, payload, content_hash, status |
| `evidences` | id, source, source_url, published_at, collected_at, method, content_hash, confirmation_status, effective_from, effective_until |
| `route_condition_facts` | route_id, segment_id, dimension, value, unit, evidence_id, quality |
| `related_news` | id, title, url, source, published_at, collected_at, matched_segments, confirmation_status |
| `rule_sets` | rule_version, weights, thresholds, effective_from |
| `iav_calculations` | route_id, segment_id, iav, dimensions, evidences, missing_data, blockers, rule_version |
| `decision_snapshots` | id, query, rule_version, routes, missing_data, scope_warning, created_at |
| `cost_assumptions` | route_id, modal, custo_estimado, fonte, data, status — Should, fora do caminho crítico |

## Fora de escopo

- Otimização de custo real.
- Motor de rotas completo ou cálculo de distância por request.
- Dados pessoais.
- Cálculo probabilístico calibrado.
- Deploy público antes da etapa final.
