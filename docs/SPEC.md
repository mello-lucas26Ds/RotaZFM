# SPEC — RotaZFM MVP

Status: especificação inicial  
Data: 09/11/2026

## Requisitos funcionais

### RF-001 — Coletar nível do rio

**Regra:** o sistema deve registrar o último valor válido do rio Amazonas com estação, data de referência, data de coleta, fonte e payload bruto.

**Critérios de aceite:**
- Fonte primária: SACE/CPRM.
- Valor fora da faixa ou com variação atípica é descartado ou marcado.
- Dado com mais de 24h aparece como defasado.

### RF-002 — Coletar previsão de chuva

**Regra:** o sistema deve registrar previsão de chuva para Manaus e trecho relevante da BR-319 para os próximos 4 dias.

**Critérios de aceite:**
- Fonte primária: API direta do INMET.
- Previsão acima de 100 mm/dia marca evento crítico.
- Falha da API usa fallback documentado ou declara dado ausente.

### RF-003 — Coletar tráfego

**Regra:** o sistema deve registrar contagens de tráfego da BR-319 com fonte e data de referência.

**Critérios de aceite:**
- Fonte primária: DNIT/parseforge ou tabela estática versionada.
- Contagem ausente não é tratada como fluxo normal.

### RF-004 — Registrar qualidade da via

**Regra:** o sistema deve manter índice estático de qualidade da via por trecho, com fonte e data de referência.

**Critérios de aceite:**
- Cada trecho tem valor, fonte e data.
- Índice desatualizado é declarado como limitação.

### RF-005 — Registrar restrição de peso

**Regra:** o sistema deve manter limite de PBTC por trecho com portaria, data e status de verificação.

**Critérios de aceite:**
- Restrição não confirmada aparece como “não verificada”, nunca como liberada.
- Carga acima do limite torna a rota inviável independentemente do IAV.

### RF-006 — Calcular viabilidade por rota

**Regra:** para origem, destino e data de embarque, o sistema deve avaliar as rotas candidatas e retornar viável/inviável com justificativa.

**Critérios de aceite:**
- Pelo menos duas rotas são avaliadas no MVP.
- Resultado sempre inclui dimensões, fontes, datas e alertas.

### RF-007 — Calcular IAV

**Regra:** o IAV é determinístico, de 0 a 100, com pesos fixos:

```text
IAV = 0,30 × nivel + 0,25 × chuva + 0,20 × trafego + 0,15 × qualidade + 0,10 × restricao
```

**Critérios de aceite:**
- Dimensão ausente gera IAV parcial declarado.
- Score fora de 0–100 não é publicado.
- Nenhum LLM participa do cálculo.

### RF-008 — Expor MCP

**Regra:** o servidor MCP deve expor `consultar_viabilidade(origem, destino, data_embarque)`.

**Critérios de aceite:**
- Resposta segue schema documentado.
- Entrada inválida é rejeitada.
- Chamada leva menos de 3s na meta.

### RF-009 — Autenticar MCP

**Regra:** chamadas ao MCP exigem API key no header `Authorization`.

**Critérios de aceite:**
- Sem chave retorna 401.
- Chave inválida retorna 401.
- Rate limit é implementado e testado.

### RF-010 — Dashboard

**Regra:** o usuário informa origem, destino e data e vê as rotas, IAV, dimensões, fontes e alertas.

**Critérios de aceite:**
- Mapa mostra as rotas candidatas.
- Estados de loading, erro, IAV parcial e rota inviável são tratados.
- Nenhum score aparece sem fonte/data/qualidade.

## Modelo de dados inicial

| Entidade | Campos essenciais |
|---|---|
| `routes` | id, nome, modo, origem, destino, status |
| `route_segments` | route_id, nome, km_inicial, km_final, restrições |
| `raw_payloads` | id, fonte, coletado_em, payload, hash, status |
| `route_condition_facts` | route_id, dimensão, valor, unidade, fonte, data_referência, qualidade |
| `iav_calculations` | route_id, score, dimensões, fontes, datas, alertas, flags |

## Fora de escopo

- Otimização de custo real.
- Motor de rotas completo.
- Dados pessoais.
- Cálculo probabilístico calibrado.
