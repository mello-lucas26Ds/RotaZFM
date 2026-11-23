# PRD — RotaZFM

Status: MVP inicial  
Data: 23/11/2026  
Fonte detalhada: `Plan.md` v3 + decisões de Lucas em 23/11/2026 + `.specs/features/rotazfm-mvp/plan.md`

## Problema

Empresas do Polo Industrial de Manaus precisam escolher entre rotas de escoamento para São Paulo com impactos diferentes em prazo, custo e risco de atraso. Os dados relevantes existem em fontes públicas, mas estão dispersos e não respondem diretamente: "essa rota vai funcionar na data do embarque com esta carga?".

## Objetivo

Criar uma plataforma de apoio à decisão que avalie a viabilidade física e regulatória de duas rotas candidatas por meio do **IAV — Índice de Antecipação de Viabilidade** — determinístico, explicável, segmentado por trecho e auditável.

## Usuários

- Gestor logístico do PIM: usa dashboard para decidir rota com antecedência.
- Agente de IA: consulta viabilidade via MCP.
- Operador/transportadora: confirma se uma carga pode usar a rota.

## Rotas do MVP

1. **Rota 1 — Via BR-319 (Pelo interior / Centro-Oeste)**, ~3.850 km: Manaus → Careiro da Várzea → Careiro/ Humaitá → Porto Velho → Vilhena → Rondonópolis → São Simão → Uberaba → São Paulo.
2. **Rota 2 — Via Balsa até Belém (Rio Amazonas + Belém-Brasília)**, ~1.500 km de rio + ~2.900 km de estrada: Manaus → Belém/Barcarena → Ulianópolis → Estreito → Gurupi → Itumbiara → Uberaba → São Paulo.

O catálogo versionado fica em `data/routes/mvp-routes.json`.

## Funcionalidades do MVP

1. Receber `origem`, `destino`, `data_embarque` e perfil mínimo de carga (`tipo` = `SECA` ou `CONTEINERIZADA`, `peso_bruto_total_kg`).
2. Carregar evidências públicas e mantê-las com payload bruto, fonte, URL, datas, método, hash, status de confirmação e janela de validade.
3. Quando faltar dado, usar a última atualização válida com `freshness_hours`/`last_valid_at`; se a dimensão obrigatória continuar ausente, velha ou conflitante, retornar `NAO_AVALIAVEL` sem score numérico.
4. Calcular IAV por trecho e consolidar a rota pelo pior trecho (`min`).
5. Aplicar bloqueadores como corte duro: PBTC excedido, interdição confirmada, dado crítico inconsistente.
6. Exibir justificativa determinística com dimensões, fontes, datas, alertas e faltantes.
7. Filtrar notícias relacionadas por rota/trecho como evidência contextual; notícia nunca bloqueia sem confirmação oficial.
8. Expor `consultar_viabilidade` por MCP com API key, rate limit e resposta estruturada.
9. Mostrar resultado em dashboard web com mapa/lista de trechos e estados de erro.

## Fora do escopo do MVP

- WorkOS, cobrança e autenticação avançada.
- Visualização 3D.
- Outras rotas da ZFM.
- LLM calculando IAV ou escolhendo rota.
- Cálculo de custo real ou ordenação por preço.
- Previsão de greves, bloqueios políticos, falta de caminhão ou combustível.
- Microserviços reais, Airflow/Prefect e infraestrutura desnecessária.
- Deploy público antes da etapa final; alvo final é Vercel.

## Critérios de sucesso

- Matriz de cenários `C01..C20` passa com fixtures.
- Cinco dimensões com dado real ou limitação explicitamente declarada.
- 100% das decisões com fontes, datas e qualidade do dado rastreáveis.
- MCP responde com API key e rejeita sem chave.
- Dashboard mostra `NAO_AVALIAVEL` quando faltar dado crítico, nunca score como aprovação implícita.
- Fluxo completo funciona localmente com fixtures antes de qualquer deploy.

## Restrições

- Hackathon: submissão até 28/11/2026.
- Samuelson, Maria e Cris são subagents/papéis operacionais; Lucas é o responsável humano.
- Não há entrevistas com gestores do PIM; validação é documental, por fixtures e casos verificáveis.
- Fontes públicas podem falhar; fallbacks precisam ser simples e visíveis.
- Custo é camada separada e opcional; nunca entra no IAV.
- Deploy público somente na Vercel e somente na etapa final.
