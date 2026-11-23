# Decisões — RotaZFM

Status: registro vigente  
Data de abertura: 09/11/2026  
Última atualização: 23/11/2026

## DEC-001 — Nome oficial

- Data: 09/11/2026
- Decisão: usar **RotaZFM** em toda comunicação, código, repositório e pitch.
- Motivo: o `Plan.md` identifica inconsistências anteriores entre RotaZFM, RouteZFM e ZFMroute.
- Alternativas descartadas: RouteZFM, ZFMroute.
- Responsável: time.

## DEC-002 — IAV determinístico

- Data: 09/11/2026
- Decisão: o IAV é calculado por regras determinísticas; nenhum LLM calcula score ou escolhe rota.
- Motivo: explicabilidade, reprodutibilidade e menor risco de alucinação.
- Alternativas descartadas: scoring por LLM como núcleo.
- Responsável: backend.

## DEC-003 — Custo separado da viabilidade

- Data: 09/11/2026
- Decisão: custo é camada estimada e secundária, usada apenas para ordenar rotas já viáveis.
- Motivo: evitar misturar viabilidade física/regulatória com estimativa frágil de preço.
- Alternativas descartadas: menor custo total como parte do IAV.
- Responsável: produto/backend.

## DEC-004 — AIHOT como referência estrutural

- Data: 09/11/2026
- Decisão: usar AIHOT.news como referência estrutural oficial; reuso de código depende de spike de até 2 dias e não é caminho crítico.
- Motivo: preservar direcionamento arquitetural sem importar curadoria de notícias/LDM.
- Alternativas descartadas: descarte total do AIHOT ou importação integral sem validação.
- Responsável: Cris + Lucas.

## DEC-005 — Justificativa determinística primeiro

- Data: 09/11/2026
- Decisão: começar com justificativa por template determinístico a partir do JSON do IAV.
- Motivo: elimina dependência de LLM no caminho crítico e reduz risco de alucinação.
- Alternativas descartadas: LLM obrigatório na justificativa.
- Responsável: backend.

## DEC-006 — Distância/duração base via distbrasil

- Data: 09/11/2026
- Decisão: usar `distbrasil`/Zenodo como matriz estática de distância e duração para os pares do MVP, se a cobertura for confirmada.
- Motivo: cobre baseline sem subir OSRM próprio.
- Alternativas descartadas: OSRM próprio no caminho crítico.
- Responsável: dados.

## DEC-007 — Routekit como seed/cache, não por request

- Data: 09/11/2026
- Decisão: usar `routekit-mcp` apenas para gerar/cachear geometria, ETA e alternativas, se o spike validar.
- Motivo: API gratuita limitada e MVP não pode depender de chamada externa por request.
- Alternativas descartadas: routekit como dependência runtime.
- Responsável: dados/backend.

## DEC-008 — INMET direto como fonte primária de chuva

- Data: 09/11/2026
- Decisão: usar API direta do INMET por geocódigo; `brazil_weather_data` fica como fallback/referência.
- Motivo: previsão municipal de 4 dias é a necessidade do MVP.
- Alternativas descartadas: `brazil_weather_data` como fonte principal.
- Responsável: dados.

## DEC-009 — PRF fora do MVP

- Data: 09/11/2026
- Decisão: não usar `tidyprf`/`prf-api` como dimensão do IAV no MVP.
- Motivo: acidentes e infrações não são uma das cinco dimensões.
- Alternativas descartadas: sexta dimensão ou substituir qualidade da via.
- Responsável: produto/dados.

## DEC-010 — Orquestração simples com PostgreSQL

- Data: 09/11/2026
- Decisão: usar worker/cron simples e PostgreSQL; não usar Airflow/Prefect nem DuckDB como banco principal no MVP.
- Motivo: poucas fontes e fluxo determinístico não justificam plataforma pesada.
- Alternativas descartadas: Airflow, Prefect, DuckDB runtime, múltiplos bancos.
- Responsável: backend.

## DEC-011 — ANA como fallback futuro

- Data: 09/11/2026
- Decisão: pedir autorização da ANA HidroWebService, mas manter SACE como fonte primária de nível do rio.
- Motivo: ANA pode ajudar fallback/histórico, mas depende de aprovação externa.
- Alternativas descartadas: bloquear MVP esperando ANA ou usar ANA sem autorização.
- Responsável: dados.

## DEC-012 — Firecrawl seletivo

- Data: 09/11/2026
- Decisão: usar Firecrawl para SACE, portarias DNIT e descoberta/filtro de notícias quando HTTP direto for frágil; manter HTTP direto/fixtures como fallback.
- Motivo: fontes não estruturadas/PDF e busca de notícias se beneficiam de extração; API direta reduz custo.
- Alternativas descartadas: Firecrawl para todas as fontes ou scraping manual sem schema.
- Responsável: dados.

## DEC-013 — Nome do índice é IAV

- Data: 23/11/2026
- Decisão: o índice oficial é **IAV — Índice de Antecipação de Viabilidade**.
- Motivo: Lucas determinou "O nome sera IAV"; substitui usos ambíguos de IVA/IAV nos documentos novos.
- Alternativas descartadas: IVA, IAV parcial como score numérico sem lastro.
- Responsável: Lucas.

## DEC-014 — Rotas e trechos fixos aprovados

- Data: 23/11/2026
- Decisão: o MVP avalia exatamente as duas rotas descritas por Lucas: `rota-1-br-319` e `rota-2-fluvial-brasilia`, versionadas em `data/routes/mvp-routes.json`.
- Motivo: Lucas forneceu o detalhamento dos trechos para evitar rota caixa-preta.
- Alternativas descartadas: rota única, rota hardcoded no domínio ou mais rotas da ZFM.
- Responsável: Lucas.

## DEC-015 — Perfil mínimo de carga

- Data: 23/11/2026
- Decisão: carga do MVP é seca ou conteinerizada, com `peso_bruto_total_kg` por caminhão e `quantidade_caminhoes` opcional.
- Motivo: Lucas determinou "carga seca/containerizada ... peso bruto total".
- Alternativas descartadas: aceitar JSON livre de carga ou exigir PBTC/eixos no MVP.
- Responsável: Lucas.

## DEC-016 — Dado ausente usa última atualização com alerta

- Data: 23/11/2026
- Decisão: quando uma fonte falhar ou o dado estiver velho, reutilizar a última observação válida com `freshness_hours` e `last_valid_at`; se a dimensão obrigatória continuar ausente, velha além do limite ou conflitante, retornar `NAO_AVALIAVEL` sem IAV numérico.
- Motivo: Lucas pediu "ausenica de dadospuxar ultima atualziar"; a crítica arquitetural exige não publicar score sem lastro.
- Alternativas descartadas: IAV parcial numérico como aprovação implícita.
- Responsável: Lucas.

## DEC-017 — Notícias relacionadas são contextuais

- Data: 23/11/2026
- Decisão: notícias filtradas por rota/trecho aparecem em `related_news[]` com fonte/data/URL; nunca criam bloqueador sem `confirmation_status = CONFIRMADO`.
- Motivo: Lucas pediu filtro de notícias; fontes novas exigem separar notícia de confirmação oficial.
- Alternativas descartadas: notícia como sexta dimensão ou bloqueador automático.
- Responsável: Lucas.

## DEC-018 — Alexandria/Firecrawl como spike controlado

- Data: 23/11/2026
- Decisão: validar Firecrawl/Alexandria para descoberta de fontes e filtro de notícias; Alexandria não é fonte primária de dimensão do IAV sem normalização/confirmação oficial.
- Motivo: Lucas pediu validar Alexandria; a documentação pública indica que Alexandria é biblioteca de providers Firecrawl com créditos e termos por provider.
- Alternativas descartadas: depender de Alexandria no caminho crítico ou ignorar a validação pedida.
- Responsável: Maria + Cris.

## DEC-019 — Deploy final na Vercel

- Data: 23/11/2026
- Decisão: nenhum deploy público antes da etapa final; o deploy final será na Vercel.
- Motivo: Lucas determinou "nosso deploy sera na vercel so no final".
- Alternativas descartadas: deploy incremental na Cloudflare/Vercel durante o build.
- Responsável: Lucas.

## DEC-020 — Monorepo modular, não microserviços

- Data: 23/11/2026
- Decisão: manter monorepo com `apps/` e `packages/`; fronteiras permitem extração futura, mas não criar microserviços reais no MVP.
- Motivo: Lucas pediu arquitetura com formas de adicionar serviços/dados futuros sem virar superprojeto.
- Alternativas descartadas: microserviços reais, filas distribuídas ou múltiplos bancos.
- Responsável: Lucas + Cris.

## DEC-021 — Validação sem entrevistas

- Data: 23/11/2026
- Decisão: eliminar dependência de entrevistas com gestores; usar pesquisa documental, premissas explícitas, fixtures, casos verificáveis e matriz C01..C20.
- Motivo: Lucas determinou que não há gestores do PIM para entrevistar.
- Alternativas descartadas: marcar entrevistas como pendentes ou usar hipótese como fato.
- Responsável: Lucas.

## DEC-022 — Fórmula do IAV no MVP

- Data: 23/11/2026
- Decisão: no MVP, cada trecho usa soma ponderada com gates de dado ausente/conflito; rota consolida por `min` dos trechos; bloqueadores prevalecem. v2 (23/11/2026): dimensões dependem do modo — `hidroviario`/`multimodal` usam as cinco dimensões e `rodoviario` renormaliza chuva/tráfego/qualidade/restrição; em trechos hidroviários/multimodais, `nivel_efetivo = nivel - min(5; 0,10 × max(0; 50 - chuva))` para refletir que chuva forte tenderia a piorar a condição hídrica.
- Motivo: menor solução explicável que preserva rastreabilidade; composição multiplicativa/avançada fica para evolução com calibração. Nível do rio não se aplica a trechos puramente rodoviários.
- Alternativas descartadas: fórmula multiplicativa no MVP sem dados suficientes para calibrar; exigir nível do rio em trechos rodoviários; premiação de estiagem sem fonte.
- Responsável: Cris + Lucas.

## Pendências que afetam decisões

- Confirmar regulamento do Hack Brasil 2026 e prazo final.
- Confirmar cobertura do `distbrasil` para os pares necessários.
- Validar spike do `routekit-mcp` para as rotas, se ainda fizer sentido.
- Confirmar payload/cobertura da API direta do INMET.
- Confirmar disponibilidade de série SACE 2023 e contagens DNIT para o caso retrospectivo.
- Validar Firecrawl/Alexandria com fixture e registrar custo/limite de créditos.
- Definir caso retrospectivo e "resultado ruim" antes de analisar dados.
- Obter chaves reais de `.env` somente quando a Etapa 2/5 chegar; nunca commitar valores.
