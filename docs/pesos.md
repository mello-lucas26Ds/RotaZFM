# Matriz de Pesos do IAV

O IAV é calculado de forma determinística em `packages/domain/src/engine.js`; nenhum LLM calcula o índice ou escolhe rota.

## Pesos padrão

| Dimensão | Peso base | Rodoviário | Hidroviário/Multimodal |
|---|---:|---:|---:|
| `nivel` | 0,30 | não aplicável | 0,30 |
| `chuva` | 0,25 | 0,25 | 0,25 |
| `trafego` | 0,20 | 0,20 | 0,20 |
| `qualidade` | 0,15 | 0,15 | 0,15 |
| `restricao` | 0,10 | 0,10 | 0,10 |

Para segmentos rodoviários, `nivel` não se aplica e os pesos restantes são renormalizados na saída explicável; a soma dos `weighted_score` continua igual ao IAV do segmento.

## Ajuste hidroviário

Em `hidroviario` e `multimodal`, o score de `nivel` usado no cálculo é penalizado quando `chuva < 50`: `nivel_usado = max(0, nivel - ((50 - chuva) / 10))`. O resultado fica em `dimensions.nivel.score_used`, `hydro_adjustment` e `weighted_score`.

## Injeção para experimentos

Os pesos podem ser injetados sem alterar o domínio:

```json
{"nivel":0.1,"chuva":0.4,"trafego":0.2,"qualidade":0.2,"restricao":0.1}
```

- API: `IAV_WEIGHTS_JSON='{"nivel":0.1,"chuva":0.4,"trafego":0.2,"qualidade":0.2,"restricao":0.1}'`
- Chamada interna: `createDecisionSnapshot({ ..., iavWeights })`

Pesos devem ser números não negativos e a soma precisa ser maior que zero. O domínio normaliza por segmento; não é obrigatório que a soma seja exatamente 1.
