# REAL_SOURCES_VALIDATION — Validação de fontes reais (Etapa 5, parte documental)

Status: validação documental vigente com atualização de 24/11/2026
Data: 23/11/2026 (atualização ANA gov.br/PDF em 24/11/2026)
Escopo: go/no-go por fonte para as dimensões do IAV v2, sem chamadas pagas e sem deploy.

**Método e limites desta etapa**

- Nenhuma API paga foi chamada. `FIRECRAWL_API_KEY`/segredos não foram lidos nem usados; `.env` não foi acessado.
- Fontes verificadas diretamente em 23/11/2026 por HTTP público (páginas oficiais, endpoints públicos e PDFs oficiais), além da leitura de `data/fixtures/*`, `docs/VALIDATION.md`, `docs/INGESTION_COVERAGE.md` e `docs/DATA_SOURCES_EVALUATION.md`.
- Em 24/11/2026, o boletim ANA gov.br foi verificado por HTTP público e PDF: listagem, download `@@download/file` e extração PyMuPDF das quatro estações do corredor.
- Nenhum score, limiar ou endpoint foi inventado. Onde a verificação não foi possível, o item está marcado `BLOQUEADO` com motivo.
- Custo desta etapa: **R$0**.
- Ressalva de rede: `apiprevmet3.inmet.gov.br` e `servicos.dnit.gov.br` não responderam a `curl` a partir do ambiente desta sessão (reset de conexão/timeout), mas as páginas/endpoints foram verificados por acesso web. A ingestão real precisa rodar em ambiente com acesso confirmado a esses hosts (ver §7).

## 1. Quadro resumo (go/no-go)

| Dimensão | Fonte primária | URL de referência | Status | Decisão |
|---|---|---|---|---|
| Nível do rio | ANA gov.br/Sala de Situação boletim diário PDF | `https://www.gov.br/ana/pt-br/sala-de-situacao/rio-amazonas/boletins/diario` | CONFIRMADO em 24/11/2026 | `NECESSITA_NORMALIZACAO` (conversão cm→m feita; threshold de navegabilidade segue configurável/auditável) |
| Nível do rio (contexto/corroboração) | SACE/SGB (SAH Amazonas) | `https://sace.sgb.gov.br/amazonas/` + boletins PDF | CONFIRMADO | `SO_CONTEXTO` ou fallback com frescor |
| Nível do rio (API histórica) | ANA HidroWebService | `https://www.ana.gov.br/hidrowebservice/swagger-ui/index.html` | DESCARTADO nesta regra | não usar tokens/credenciais da ANA |
| Nível operacional do porto | Porto de Manaus (previsão de barcos) | `https://portodemanaus.com.br/previsao-de-barcos/` | CONFIRMADO (página pública) | `SO_CONTEXTO` (não é fonte hidrológica oficial) |
| Regra de navegabilidade | Capitania Fluvial (Marinha) — Portaria 158/CFAOC/2023 | PDF oficial (ver §3.4) | PARCIAL | `NECESSITA_NORMALIZACAO` (pode virar threshold) |
| Chuva | INMET API de previsão por geocódigo | `https://apiprevmet3.inmet.gov.br/previsao/{geocodigo}` | CONFIRMADO | `PODE_ALIMENTAR_SCORE` após normalização do resumo |
| Tráfego (rodovias federais) | DNIT PNCT / dados abertos | `https://servicos.dnit.gov.br/dadosabertos/dataset/contagem-de-trafego` | PARCIAL (dados de 2022) | `SO_CONTEXTO` para score atual; VMD fresco `BLOQUEADO_SEM_FONTE` |
| Tráfego (SP-330) | ARTESP Volume de Tráfego + DER-SP VDM | `https://dadosabertos.artesp.sp.gov.br/dataset/volume-de-trafego` | PARCIAL (cobertura do trecho a confirmar) | `PODE_ALIMENTAR_SCORE` após normalização |
| Tráfego (hidroviário/multimodal) | — | — | BLOQUEADO_SEM_FONTE | `NAO_AVALIAVEL` declarado ou proxy documentado |
| Qualidade da via (federais) | DNIT ICM / dataset condições do pavimento | `https://servicos.dnit.gov.br/dadosabertos/dataset/condicoes-do-pavimento` | CONFIRMADO (dataset mensal até out/2026) | `PODE_ALIMENTAR_SCORE` após extração por km |
| Qualidade da via (SP-330) | DER-SP/ARTESP | a definir | BLOQUEADO_SEM_FONTE | fallback valor fixo documentado |
| Restrição de peso (BR-319) | Portarias DNIT 5.455/2022 e 13/2025 | gov.br + DOU (texto integral verificado) | PARCIAL (vigência atual a confirmar) | `PODE_ALIMENTAR_SCORE` como bloqueador duro |
| Restrição de peso (demais rodovias) | DNIT AET + portarias setoriais | `https://www.gov.br/dnit/pt-br/assuntos/infraestrutura-rodoviaria/aet/restricoes` | PARCIAL | `SO_CONTEXTO`; PBTC por segmento `BLOQUEADO_SEM_FONTE` |
| Notícias relacionadas | DNIT/SGB/ANA/gov.br/DOU + imprensa regional | várias | CONFIRMADO (papel contextual) | `SO_CONTEXTO` (nunca blocker sem `CONFIRMADO`) |
| Notícias (descoberta automatizada) | Firecrawl/Alexandria | — | BLOQUEADO (sem `FIRECRAWL_API_KEY`/créditos) | fixtures locais até spike pago |

## 2. Nível do rio

### 2.1 SACE/SGB — contexto/corroboração (CONFIRMADO)

- **URL corrigida:** a fixture da Etapa 1 usava `https://www.sgb.gov.br/sace/amazonas`, que hoje responde `404`. A página viva é `https://sace.sgb.gov.br/amazonas/` (HTTP 200, verificado em 23/11/2026). Boletins em `https://sace.sgb.gov.br/boletins/Amazonas/` (ex.: 45º boletim de 10/11/2026, PDF HTTP 200).
- **O que é:** Sistema de Alerta de Eventos Críticos do SGB; dados das estações automáticas da Rede Hidrometeorológica Nacional (RHN, responsabilidade da ANA, operadas pelo SGB), recebidos a cada 1 hora por satélite/GSM; consolidados em boletins de monitoramento e alerta.
- **Payload mínimo observável:** tabela do boletim com `rio`, `município/estação`, `nível atual (cm)`, `variação 24h (cm)`, `data do último dado`, `período de cotas máximas/mínimas`; a página da bacia expõe séries horárias das estações.
- **Estações úteis ao MVP (presentes no 45º boletim):** Manaus (Rio Negro, Ponta do Ismael), Itacoatiara, Parintins, Óbidos, Almeirim, além de Tabatinga, Itapéua/Coari, Manacapuru, São Gabriel da Cachoeira, Barcelos, Porto Velho (Madeira), Rio Branco (Acre), Beruri (Purus). **Santarém e Breves não foram confirmadas por esta sessão** — permanecem como item de verificação na amostra controlada (§6).
- **Frescor:** boletim diário + dados horários na página; compatível com `freshness_hours` do MVP se a coleta for diária.
- **Exemplo de dado (verificado):** 45º boletim, 10/11/2026 — Amazonas/Itacoatiara 344 cm; Parintins -34 cm; Óbidos 70 cm; Almeirim 269 cm; Rio Negro/Manaus 1.637 cm. (Valores em cm; a fixture da Etapa 1 usava m — normalização de unidade obrigatória.)
- **Decisão:** `SO_CONTEXTO` como corroboração/fallback. O nível bruto é dado oficial e fresco, mas não substitui o boletim ANA gov.br/PDF e ainda não tem threshold de navegabilidade aprovado para virar score.

### 2.2 ANA gov.br/Sala de Situação — boletim diário PDF (CONFIRMADO em 24/11/2026)

- **Fonte:** `https://www.gov.br/ana/pt-br/sala-de-situacao/rio-amazonas/boletins/diario`, com paginação `?b_start:int=...`; o boletim mais recente disponível foi `boletim_01_amazonas_publica2411-1.pdf` datado de 24/11/2026.
- **Acesso:** HTTP público com User-Agent de navegador; download direto em `...pdf/@@download/file`. Não usa token, cadastro ou ANA HidroWebService.
- **Extração:** `scripts/extract-ana-boletim.py` usa PyMuPDF `get_text('words')` e bounding boxes para separar colunas `Data`, `Nível`, `Referência`, `Limite` e `Diferença` na página 1. Saída converte cm→m e preserva referência/limite/diferença como evidência, sem calcular score.
- **Estações extraídas em 24/11/2026:** Manaus/Rio Negro `14990000` = 15,86 m; Itacoatiara/Amazonas `16030000` = 2,94 m; Óbidos/Amazonas `17050001` = 0,40 m; Santarém/Tapajós `17900000` = 1,16 m. Breves não apareceu na página 1 do boletim e permanece lacuna/fallback seguro.
- **Decisão:** `NECESSITA_NORMALIZACAO` para virar score. O limite do boletim é guardado como `navigation_threshold_m`/referência auditável, mas o IAV continua `NAO_AVALIAVEL` se não houver threshold/regras aprovados ou se o download/parsing falhar.

### 2.3 Porto de Manaus — contexto operacional (CONFIRMADO, só contexto)

- **URL:** `https://portodemanaus.com.br/previsao-de-barcos/` (HTTP 200, verificado).
- **Exemplo:** página mostra nível do rio em metros, calados aproximados por berço (ex.: Torres 21,20 m, Roadway 20,30 m) e data de referência.
- **Decisão:** `SO_CONTEXTO`. Útil para narrativa operacional do terminal, mas não é fonte hidrológica oficial; não deve alimentar score sem confirmação.

### 2.4 Capitania Fluvial — regra de navegabilidade (PARCIAL)

- **Fonte:** Portaria nº 158/CFAOC, de 18/08/2023 (Capitania Fluvial da Amazônia Ocidental) — orientações de navegação em trechos críticos (Passagem do Tabocal, Enseada do Madeira, Enseada do Purus), com critérios de profundidade ≥ 1,5 × calado e FAQM de 0,5/1,0 m.
- **Ressalva:** o PDF verificado nesta sessão está hospedado em CDN de veículo de imprensa; a URL oficial da Marinha/CPAM precisa ser confirmada antes de virar evidência.
- **Decisão:** `NECESSITA_NORMALIZACAO`. É a candidata a **threshold** que falta para o nível do rio virar score (regra de navegabilidade por calado), mas exige: (a) fonte oficial confirmada; (b) decisão de produto sobre como converter nível → score com esse threshold.

## 3. Chuva — INMET (CONFIRMADO)

- **Endpoint:** `https://apiprevmet3.inmet.gov.br/previsao/{geocodigo}` — verificado em 23/11/2026 para Manaus (1302603), Campinas/SP (3509502) e Cuiabá/MT (5103403), confirmando cobertura nacional por município (além de AM/PA/RO já nas fixtures).
- **Payload mínimo observado:** `{geocodigo: {data: {periodo: {uf, entidade, resumo, temp_max, temp_min, dir_vento, int_vento, cod_icone, icone}}}}`. O campo `icone` é base64 e infla o payload — o coletor deve descartá-lo.
- **Exemplo:** Manaus 23/11/2026 manhã — "Muitas nuvens com possibilidade de chuva isolada", temp_max 34, temp_min 27.
- **Frescor:** previsão municipal de 4 dias (DEC-008); atualização diária.
- **Limitação:** não há `precipitation_mm` numérico — o dado é textual (`resumo`). A fixture já reflete isso (`precipitation_mm: null`).
- **Decisão:** `PODE_ALIMENTAR_SCORE` **após normalização determinística** do `resumo` para `rain_signal` (já esboçado em `rain.fixture.json`), sem LLM. Pendência: ampliar geocódigos INMET para os municípios restantes dos 14 segmentos (IBGE `servicodados.ibge.gov.br` é público e sem chave, verificado HTTP 200, e serve de apoio ao mapeamento município→geocódigo).
- **Fallback:** scraping INMET via Firecrawl somente com custo/limite registrado (hoje indisponível sem chave — ver §7).

## 4. Tráfego

### 4.1 Rodovias federais — DNIT PNCT (PARCIAL; VMD fresco BLOQUEADO)

- **Dataset:** `https://servicos.dnit.gov.br/dadosabertos/dataset/contagem-de-trafego` (página verificada). Recursos: Contagem de Tráfego **Dezembro/2022 XLSX** (mais recente), Dezembro/2021 XLSX, Dezembro/2020 CSV, painel pbix e dicionário de dados em PDF. Metadado "Last Updated: 06/10/2025", mas os dados são de 2022.
- **Exemplo de dado:** a página lista "Base de dados Contagem de Tráfego - PNCT ... volume médio anual de veículos"; não foi possível baixar o XLSX nesta sessão (timeout de rede do ambiente, §0).
- **Decisão:** `SO_CONTEXTO` para o score atual. O VMD existe, mas está **defasado (~4 anos)** e não atende `freshness_hours` do MVP; usar como fallback datado e qualificado ou marcar `NAO_AVALIAVEL`. VMD fresco por segmento das rodovias federais: `BLOQUEADO_SEM_FONTE` até confirmar se há PNCT mais recente ou outra base oficial.

### 4.2 SP-330 — novidade desta etapa (PARCIAL → pode alimentar score)

- **ARTESP — Volume de Tráfego:** `https://dadosabertos.artesp.sp.gov.br/dataset/volume-de-trafego` — tráfego em praças de pedágio e SATs das rodovias estaduais concedidas, com CSV diário de 2026 (~19,4 MiB) e séries 2020–2026. Domínio público.
- **DER-SP — VDM:** `https://dadosabertos.sp.gov.br/dataset/volume-diario-medio-das-rodovias-vdm` — Volume Diário Médio 2024 das rodovias administradas pelo DER-SP, em PDF/SHP/XLSX.
- **Pendente:** confirmar se a SP-330 (Anhanguera) está entre as rodovias concessionadas cobertas pelo ARTESP e se o DER-SP publica VDM para ela. Até essa amostra, status `PARCIAL`.
- **Decisão:** `PODE_ALIMENTAR_SCORE` para `r1-s7`/`r2-s7` após normalização (a fixture da Etapa 1 marcava SP-330 como `NÃO_ENCONTRADO` — este documento atualiza esse ponto).

### 4.3 Trechos hidroviário e multimodal — sem fonte (BLOQUEADO)

- Não foi verificada fonte pública de contagem de embarcações/ocupação da balsa Manaus–Careiro ou do comboio fluvial Manaus–Belém. Portaria da Capitania (§2.4) trata de segurança de navegação, não de demanda.
- **Decisão:** `BLOQUEADO_SEM_FONTE`. Opções honestas: `NAO_AVALIAVEL` declarado para a dimensão, ou proxy documentado aprovado por Lucas (ex.: nível de rio + operações do Porto de Manaus como contexto, nunca como VMD).

## 5. Qualidade da via

### 5.1 Rodovias federais — DNIT ICM (CONFIRMADO)

- **Página:** `https://www.gov.br/dnit/pt-br/assuntos/infraestrutura-rodoviaria/icm` (HTTP 200) — metodologia: ICM mensal por segmento de 1 km, classes péssimo/ruim/regular/bom, normativo Resolução nº 5/2022; rodovias pavimentadas por filmagem (DNIT-ICM) e não pavimentadas por ICM Mobile.
- **Dataset:** `https://servicos.dnit.gov.br/dadosabertos/dataset/condicoes-do-pavimento` — CSVs mensais "Condições do Pavimento" e "Condições Não Pavimentada" de Jan/2025 a **Outubro/2026**, por UF, mais dicionário de dados em PDF.
- **Decisão:** `PODE_ALIMENTAR_SCORE` após extração por km/segmento para BR-364, BR-365, BR-050, BR-153, BR-316, BR-010 e BR-319 (incluindo o trecho não pavimentado do crítico `r1-s2`, cuja superfície já está confirmada pelo RIMA). `NECESSITA_NORMALIZACAO`: mapear km do catálogo → linhas do CSV e converter classe ICM em score.
- **Ressalva de rede:** download dos CSVs falhou por timeout no ambiente desta sessão; a ingestão deve ocorrer onde `servicos.dnit.gov.br` for alcançável (§7).

### 5.2 SP-330 e demais estaduais (BLOQUEADO)

- DNIT ICM cobre rodovias federais; SP-330 é estadual. Não foi verificada fonte pública de condição de pavimento da SP-330 (DER-SP/ARTESP).
- **Decisão:** `BLOQUEADO_SEM_FONTE` para qualidade em SP-330; fallback: valor fixo documentado e datado, com `confirmation_status` explícito, ou `NAO_AVALIAVEL` se a dimensão for obrigatória sem fallback aceito.

## 6. Restrição de peso / PBTC

### 6.1 BR-319 — texto integral das portarias verificado (PARCIAL → conflito resolvido documentalmente)

- **Portaria nº 5.455/2022** (`https://www.gov.br/dnit/pt-br/central-de-conteudos/atos-normativos/tipo/portarias/portaria-no-5-455-2022`, Superintendência Regional de Rondônia, DOU 22/09/2022): Art. 2º proíbe PBTC > 23 t jun–out; Art. 3º proíbe PBTC > 17 t nov–mai; Art. 6º proíbe tráfego noturno 18h–06h; segmento km 250,7–679,3; revoga Portaria 372/2021; exceção por AET no Art. 4º.
- **Portaria nº 13/2025** (`https://www.in.gov.br/web/dou/-/portaria-n-13-de-2-de-janeiro-de-2025-605860792`, Superintendência Regional do Amazonas, DOU 08/01/2025, p. 84): revoga Portarias 4.251/2024 e 6.854/2023; proíbe PBTC > 45 t dez–jun no segmento km 1,0–679,3. **Não revoga a 5.455/2022.**
- **Resolução do conflito documentado na fixture:** as normas são **complementares, não contraditórias** — órgãos regionais distintos, limiares e abrangências diferentes, e a 13/2025 revoga apenas portarias de 2023/2024. Regra conservadora adotável: por data e km, aplicar o limite mais restritivo (nov–mai: 17 t em km 250,7–679,3; jun–out: 23 t; dez–jun: teto adicional de 45 t para cargas; noturno 18h–06h proibido em km 250,7–679,3).
- **Pendente:** confirmar se existe ato posterior (2025/2026) que revogue ou altere a 5.455/2022 — não localizado nesta sessão. Até lá, status `PARCIAL`.
- **Decisão:** `PODE_ALIMENTAR_SCORE` como **bloqueador duro** (RF-008) quando PBTC da carga exceder o limite vigente do trecho.

### 6.2 Demais rodovias — AET não é PBTC geral (PARCIAL)

- AET 10/2026 (página `https://www.gov.br/dnit/pt-br/assuntos/infraestrutura-rodoviaria/aet/restricoes`, HTTP 200) trata de veículos com dimensões/pesos excedentes **portando autorização**; não equivale ao PBTC máximo para carga fracionada.
- **Decisão:** `SO_CONTEXTO` para AET. PBTC por segmento das demais rodovias federais e estaduais: `BLOQUEADO_SEM_FONTE` — fallback: tabela estática "não verificada" datada, nunca assumir liberado (RF-008).

## 7. Notícias relacionadas (SO_CONTEXTO)

- **Fontes aceitáveis como contexto:** DNIT (notícias e alertas de serviço), SGB, ANA, DOU e imprensa regional (G1, etc.) — sempre com URL, data e `matched_segments[]`.
- **Papel:** `related_news[]` contextual; **nunca** blocker sem `confirmation_status = CONFIRMADO` e regra explícita (DEC-017, RF-010).
- **Descoberta automatizada:** Firecrawl/Alexandria continua `BLOQUEADO` nesta sessão (sem chave/créditos); fixtures locais de `related_news.fixture.json` cobrem os testes até o spike pago.
- **Exemplo verificado:** notícias DNIT de pavimentação BR-319 (29/10/2026) e alerta de interdição BR-010/316 (2022, já `EXPIRADO` na fixture) — coerentes com a política de frescor.

## 8. Plano mínimo de amostras controladas (próxima etapa)

Objetivo: validar payload real → normalização → `route_condition_facts`, em testes, sem chamadas pagas. Orçamento: **0 chamadas Firecrawl/Alexandria**; no máximo ~7 requisições gratuitas.

| # | Fonte | Amostra | O que validar | Critério de aprovação |
|---|---|---|---|---|
| 1 | INMET | `GET /previsao/1302603` (Manaus) e `GET /previsao/3509502` (Campinas) | payload JSON sem campo `icone`, `resumo` → `rain_signal` determinístico, janela de 4 dias | 2 evidências normalizadas com `content_hash` e `freshness_hours`; teste unitário com payload anonimizado |
| 2 | ANA gov.br/SGB SACE | listagem `boletins/diario` + PDF `boletim_01_amazonas_publica2411-1.pdf`, página 1 | estações `14990000`, `16030000`, `17050001`, `17900000`; colunas Data/Nível/Referência/Limite/Diferença; Breves ausente | 4 estações do corredor extraídas com coordenadas; Santarém confirmada, Breves mantida `INDISPONIVEL`/fallback |
| 3 | DNIT ICM | CSV `levantamentos_pavimentada_2026_10.csv` e `levantamentos_nao_pavimentada_2026_10.csv` (download direto) | colunas do dicionário, km por rodovia, classe ICM | amostra de linhas BR-319/BR-364/BR-153 extraída e mapeada aos segmentos; se download falhar por rede, registrar bloqueio e não contornar |
| 4 | DNIT PNCT | XLSX Contagem de Tráfego Dez/2022 | se há linhas para BR-364/BR-153/BR-010/BR-010 com VMD | extrair amostra; declarar defasagem de 4 anos no `freshness_hours` |
| 5 | ARTESP | CSV "Tráfego nas praças de pedágio por dia em 2026" | presença de pontos na SP-330 Anhanguera | se coberto, 1 fato de tráfego para `r1-s7`/`r2-s7`; senão manter `BLOQUEADO_SEM_FONTE` |
| 6 | DOU/gov.br | portarias 5.455/2022 e 13/2025 (já verificadas) | vigência atual — busca por ato revogatório posterior | registro em `docs/DECISIONS.md` ou manutenção de `PARCIAL` |
| 7 | Notícias | 3 páginas oficiais (DNIT/SGB) via HTTP direto | `related_news[]` com fonte/data/URL, nenhum blocker | nenhum item sem `CONFIRMADO` em `blockers[]` |

Validação de cada amostra: payload bruto salvo antes da normalização (RF-003), `content_hash` deduplicando, e teste unitário/integração cobrindo o caminho feliz e a falha de fonte.

## 9. Bloqueios e dependências externas

1. **ANA HidroWebService:** descartado pela nova regra; não pedir cadastro, token ou credencial. Usar boletim PDF gov.br via `scripts/extract-ana-boletim.py`.
2. **Firecrawl/Alexandria:** precisa de `FIRECRAWL_API_KEY` e orçamento de créditos para spike de descoberta/filtro de notícias e scraping de páginas frágeis (INMET/DNIT se o acesso direto falhar). Nenhuma chamada paga feita nesta etapa.
3. **Rede do ambiente de ingestão:** `apiprevmet3.inmet.gov.br` e `servicos.dnit.gov.br` não responderam a `curl` nesta VM; confirmar acesso a partir do ambiente que fará a coleta ou usar Firecrawl pago.
4. **Limiares de navegabilidade:** decisão de produto (Lucas) necessária para converter nível do rio em score; sem isso a dimensão fica `SO_CONTEXTO`.
5. **SP-330 qualidade:** fonte estadual (DER-SP/ARTESP) pendente de verificação.
6. **Vigência atual das portarias BR-319:** confirmar ausência de ato revogatório posterior.
7. **Tráfego hidroviário/multimodal e PBTC das demais rodovias:** sem fonte pública verificada; aceitar `NAO_AVALIAVEL`/fallback documentado ou buscar fonte específica.

## 10. Confirmação de escopo

- A rodada documental original não alterou `apps/`/`packages/`; a atualização de 24/11/2026 adicionou `scripts/extract-ana-boletim.py`, fixture `data/fixtures/ana_boletim_river_level.fixture.json`, fallback de probe e remoção da dependência de credencial ANA.
- Nenhuma chamada paga, nenhuma leitura de `.env`/segredos, nenhum deploy.
- Nenhum score, limiar ou endpoint foi inventado; itens não verificados estão marcados `BLOQUEADO` com motivo.
