# Avaliação de fontes e ferramentas — MVP RotaZFM

Status: avaliação vigente para a Etapa 1 de fixtures/validação documental
Data: 23/11/2026
Fonte: `Plan.md` v3 + validação documental de 23/11/2026 + informações fornecidas pelo time
Princípio: o MVP deve ser uma estrutura pequena de tomada de decisão, não um superprojeto. Tudo que não sustenta o IAV, o MCP ou o dashboard fica fora ou vira fallback/futuro.

## Veredito executivo

| Item | Decisão para o MVP | Papel | Substitui / depende de | Observação |
|---|---|---|---|---|
| `distbrasil` | **Usar** | Matriz estática de distância/duração por município | Substitui matriz OSRM própria para o MVP | Bom para baseline de rotas e futura camada de custo; não mede condição física da via |
| `routekit-mcp` | **Usar com cautela** | Geometria, ETA e até 3 alternativas | Pode substituir grafo próprio para as duas rotas fixas, mas não o motor de viabilidade | API gratuita limitada a 50 chamadas/mês; usar para extrair/cachear rotas, não como dependência por request |
| `brazil_weather_data` | **Fallback/referência** | Dados de estações e consultas SQL | Não substitui a API direta do INMET para previsão municipal | Foco em estações; pode ajudar validação histórica ou observações, mas não é fonte primária de previsão de 4 dias |
| INMET direto | **Usar** | Previsão por geocódigo/município | Substitui scraping do site como primeira opção | Endpoint indicado: `https://apiprevmet3.inmet.gov.br/previsao/{geocodigo}` `[a validar payload e cobertura]` |
| `tidyprf` / `prf-api` | **Cortar do MVP** | Acidentes e infrações PRF | Não substitui nenhuma das cinco dimensões atuais | Útil para risco futuro ou validação retrospectiva; `prf-api` parece desatualizado, preferir dados oficiais PRF ou `tidyprf` se voltar ao escopo |
| Firecrawl | **Usar seletivamente** | Extração de SACE e portarias DNIT | Substitui scraping manual/frágil quando HTTP direto falha ou quando schema ajuda | Bom para PDF/página normativa; manter HTTP direto como fallback |
| ANA gov.br/Sala de Situação | **Usar para fallback operacional** | Nível diário do rio por estação | Substitui API/credencial ANA HidroWebService | Fonte oficial pública em PDF; extrair via `scripts/extract-ana-boletim.py`, sem token |
| Airflow/Prefect | **Cortar do MVP** | Orquestração pesada | Substituído por cron/worker simples | Para 5–6 coletores, Airflow/Prefect é complexidade desnecessária |
| DuckDB | **Opcional/local** | Análise local | Não substitui PostgreSQL no MVP | Se já houver PostgreSQL, usar uma base só; DuckDB só para exploração/validação local |

## O que entra no núcleo do MVP

O núcleo continua sendo o IAV determinístico com cinco dimensões:

1. Nível do rio.
2. Previsão de chuva.
3. Volume de tráfego.
4. Qualidade da via.
5. Restrição de peso.

As ferramentas novas servem para **alimentar, validar ou visualizar** essas dimensões; nenhuma vira uma sexta dimensão no MVP.

## Conexão das partes

Fluxo mínimo recomendado:

```text
Fontes externas
  ├─ SACE via Firecrawl/HTTP → nível do rio
  ├─ INMET direto → previsão de chuva
  ├─ DNIT/parseforge → tráfego BR-319
  ├─ Portarias DNIT via Firecrawl/HTTP → PBTC
  ├─ distbrasil/Zenodo → distância e duração base
  ├─ routekit opcional → geometria/ETA cacheada
  └─ tabelas estáticas → qualidade da via
          ↓
raw_payloads
  └─ payload bruto, origem, data_hora_coleta, hash
          ↓
route_condition_facts
  └─ rota, dimensão, valor, unidade, data_referencia, fonte, qualidade
          ↓
Motor IAV determinístico
  └─ iav_calculations: score, dimensões, fontes, alertas, regra de corte
          ↓
API/MCP + Dashboard
```

### Tabelas mínimas sugeridas

| Tabela | Conteúdo |
|---|---|
| `routes` | Corredores candidatos: id, nome, modo, origem, destino, status |
| `route_segments` | Trechos de cada rota: BR, km inicial/final, município, fonte da restrição |
| `route_geometry` | GeoJSON/polyline opcional por rota, versionado |
| `raw_payloads` | Resposta bruta de cada coleta, com origem e hash |
| `route_condition_facts` | Fato normalizado por rota/dimensão/data |
| `iav_calculations` | Resultado do IAV com dimensões, fontes, alertas e flags |
| `cost_assumptions` | Premissas de custo estimado, somente Should |

A tabela `route_condition_facts` é o contrato central entre coleta, motor e interface.

## Decisão por dimensão

### 1. Nível do rio

- Primário operacional: boletim diário ANA gov.br/Sala de Situação em PDF via `scripts/extract-ana-boletim.py`.
- Fallback imediato: último valor válido com flag de atraso.
- Corroboração/contexto: SACE/CPRM via HTTP direto ou Firecrawl.
- Fora de escopo nesta regra: ANA HidroWebService, pois exige cadastro/token e foi substituído pelo PDF público.
- Validação retrospectiva: ANA gov.br/boletins pode ajudar histórico se houver série oficial acessível; SACE precisa ser testado para 2023 `[a validar]`.

O que não fazer: usar API/credencial ANA; usar Firecrawl sem schema; mostrar valor antigo como atual.

### 2. Previsão de chuva

- Primário: API direta do INMET por geocódigo.
- Fallback: scraping do INMET via Firecrawl.
- Referência/opcional: `brazil_weather_data` para estações/SQL, se fizer sentido para observação histórica.

O que não fazer: usar `brazil_weather_data` como se fosse previsão municipal sem confirmar que ele tem forecast; depender de serviço Render gratuito no caminho crítico sem fallback.

### 3. Volume de tráfego

- Primário: scraper DNIT/parseforge.
- Fallback: tabela de referência com última contagem e data visível.
- Fora do MVP: PRF acidentes/inflações como dimensão.

O que não fazer: tratar acidentes PRF como volume de tráfego; adicionar acidente como sexta dimensão agora.

### 4. Qualidade da via

- Primário: índice estático `precviasBR` ou `safety-road-mapping`.
- Fallback: valor fixo documentado com fonte e data.
- Futuro: PRF/tidyprf pode enriquecer análise de risco, mas não substitui o índice estático.

O que não fazer: buscar qualidade dinâmica de via no MVP; usar PRF como substituto direto.

### 5. Restrição de peso

- Primário: portarias DNIT.
- Extração: Firecrawl com schema ou HTTP direto + parser.
- Fallback: tabela estática com data de revisão e status “não verificada” quando não houver confirmação.

O que não fazer: assumir PBTC sem portaria vigente; marcar restrição como liberada quando não verificada.

## Distância, geometria e ETA

Distância e ETA não são dimensões do IAV, mas ajudam a:

- explicar a rota no dashboard;
- desenhar o mapa;
- calcular custo estimado futuro;
- comparar alternativas.

Decisão:

- `distbrasil` entra como baseline estático de distância/duração.
- `routekit-mcp` entra como spike opcional para geometria/ETA; se funcionar, salvar resultado estático no banco/repo.
- Não chamar routekit a cada request do usuário no MVP por causa do limite de 50 chamadas/mês e da dependência externa.
- Se routekit falhar, usar geometria simplificada/manual com disclaimer.

## Orquestração e agendamento

Recomendação:

| Fonte | Frequência MVP |
|---|---|
| SACE | a cada 1–3h |
| INMET | 1x ao dia ou antes da demo |
| DNIT tráfego | semanal ou sob demanda |
| Portarias DNIT | sob demanda/mensal |
| distbrasil/precviasBR | uma vez, versionado |
| routekit | uma vez para seed de rotas, se aprovado |

Implementação: cron/worker simples. Airflow/Prefect só em evolução futura se o número de fontes e schedules crescer.

## O que foi cortado e por quê

| Item | Motivo do corte |
|---|---|
| Airflow/Prefect | Superprojeto para poucas coletas; cron/worker resolve |
| PRF no MVP | Não é uma das cinco dimensões; aumenta escopo e validação |
| ANA como primária | Depende de autorização externa; usar como fallback futuro |
| `brazil_weather_data` como primária | Não resolve previsão municipal de 4 dias; INMET direto é mais alinhado |
| Routekit por request | Limite de API e dependência externa; usar cache/seed |
| OSRM próprio | `distbrasil`/Zenodo cobre baseline; OSRM só se for preciso rota customizada |
| DuckDB como banco principal | PostgreSQL já é o plano; DuckDB é opcional para análise local |

## Validações que o time precisa fazer

1. **Dados:** testar SACE, INMET, DNIT e portarias com scripts reais.
2. **Rotas:** confirmar se `distbrasil` cobre os pares necessários e se routekit gera as duas rotas com waypoints.
3. **Histórico:** verificar série SACE 2023 e dados DNIT para o caso retrospectivo.
4. **ANA:** enviar pedido de autorização no Dia 1, mesmo sem bloquear o MVP.
5. **Firecrawl:** validar schema de extração para SACE e portarias.
6. **Escopo:** confirmar que PRF, Airflow/Prefect e routekit dinâmico ficam fora do caminho crítico.

## Atualização — 23/11/2026

- **Rotas:** o catálogo do MVP passa a ser `data/routes/mvp-routes.json`, com as duas rotas e trechos aprovadas por Lucas. `distbrasil`/`routekit` continuam apenas baseline/seed se a cobertura for confirmada; não são fonte de IAV.
- **Alexandria/Firecrawl:** Alexandria é uma biblioteca de providers dentro do Firecrawl, com créditos e termos por provider. Uso permitido no MVP: descoberta de fontes oficiais e filtro de notícias relacionadas por rota/trecho. Uso proibido: fonte primária de dimensão do IAV sem normalização e confirmação oficial.
- **Notícias relacionadas:** entram como `related_news[]` com fonte, URL, data e `matched_segments[]`; nunca criam bloqueador sem `confirmation_status = CONFIRMADO`.
- **Deploy:** nenhum deploy público antes da etapa final; alvo final é Vercel.
- **Segredos:** `.env.example` lista `DATABASE_URL`, `API_PORT`, `MCP_PORT`, `IAV_MCP_API_KEYS`, `NEXT_PUBLIC_API_URL`, `FIRECRAWL_API_KEY`, `ROUTEKIT_API_KEY` opcional e variáveis Vercel de deploy; valores reais nunca são commitados.

## Atualização — validação documental de 23/11/2026

Esta seção registra a validação documental feita para os trechos críticos do MVP e o estado das fontes mínimas por dimensão. Fixtures locais estão em `data/fixtures/`; detalhes e perguntas pendentes estão em `docs/VALIDATION.md`.

### Fontes validadas nesta etapa

| Dimensão | Fonte primária validada | URL/página | Verificação | Status | Fallback |
|---|---|---|---|---|---|
| Nível do rio | SGB/SAH Amazonas | `https://sace.sgb.gov.br/` e boletim `https://www.sgb.gov.br/w/niveis-do-rio-negro-e-das-grandes-calhas-da-bacia-do-amazonas-mantem-se-estaveis` | 23/11/2026 | CONFIRMADO | último valor válido com atraso; ANA futura após autorização |
| Chuva | INMET direto por geocódigo | `https://apiprevmet3.inmet.gov.br/previsao/{geocodigo}` | 23/11/2026 | CONFIRMADO | scraping INMET via Firecrawl somente com custo/limite registrado |
| Tráfego | DNIT PNCT/dados abertos | `https://servicos.dnit.gov.br/dadosabertos/dataset/contagem-de-trafego` | 23/11/2026 | PARCIAL | tabela estática datada; trecho BR-319/AM ainda sem contagem confirmada |
| Qualidade da via | DNIT ICM + RIMA BR-319 | `https://servicos.dnit.gov.br/dadosabertos/dataset/condicoes-do-pavimento`; `https://www.gov.br/dnit/pt-br/assuntos/portais-tematicos/br-319-am-ro/audiencias-publicas/br319rima_eleitoral_compressed.pdf` | 23/11/2026 | PARCIAL | valor fixo documentado; SP-330 e trecho fluvial sem fonte terrestre confirmada |
| Restrição de peso/PBTC | Portarias DNIT/DOU | Portaria 5.455/2022; Portaria 13/2025 DOU | 23/11/2026 | PARCIAL | tabela estática "não verificada"; regra conservadora em sobreposição |
| Notícias relacionadas | Fontes oficiais/noticiosas via busca documental | SGB, DNIT, G1, BNC | 23/11/2026 | PARCIAL | fixtures locais; Firecrawl/Alexandria só para descoberta/filtro contextual |

### Conclusões operacionais

- O trecho florestal BR-319 está documentado como crítico e majoritariamente não pavimentado: RIMA indica km 250,7-656,4 (405,7 km) como Trecho do Meio; notícias DNIT de 2026 confirmam pavimentação pontual no Lote C km 198,2-218,2 e manutenção/conservação ampla, sem eliminar o trecho não pavimentado.
- O trecho fluvial Manaus-Belém/Barcarena está documentado e possui: SGB/SAH com estações em Itacoatiara, Parintins, Óbidos, Almeirim e Careiro; leitura específica de Santarém/Breves ficou como lacuna.
- PBTC na BR-319 exige regra sazonal e conservadora: Portaria 5.455/2022 prevê 17 t nov-mai e 23 t jun-out para km 250,7-679,3, proibição noturna 18h-06h e exceções AET; Portaria 13/2025 prevê proibição acima de 45 t dez-jun para km 1,0-679,3. A consolidação vigente deve ser confirmada antes de tratar como regra única.
- Firecrawl/Alexandria podem ajudar a filtrar notícias por rota/trecho e descobrir fontes, mas não entram como fonte primária de dimensão do IAV sem normalização e confirmação oficial. Nenhuma chamada paga foi feita nesta etapa; custo registrado: R$0.

## Atualização — probe controlado de 23/11/2026

- O probe em `scripts/probe-sources.mjs` confirmou INMET (`HTTP 200`, JSON parseável) e SGB/SACE (`HTTP 200` em `https://sace.sgb.gov.br/`). A rota antiga `https://www.sgb.gov.br/sace/amazonas` retornou `404` e foi substituída pela URL operacional do SACE.
- Os dois endpoints DNIT de dados abertos deram timeout a partir da VM; tráfego e qualidade da via seguem com fixture/fallback e extração pendente.
- Nenhuma chamada paga Firecrawl/Alexandria foi feita; custo da etapa: R$0.
