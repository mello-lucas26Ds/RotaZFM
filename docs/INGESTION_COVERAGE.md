# INGESTION_COVERAGE — Auditoria de cobertura de fixtures (Etapa 2)

Status: auditoria documental vigente
Data: 23/11/2026
Escopo: `data/fixtures/*.json` × `data/routes/mvp-routes.json` × fórmula IAV v2 (`docs/SDD.md` §4, `docs/DECISIONS.md` DEC-022)

**Confirmação de método:** nenhuma consulta externa foi feita nesta etapa. Toda a evidência abaixo vem da leitura local de `data/routes/mvp-routes.json`, `data/fixtures/*.json`, `docs/SDD.md`, `docs/SPEC.md`, `docs/DECISIONS.md` e `docs/VALIDATION.md`. Nenhum dado foi inventado; lacunas são declaradas como lacunas.

## 1. Dimensões aplicáveis por modo (IAV v2)

| Modo do segmento | Dimensões obrigatórias | Pesos |
|---|---|---|
| `rodoviario` | chuva, trafego, qualidade, restricao (renormalizado /0,70) | 0,25 / 0,20 / 0,15 / 0,10 |
| `hidroviario` / `multimodal` | nivel, chuva, trafego, qualidade, restricao | 0,30 / 0,25 / 0,20 / 0,15 / 0,10 |

Status de cobertura usados nesta matriz:

- **CONFIRMADO** — existe valor/fato utilizável para o segmento com `confirmation_status = CONFIRMADO`.
- **PARCIAL** — existe fonte/dataset ou cobertura incompleta (um município de vários, ICM ou VMD nulo, estação faltante), sem valor numérico final.
- **AUSENTE** — nenhuma evidência para o segmento.
- **CONFLITANTE** — fontes oficiais se sobrepõem sem vigência consolidada (apenas `weight_restriction` em `r1-s2`).
- **N/A** — dimensão não se aplica ao modo.

Observação transversal de frescor: as fixtures declaram `freshness_hours = 96` (chuva e nível do rio), acima do limite de 24 h da RF-005. Mesmo os itens CONFIRMADO aparecem como defasados pela regra atual; isso precisa de decisão antes da Etapa 5 (ver §4).

## 2. Matriz rota 1 — `rota-1-br-319` (Manaus → São Paulo)

### `r1-s1-balsa-inicial` (multimodal, crítico)

| Dimensão | Fixture | Status | Detalhe |
|---|---|---|---|
| nivel | `river_level.fixture.json` | PARCIAL | Estação Careiro (Amazonas/Solimões) confirmada; Manaus/Rio Negro sem leitura operacional e sem limiar de navegabilidade da balsa. |
| chuva | `rain.fixture.json` | CONFIRMADO | Manaus (geocódigo 1302603), manhã/tarde. |
| trafego | `traffic.fixture.json` | AUSENTE | Modal misto sem PNCT rodoviário; sem fonte aquaviária/portuária. |
| qualidade | `road_quality.fixture.json` | AUSENTE | Sem registro para o segmento multimodal; decisão "proxy de navegabilidade ou N/A" pendente. |
| restricao | `weight_restrictions.fixture.json` | AUSENTE | Sem portaria/restrição mapeada para a travessia Manaus–Careiro. |

Tendência com fixtures atuais: **NAO_AVALIAVEL** (tráfego, qualidade e restrição ausentes; nível parcial).

### `r1-s2-floresta-br319` (rodoviário, crítico)

| Dimensão | Fixture | Status | Detalhe |
|---|---|---|---|
| chuva | `rain.fixture.json` | PARCIAL | Humaitá confirmado; segmento cobre Careiro da Várzea→Porto Velho (Borba, Beruri, Manicoré, Tapauá, Canutama) sem geocódigos. |
| trafego | `traffic.fixture.json` | AUSENTE | `no_current_count_post_confirmed`; BR-319/AM sem contagem atual confirmada. |
| qualidade | `road_quality.fixture.json` | PARCIAL | Superfície não pavimentada CONFIRMADA (RIMA km 250,7–656,4, 405,7 km); ICM numérico nulo. |
| restricao | `weight_restrictions.fixture.json` | CONFLITANTE | Portaria 5.455/2022 (PBTC 17 t nov–mai / 23 t jun–out, 18h–06h) × Portaria 13/2025 (PBTC >45 t dez–jun, km 1,0–679,3); vigência consolidada pendente de confirmação. |

Tendência: **NAO_AVALIAVEL** (tráfego ausente, qualidade sem ICM, restrição conflitante, chuva parcial).

### `r1-s3-rondonia-br364` (rodoviário)

| Dimensão | Fixture | Status | Detalhe |
|---|---|---|---|
| chuva | `rain.fixture.json` | PARCIAL | Porto Velho confirmado; Vilhena, Ariquemes, Ji-Paraná e Cacoal sem cobertura. |
| trafego | `traffic.fixture.json` | PARCIAL | Dataset PNCT existe; linhas por trecho não extraídas (`dataset_exists_rows_not_extracted`). |
| qualidade | `road_quality.fixture.json` | PARCIAL | Dataset ICM DNIT existe; valores por segmento não extraídos. |
| restricao | `weight_restrictions.fixture.json` | AUSENTE | `NÃO_ENCONTRADO` para BR-364/RO; fallback tabela estática não verificada. |

Tendência: **NAO_AVALIAVEL** (tráfego/qualidade sem valor, restrição ausente, chuva parcial).

### `r1-s4-mato-grosso-br364` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Comodoro, Cáceres, Cuiabá, Rondonópolis sem geocódigo) |
| trafego | `traffic.fixture.json` | PARCIAL (dataset PNCT, linhas não extraídas) |
| qualidade | `road_quality.fixture.json` | PARCIAL (dataset ICM, valores não extraídos) |
| restricao | `weight_restrictions.fixture.json` | AUSENTE (`NÃO_ENCONTRADO` BR-364/MT) |

Tendência: **NAO_AVALIAVEL**.

### `r1-s5-goias-br364` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Jataí, Rio Verde) |
| trafego | `traffic.fixture.json` | PARCIAL |
| qualidade | `road_quality.fixture.json` | PARCIAL |
| restricao | `weight_restrictions.fixture.json` | AUSENTE (`NÃO_ENCONTRADO` BR-364/GO) |

Tendência: **NAO_AVALIAVEL**.

### `r1-s6-minas-br365-br050` (rodoviário)

| Dimensão | Fixture | Status | Detalhe |
|---|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Ituiutaba, Uberlândia) |
| trafego | `traffic.fixture.json` | PARCIAL | Duas rodovias; mapear km por UF pendente. |
| qualidade | `road_quality.fixture.json` | PARCIAL | BR-365/BR-050 no dataset ICM pendente de extração. |
| restricao | `weight_restrictions.fixture.json` | PARCIAL | AET 10/2026 MG/GO localizado; portarias específicas por trecho pendentes. |

Tendência: **NAO_AVALIAVEL**.

### `r1-s7-sao-paulo-sp330` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Ituverava, Ribeirão Preto, Araraquara, Campinas) |
| trafego | `traffic.fixture.json` | AUSENTE (`state_road_outside_dnit_pnct_scope`; precisa DER-SP/ARTESP) |
| qualidade | `road_quality.fixture.json` | AUSENTE (`INDISPONIVEL`; fonte estadual pendente) |
| restricao | `weight_restrictions.fixture.json` | AUSENTE (`NÃO_ENCONTRADO`; fonte estadual pendente) |

Tendência: **NAO_AVALIAVEL** — segmento sem nenhuma dimensão com valor.

## 3. Matriz rota 2 — `rota-2-fluvial-brasilia` (Manaus → São Paulo)

### `r2-s1-fluvial-amazonas` (hidroviário, crítico)

| Dimensão | Fixture | Status | Detalhe |
|---|---|---|---|
| nivel | `river_level.fixture.json` | PARCIAL | Itacoatiara, Parintins, Óbidos, Almeirim confirmadas (SGB/SAH); Santarém e Breves `INDISPONIVEL`; Manaus/embarque `NAO_CONFIRMADO`; sem limiares de calado/navegabilidade. |
| chuva | `rain.fixture.json` | PARCIAL | Itacoatiara, Parintins, Santarém, Almeirim, Óbidos confirmados; Breves e Manaus sem cobertura. |
| trafego | `traffic.fixture.json` | AUSENTE | Hidroviário sem PNCT; requer fonte de navegação/terminal ou proxy documentado. |
| qualidade | `road_quality.fixture.json` | AUSENTE | `INDISPONIVEL`; dimensão terrestre não se aplica e a SPEC/SDD ainda não definiram proxy de navegabilidade. |
| restricao | `weight_restrictions.fixture.json` | AUSENTE | Sem restrição mapeada para o trecho fluvial. |

Tendência: **NAO_AVALIAVEL** (tráfego, qualidade e restrição ausentes; nível e chuva parciais).

### `r2-s2-para-br316-br010` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | PARCIAL (Belém confirmado; Santa Maria do Pará, Paragominas sem cobertura) |
| trafego | `traffic.fixture.json` | PARCIAL (duas rodovias federais, linhas não extraídas) |
| qualidade | `road_quality.fixture.json` | PARCIAL (dataset ICM pendente) |
| restricao | `weight_restrictions.fixture.json` | PARCIAL (AET 10/2026 PA localizado; portarias específicas pendentes) |

Tendência: **NAO_AVALIAVEL** (nenhuma dimensão com valor final).

### `r2-s3-maranhao-br010` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Açailândia, Imperatriz) |
| trafego | `traffic.fixture.json` | PARCIAL |
| qualidade | `road_quality.fixture.json` | PARCIAL |
| restricao | `weight_restrictions.fixture.json` | PARCIAL (cruzamento AET por UF pendente) |

Tendência: **NAO_AVALIAVEL**.

### `r2-s4-tocantins-br153` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Araguaína, Guaraí, Paraíso do Tocantins, Gurupi) |
| trafego | `traffic.fixture.json` | PARCIAL |
| qualidade | `road_quality.fixture.json` | PARCIAL |
| restricao | `weight_restrictions.fixture.json` | PARCIAL (AET 10/2026 TO localizado) |

Tendência: **NAO_AVALIAVEL**.

### `r2-s5-goias-br153` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Porangatu, Uruaçu, Anápolis, Goiânia, Itumbiara) |
| trafego | `traffic.fixture.json` | PARCIAL |
| qualidade | `road_quality.fixture.json` | PARCIAL |
| restricao | `weight_restrictions.fixture.json` | AUSENTE (`NÃO_ENCONTRADO` BR-153/GO) |

Tendência: **NAO_AVALIAVEL**.

### `r2-s6-minas-br153-br050` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Prata, Uberlândia) |
| trafego | `traffic.fixture.json` | PARCIAL |
| qualidade | `road_quality.fixture.json` | PARCIAL |
| restricao | `weight_restrictions.fixture.json` | PARCIAL (AET 10/2026 MG/GO localizado) |

Tendência: **NAO_AVALIAVEL**.

### `r2-s7-sao-paulo-sp330` (rodoviário)

| Dimensão | Fixture | Status |
|---|---|---|
| chuva | `rain.fixture.json` | AUSENTE (Ribeirão Preto, Campinas) |
| trafego | `traffic.fixture.json` | AUSENTE (`state_road_outside_dnit_pnct_scope`) |
| qualidade | `road_quality.fixture.json` | AUSENTE (`INDISPONIVEL`) |
| restricao | `weight_restrictions.fixture.json` | AUSENTE (`NÃO_ENCONTRADO`) |

Tendência: **NAO_AVALIAVEL** — segmento sem nenhuma dimensão com valor.

## 4. Síntese

### 4.1 Status previsto por segmento com as fixtures atuais

| Rota | Segmento | Modo | Dimensões com valor final | Dimensões ausentes/parciais/conflitantes | Status previsto |
|---|---|---|---|---|---|
| rota-1 | r1-s1-balsa-inicial | multimodal | 0 de 5 | nivel PARCIAL, chuva CONFIRMADO, trafego/qualidade/restricao AUSENTE | NAO_AVALIAVEL |
| rota-1 | r1-s2-floresta-br319 | rodoviario | 0 de 4 | chuva PARCIAL, trafego AUSENTE, qualidade PARCIAL, restricao CONFLITANTE | NAO_AVALIAVEL |
| rota-1 | r1-s3-rondonia-br364 | rodoviario | 0 de 4 | chuva PARCIAL, trafego/qualidade PARCIAL, restricao AUSENTE | NAO_AVALIAVEL |
| rota-1 | r1-s4-mato-grosso-br364 | rodoviario | 0 de 4 | chuva AUSENTE, trafego/qualidade PARCIAL, restricao AUSENTE | NAO_AVALIAVEL |
| rota-1 | r1-s5-goias-br364 | rodoviario | 0 de 4 | chuva AUSENTE, trafego/qualidade PARCIAL, restricao AUSENTE | NAO_AVALIAVEL |
| rota-1 | r1-s6-minas-br365-br050 | rodoviario | 0 de 4 | chuva AUSENTE, trafego/qualidade/restricao PARCIAL | NAO_AVALIAVEL |
| rota-1 | r1-s7-sao-paulo-sp330 | rodoviario | 0 de 4 | todas AUSENTE | NAO_AVALIAVEL |
| rota-2 | r2-s1-fluvial-amazonas | hidroviario | 0 de 5 | nivel/chuva PARCIAL, trafego/qualidade/restricao AUSENTE | NAO_AVALIAVEL |
| rota-2 | r2-s2-para-br316-br010 | rodoviario | 0 de 4 | todas PARCIAL | NAO_AVALIAVEL |
| rota-2 | r2-s3-maranhao-br010 | rodoviario | 0 de 4 | chuva AUSENTE, demais PARCIAL | NAO_AVALIAVEL |
| rota-2 | r2-s4-tocantins-br153 | rodoviario | 0 de 4 | chuva AUSENTE, demais PARCIAL | NAO_AVALIAVEL |
| rota-2 | r2-s5-goias-br153 | rodoviario | 0 de 4 | chuva/restricao AUSENTE, trafego/qualidade PARCIAL | NAO_AVALIAVEL |
| rota-2 | r2-s6-minas-br153-br050 | rodoviario | 0 de 4 | chuva AUSENTE, demais PARCIAL | NAO_AVALIAVEL |
| rota-2 | r2-s7-sao-paulo-sp330 | rodoviario | 0 de 4 | todas AUSENTE | NAO_AVALIAVEL |

Conclusão: **nenhum segmento das duas rotas produz IAV numérico com as fixtures atuais**; ambas as rotas consolidam como `NAO_AVALIAVEL` (RF-007/RF-009). Os piores trechos seriam os críticos `r1-s2-floresta-br319` e `r2-s1-fluvial-amazonas`, mas a rota já é `NAO_AVALIAVEL` por `missing_data[]` em todos os trechos.

### 4.2 Lacunas objetivas que impedem IAV numérico

1. **Tráfego (todas as rotas):** nenhuma fixture tem VMD/valor por segmento. O dataset PNCT existe, mas as linhas por UF/rodovia/km não foram extraídas; SP-330 está fora do escopo DNIT; trechos multimodal/hidroviário não têm fonte de tráfego própria. Sem valor, a dimensão é obrigatória e o trecho vira `NAO_AVALIAVEL`.
2. **Qualidade da via (todas as rotas):** apenas `r1-s2` tem fato de superfície confirmado; ICM numérico é nulo em todos os registros. SP-330 e o fluvial estão `INDISPONIVEL`; o proxy de navegabilidade para `r2-s1` não foi definido.
3. **Chuva (maioria dos segmentos):** só 9 municípios têm observação INMET. Cobertura ausente para Rondônia (exceto Porto Velho), MT, GO, MG, SP, PA (exceto Belém), MA e TO. Além disso `precipitation_mm` é `null` em todas as observações.
4. **Nível do rio (hidro/multimodal):** faltam estações Santarém e Breves no `r2-s1`, leitura operacional de Manaus para `r1-s1` e, principalmente, **limiares de navegabilidade** (calado/nível mínimo) — sem eles o nível bruto não vira score.
5. **Restrição de peso/PBTC:** vigência consolidada das Portarias 5.455/2022 e 13/2025 em `r1-s2` está `CONFLITANTE`; PBTC numérico das demais rodovias federais não foi extraído das portarias/AET; trechos multimodal/hidroviário e SP-330 sem fonte.
6. **Frescor:** `freshness_hours = 96` nas fixtures de chuva e nível do rio excede o limite de 24 h da RF-005; é preciso decidir se o valor representa janela de validade aceitável ou defasagem, e alinhar com a regra antes da Etapa 5.
7. **Catálogo × fixtures:** `routes.catalog.fixture.json` é apenas snapshot de contrato; não adiciona cobertura de dimensão.

### 4.3 Lista mínima de fixtures/fallbacks antes da Etapa 5

Sem inventar dados; cada item abaixo é fixture ou fallback documentado, não valor estimado:

1. **Tráfego:** extrair do PNCT linhas por segmento para BR-364/BR-365/BR-050/BR-153/BR-010/BR-316/BR-319 (com `vmd_estimated` ou equivalente, `unit`, `effective_from`, `freshness_hours`); definir fonte estadual para SP-330 (DER-SP/ARTESP) ou fallback datado explícito; definir proxy documentado para tráfego fluvial (`r2-s1`) e travessia multimodal (`r1-s1`) ou aceitar `NAO_AVALIAVEL` declarado.
2. **Qualidade:** extrair ICM por segmento dos CSVs DNIT (`levantamentos_pavimentada_2026_10.csv`, `levantamentos_nao_pavimentada_2026_10.csv`) para as rodovias federais; resolver fonte de SP-330; decidir formalmente se `r2-s1` usa proxy de navegabilidade ou dimensão N/A.
3. **Chuva:** ampliar `rain.fixture.json` com geocódigos INMET dos municípios restantes dos 14 segmentos (ou declarar segmento sem cobertura como `NAO_AVALIAVEL`); decidir política para `precipitation_mm` nulo.
4. **Nível do rio:** obter/registrar limiares de navegabilidade Manaus–Belém (calado, nível mínimo por estação) em fonte oficial; cobrir Santarém e Breves ou marcá-los `INDISPONIVEL` com fallback de última leitura válida dentro do frescor.
5. **Restrição:** confirmar vigência consolidada Portaria 5.455/2022 × 13/2025 com fonte oficial (Lucas/DNIT) e registrar PBTC por segmento/UF a partir das portarias/AET; definir tratamento de PBTC para multimodal/hidroviário.
6. **Frescor:** alinhar `freshness_hours` das fixtures à regra de 24 h ou registrar exceção documentada em `docs/DECISIONS.md`.
7. **Cenários C01–C20:** recalibrar `tests/e2e/scenarios.json` depois dos itens acima; hoje os alvos numéricos são de fixture e não têm lastro de normalizadores.

### 4.4 Confirmação de escopo

- Nenhuma consulta externa, API, scraping ou chamada paga foi realizada nesta auditoria.
- Nenhum código foi alterado; o PR contém somente este documento.
- Nenhum dado de fixture foi inventado ou corrigido; lacunas foram registradas como estão nos arquivos de origem.
