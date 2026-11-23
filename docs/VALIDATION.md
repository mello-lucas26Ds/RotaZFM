# Validação documental e plano substituto — RotaZFM MVP

Status: Etapa 1 concluída em modo documental/fixtures
Data: 23/11/2026
Escopo: validação das fontes e criação de fixtures locais; sem implementação de IAV, API, MCP ou dashboard; sem chamadas pagas a Firecrawl/Alexandria/routekit.

## 1. Resultado executivo

- Os dois trechos críticos catalogados foram validados documentalmente: BR-319 trecho florestal sem asfalto e Manaus–Belém/Barcarena fluvial.
- Pontos de PBTC/restrição conhecidos foram mapeados, com destaque para sobreposição sazonal na BR-319/AM entre Portaria 5.455/2022 e Portaria 13/2025.
- Fontes mínimas por dimensão foram registradas com URL, data de verificação e status. Tráfego e qualidade da via ficaram `PARCIAL` por dependerem de extração de datasets DNIT ainda não concluída.
- Fixtures locais determinísticas foram criadas em `data/fixtures/` para catálogo, nível do rio, chuva, tráfego, qualidade da via, restrição de peso e notícias relacionadas.
- Firecrawl/Alexandria podem ajudar no filtro de notícias por rota/trecho, mas não serão fonte primária do IAV sem normalização e confirmação oficial. Custo desta etapa: R$0.

## 2. Validação documental dos trechos críticos

| Trecho | Evidência documental | Status | Observação |
|---|---|---|---|
| `r1-s2-floresta-br319` — BR-319 Careiro da Várzea → Porto Velho | RIMA DNIT indica segmento km 250,7–656,4, extensão 405,7 km, municípios Borba, Beruri, Manicoré, Tapauá, Canutama e Humaitá; notícias DNIT de 2026 confirmam Lote C km 198,2–218,2 e manutenção/conservação. | CONFIRMADO | Trecho crítico com extenso trecho não pavimentado; obras pontuais não devem ser generalizadas. |
| `r2-s1-fluvial-amazonas` — Manaus → Belém/Barcarena | SGB/SAH monitora estações em Itacoatiara, Parintins, Óbidos, Almeirim e Careiro; notícias de seca/vazante e operação portuária contextualizam o trecho. | CONFIRMADO | Leitura específica de Santarém/Breves ficou como lacuna; operacionalidade depende de calado, terminais e avisos. |
| PBTC/restrições BR-319 | Portaria 5.455/2022 e Portaria 13/2025 confirmadas em página DNIT/DOU; AET temporárias 10/2026 localizadas por UF. | PARCIAL | Sobreposição de regras exige confirmação da vigência consolidada; regra conservadora adotada nas fixtures. |

## 3. Fontes mínimas por dimensão

| Dimensão | Fonte primária | Verificação | Status | Fallback |
|---|---|---|---|---|
| Nível do rio | SGB/SAH Amazonas — `https://www.sgb.gov.br/sace/amazonas` | 23/11/2026 | CONFIRMADO | último valor válido com atraso; ANA futura após autorização |
| Chuva | INMET direto — `https://apiprevmet3.inmet.gov.br/previsao/{geocodigo}` | 23/11/2026 | CONFIRMADO | scraping INMET via Firecrawl somente com custo/limite registrado |
| Tráfego | DNIT PNCT/dados abertos — `https://servicos.dnit.gov.br/dadosabertos/dataset/contagem-de-trafego` | 23/11/2026 | PARCIAL | tabela estática datada; BR-319/AM sem contagem atual confirmada |
| Qualidade da via | DNIT ICM — `https://servicos.dnit.gov.br/dadosabertos/dataset/condicoes-do-pavimento` + RIMA BR-319 | 23/11/2026 | PARCIAL | valor fixo documentado; SP-330 e trecho fluvial sem fonte terrestre confirmada |
| Restrição de peso | Portarias DNIT/DOU — Portaria 5.455/2022 e Portaria 13/2025 | 23/11/2026 | PARCIAL | tabela estática "não verificada"; regra conservadora em sobreposição |
| Notícias relacionadas | Busca documental + fontes oficiais/noticiosas | 23/11/2026 | PARCIAL | fixtures locais; Firecrawl/Alexandria só para descoberta/filtro contextual |

## 4. Fixtures criadas

| Arquivo | Conteúdo | Uso esperado |
|---|---|---|
| `data/fixtures/routes.catalog.fixture.json` | Snapshot dos IDs de rotas/trechos críticos a partir de `data/routes/mvp-routes.json` | Testes de contrato RF-001 sem duplicar catálogo canônico |
| `data/fixtures/river_level.fixture.json` | Leituras SGB/SAH, lacunas Santarém/Breves e cenários mock de vazante/baixa | Testar dimensão nível do rio, frescor e `NAO_AVALIAVEL` |
| `data/fixtures/rain.fixture.json` | Previsões INMET por geocódigo para Manaus, Humaitá, Porto Velho, Itacoatiara, Parintins, Santarém, Almeirim, Óbidos e Belém | Testar dimensão chuva sem scraping |
| `data/fixtures/traffic.fixture.json` | Cobertura PNCT por segmento, com status e fallback; sem VMD inventado | Testar `NAO_AVALIAVEL`/fallback e pendência de extração DNIT |
| `data/fixtures/road_quality.fixture.json` | BR-319 não pavimentado confirmado; ICM pendente; SP-330 e fluvial sem fonte terrestre | Testar qualidade da via e exceções modais |
| `data/fixtures/weight_restrictions.fixture.json` | Portarias 5.455/2022 e 13/2025, AET 10/2026 e conflito conservador | Testar bloqueio PBTC e sobreposição sazonal |
| `data/fixtures/related_news.fixture.json` | Notícias/contextos por rota/trecho, incluindo itens expirados/parciais | Testar `related_news[]` contextual, nunca bloqueador sem confirmação |

Validação executada: todos os JSONs foram parseados com `python -m json.tool` e passaram. Nos fixtures, `confirmation_status` segue o enum de RF-004 (`CONFIRMADO | NAO_CONFIRMADO | CONFLITANTE | INDISPONIVEL | EXPIRADO | NAO_AVALIAVEL`); os status documentais `PARCIAL`/`NÃO_ENCONTRADO` ficam em `source_status`, `coverage` ou notas de lacuna.

## 5. Firecrawl/Alexandria — avaliação sem chamadas pagas

- **Pode ajudar:** descoberta de fontes oficiais, leitura de páginas/PDFs difíceis e filtro de notícias por rota/trecho.
- **Não pode ser fonte primária do IAV:** saída precisa ser normalizada em `raw_payloads`/`route_condition_facts` e confirmada por fonte oficial quando a dimensão exigir.
- **Limites registrados:** Firecrawl cobra créditos por endpoint; Search = 2 créditos/10 resultados, Scrape = 1 crédito/página; planos variam. Alexandria tem discovery gratuito, execução por preço da tool e pode exigir aceite de termos por provider/admin. Acesso keyless não inclui Alexandria.
- **Termos:** termos Firecrawl revisados em 07/10/2026; providers terceiros podem impor termos adicionais.
- **Custo/limite desta etapa:** nenhuma chamada paga realizada; custo R$0. Qualquer spike futuro deve registrar créditos estimados, endpoint, provider e fallback antes de executar.

## 6. Plano de validação substituta — sem entrevistas

1. **Contrato de fixtures:** carregar os JSONs de `data/fixtures/` e validar presença dos campos obrigatórios de evidência (`source`, `source_url`, `published_at`, `collected_at`, `method`, `content_hash`, `confirmation_status`, `effective_from`, `effective_until`, `freshness_hours`, `last_valid_at` quando reutilizada).
2. **Cobertura por dimensão:** para cada dimensão do IAV, confirmar que existe fonte primária, fallback e fixture correspondente; ausência deve resultar em `NAO_AVALIAVEL` ou fallback explícito, nunca valor inventado.
3. **Cenários determinísticos:** usar os cenários mock das fixtures para testar:
   - rota normal com dados frescos;
   - nível do rio baixo/alto;
   - chuva forte;
   - tráfego ausente;
   - PBTC excedido;
   - notícia contextual sem bloqueio.
4. **Regras de bloqueio:** verificar que restrição de peso confirmada bloqueia; notícia `PARCIAL`/`NAO_CONFIRMADO` não bloqueia; dado velho/conflitante gera `NAO_AVALIAVEL`.
5. **Sensibilidade:** rodar o IAV com variação de ±5 pontos por dimensão e confirmar que a fórmula consolidada por pior trecho e bloqueadores se mantém estável.
6. **Documentação:** manter `DATA_SOURCES_EVALUATION.md`, `VALIDATION.md` e fixtures sincronizados a cada nova fonte ou mudança de status.

## 7. Critérios objetivos de aceite desta etapa

- [x] Trechos críticos validados documentalmente com fonte oficial ou notícia identificada.
- [x] Fontes mínimas por dimensão registradas com URL, data de verificação, status e fallback.
- [x] Fixtures locais criadas para catálogo, nível do rio, chuva, tráfego, qualidade da via, restrição de peso e notícias.
- [x] Fixtures não dependem de API paga e estão em JSON válido.
- [x] Firecrawl/Alexandria avaliados sem chamada paga e com limites/termos registrados.
- [x] `docs/DATA_SOURCES_EVALUATION.md` atualizado.
- [x] Perguntas essenciais pendentes registradas abaixo.

## 8. Perguntas objetivas para Lucas

1. **PBTC BR-319:** a Portaria 5.455/2022 continua vigente para km 250,7–679,3 em paralelo à Portaria 13/2025, ou existe ato posterior que a revoga/substitui? Até confirmação, podemos adotar a regra conservadora documentada na fixture?
2. **Tráfego BR-319/AM:** existe fonte atual confiável de contagem de tráfego para o trecho florestal, ou devemos aceitar explicitamente `NAO_AVALIAVEL`/fallback estático não verificado para essa dimensão no MVP?
3. **Nível do rio:** quais estações e limites operacionais devem ser usados para classificar navegabilidade Manaus–Belém? SACE/SGB fornece nível, mas o MVP precisa de threshold ou referência de calado/terminal.
4. **Notícias:** quais fontes noticiosas são aceitas como contexto oficial do projeto e há orçamento/conta Firecrawl prevista para spike controlado de filtro de notícias?

## 9. Riscos e pendências

- Extração de linhas específicas dos CSVs DNIT de tráfego e ICM ainda está pendente; por isso tráfego e qualidade da via estão `PARCIAL`.
- SP-330 é rodovia estadual e pode ficar fora do escopo DNIT; precisa fonte estadual ou fallback documentado.
- O trecho fluvial não tem dimensão "qualidade da via" terrestre; é necessário decidir se usa proxy de navegabilidade ou trata como N/A no IAV.
- Qualquer uso de Firecrawl/Alexandria em etapa futura deve registrar custo, créditos, provider e fallback antes de chamar API paga.
