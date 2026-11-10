# PRD — RotaZFM

Status: MVP inicial  
Data: 09/11/2026  
Fonte detalhada: `Plan.md` v3

## Problema

Empresas do Polo Industrial de Manaus precisam escolher entre rotas de escoamento com impactos diferentes em prazo, custo e risco de atraso. Os dados relevantes existem em fontes públicas, mas estão dispersos e não respondem diretamente: “essa rota vai funcionar na data do embarque?”.

## Objetivo

Criar uma plataforma de apoio à decisão que avalie a viabilidade física e regulatória de rotas candidatas por meio do IAV — Índice de Antecipação de Viabilidade — determinístico, explicável e auditável.

## Usuários

- Gestor logístico do PIM: usa dashboard para decidir rota com antecedência.
- Agente de IA: consulta viabilidade via MCP.
- Operador/transportadora: confirma se uma carga pode usar a rota.

## Funcionalidades do MVP

1. Coletar dados públicos de nível do rio, previsão de chuva, tráfego, qualidade da via e restrição de peso.
2. Guardar payload bruto antes da normalização.
3. Normalizar dados em `route_condition_facts` com fonte, data e qualidade.
4. Calcular IAV de 0 a 100 para as rotas fluvial e rodoviária.
5. Aplicar corte duro quando a restrição de peso for excedida.
6. Exibir justificativa com dimensões, fontes, datas e alertas.
7. Expor `consultar_viabilidade` por MCP com API key.
8. Mostrar resultado em dashboard web com mapa e estados de erro.

## Fora do escopo do MVP

- WorkOS, cobrança e autenticação avançada.
- Visualização 3D.
- Outras rotas da ZFM.
- LLM no cálculo ou na escolha de rota.
- Cálculo de custo real.
- Previsão de greves, bloqueios políticos, falta de caminhão ou combustível.
- Airflow/Prefect e infraestrutura desnecessária.

## Critérios de sucesso

- Fluxo completo funcionando até o checkpoint do Dia 13.
- Cinco dimensões com dado real ou limitação explicitamente declarada.
- 100% das decisões com fontes e datas rastreáveis.
- MCP responde com API key e rejeita sem chave.
- Dashboard mostra IAV parcial quando faltar dimensão.

## Restrições

- Hackathon: submissão até 28/11/2026.
- Equipe: Samuelson, Maria, Cris e Lucas.
- Fontes públicas podem falhar; fallbacks precisam ser simples e visíveis.
- Custo é camada separada e opcional; nunca entra no IAV.
