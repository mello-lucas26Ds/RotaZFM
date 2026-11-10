# TEST_PLAN — RotaZFM MVP

Status: plano inicial  
Data: 09/11/2026

## Escopo testado

- Fórmula e guardrails do IAV.
- Normalização e validação das fontes.
- Persistência de payload bruto e fatos.
- API interna e MCP.
- Dashboard ponta a ponta.
- Autenticação, entrada inválida e rate limit.

## Escopo não testado no MVP

- Custo real de frete.
- Disponibilidade de caminhão/motorista.
- Eventos políticos, greves ou bloqueios não capturados pelas fontes.
- Calibração estatística dos pesos.

## Tipos de teste

| Nível | O que testar | Ferramenta prevista |
|---|---|---|
| Unitário | Fórmula IAV, limites, dados ausentes, PBTC excedido, validação de schema | Vitest ou Jest |
| Integração | Coletor → `raw_payloads` → `route_condition_facts` → API/MCP | Banco local |
| Contrato | Saída do MCP segue schema; campos obrigatórios presentes | MCP Inspector |
| E2E | Dashboard recebe entrada e mostra IAV/justificativa | Playwright |
| Segurança | Sem API key, chave inválida, payload malicioso, rate limit | Testes automatizados |
| Smoke diário | Coleta, motor e MCP rodam; IAV entre 0 e 100 | Script agendado |
| Sensibilidade | Pesos ±5 pontos; documentar se recomendação muda | Script/manual |

## Casos mínimos

### Positivos

- Todas as cinco dimensões com dado fresco: IAV completo 0–100.
- Uma dimensão ausente: IAV parcial declarado.
- Duas rotas retornam justificativa com fontes e datas.
- MCP responde com API key válida.

### Negativos

- Chamada MCP sem API key retorna 401.
- Data inválida ou origem/destino desconhecidos são rejeitados.
- Payload com campos extras ou tipos inválidos é rejeitado.
- Fonte indisponível usa último valor válido com alerta.

### Limites

- Score exatamente 0 e 100 são aceitos.
- Score fora de 0–100 falha internamente e não é publicado.
- Dado de rio com mais de 24h fica marcado como defasado.
- Chuva acima de 100 mm/dia marca evento crítico.
- Restrição de peso excedida torna rota inviável mesmo com IAV alto.

## Dados de teste

- Fixtures em `data/fixtures` para cada fonte.
- Payloads brutos reais anonimizados quando possível.
- Massa de dados para IAV completo, parcial, inválido e com fonte indisponível.

## Critérios de aprovação

- `npm run lint` sem erros.
- `npm run test` sem falhas.
- `npm run build` concluído.
- MCP Inspector valida `consultar_viabilidade`.
- Dashboard E2E cobre caminho feliz e erro.
- Nenhuma decisão é exibida sem fonte/data/qualidade.

## Comandos previstos

Os comandos finais serão definidos quando a stack for inicializada. Base mínima esperada:

```bash
npm install
npm run lint
npm run test
npm run build
```
