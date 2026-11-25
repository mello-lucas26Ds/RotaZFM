# Request — rotazfm-mvp

## User message 1 (verbatim)

Você está trabalhando no repositório `/home/ubuntu/repos/RotaZFM`.

Objetivo desta rodada: analisar a base documental do RotaZFM, confrontar com o PR #1 e produzir um plano de correção/reconstrução. Não implemente código nesta rodada; primeiro planeje e valide.

Fontes-base obrigatórias:
1. `rotazfm-system-design-e-plano.md`
2. `rotazfm-critica-arquitetural-e-premortem.md`

Se os arquivos estiverem anexados nesta sessão, use os anexos. Se estiverem no filesystem desta VM, os caminhos atuais são:
- `/home/ubuntu/attachments/d1b1d38c-92a9-4c8a-b252-afa75ffffb46/rotazfm-system-design-e-plano.md`
- `/home/ubuntu/attachments/b486a57e-83f8-4cab-ac0c-416530da1c82/rotazfm-critica-arquitetural-e-premortem.md`

Esses arquivos podem conter informações repetidas e representam uma base/outra ótica do projeto. Não presuma que tudo deve entrar no projeto. A avaliação do que é útil ou não deve seguir o fluxo da skill `tlc-spec-lean`; não faça uma triagem por opinião própria antes de aplicar a skill.

Contexto do repositório:
- PR aberto: #1, `chore: inicializar estrutura do RotaZFM`
- Branch do PR: `devin/1794275904-rotazfm-initial-structure`
- Repo: `https://github.com/mello-lucas26Ds/RotaZFM`
- Eu sou Lucas, responsável humano pela validação final.
- Samuelson, Maria e Cris não são pessoas reais neste fluxo: são subagents/papéis que você deve organizar para executar tarefas.
- Não temos gestores do PIM para entrevistar. Substitua validações dependentes de entrevista por pesquisa documental, premissas explícitas, fixtures, casos verificáveis e critérios objetivos.
- AIHOT.news é referência estrutural oficial, mas não deve ser copiado cegamente. LLM não calcula IAV nem escolhe rota.

Passos obrigatórios:
1. Instale a skill usando Node via nvm:
   `source ~/.nvm/nvm.sh && npx -y @tech-leads-club/agent-skills install --skill tlc-spec-lean`
   Se a instalação falhar, pare e reporte o erro antes de continuar.
2. Leia as instruções da skill instalada e siga o fluxo dela para analisar os dois markdowns.
3. Leia também `AGENTS.md`, `Plan.md`, `README.md`, `docs/PRD.md`, `docs/SPEC.md`, `docs/TEST_PLAN.md`, `docs/EXECUTION_BOARD.md`, `docs/PROJECT_STRUCTURE.md`, `docs/DECISIONS.md`, `docs/AIHOT_REFERENCE.md` e o diff do PR #1.
4. Produza uma matriz de aproveitamento dos dois markdowns com os campos:
   - item/tema;
   - origem (`system-design-e-plano` ou `critica-arquitetural-e-premortem`);
   - decisão da skill: adotar, adaptar, rejeitar ou adiar;
   - justificativa curta;
   - destino no projeto: `PRD`, `SPEC`, `SDD`, `TEST_PLAN`, `DECISIONS`, `EXECUTION_BOARD`, `PROJECT_STRUCTURE` ou código futuro;
   - dependência ou risco.
5. Confronte essa matriz com o que já existe no PR #1 e liste:
   - o que está alinhado;
   - o que está desatualizado;
   - o que falta;
   - o que deve ser removido, simplificado ou movido.
6. Reorganize o plano de execução em etapas pequenas. Cada etapa deve ter:
   - objetivo;
   - tarefa;
   - subagent/responsável: Samuelson, Maria, Cris ou Lucas;
   - dependências;
   - validação;
   - critério de aceite.
7. Deixe explícito que Samuelson, Maria e Cris são subagents/papéis operacionais. Se a ferramenta permitir, crie ou proponha subagents/sessões para eles; se não permitir, documente como papéis executáveis com prompts de tarefa.
8. Elimine qualquer dependência de entrevistas com gestores. Use validação substituta explícita.
9. Proponha a correção do PR em ordem de prioridade, começando pelo menor incremento que reduza risco e aumente validabilidade.
10. Não altere código nesta rodada. Se for necessário alterar documentação para refletir o plano, faça apenas depois de apresentar o plano e eu aprovar.

Formato obrigatório da resposta final:
1. Fontes analisadas.
2. Matriz de utilidade produzida pela skill.
3. Confronto entre os markdowns e o PR #1.
4. Plano de correção por etapas e subagents.
5. Riscos e decisões pendentes.
6. O que preciso aprovar ou fornecer antes da implementação.

Não invente requisitos. Se faltar informação essencial, pergunte antes de planejar a implementação.

## User message 2 (verbatim)

ROTA 1: Via BR-319 (Pelo interior / Centro-Oeste)

(Aproximadamente 3.850 km)
1. Travessia Inicial (Balsa): Manaus (AM) ➔ cruza os rios Negro e Solimões ➔ Careiro da Várzea (AM) (início da BR-319).
2. Trecho Floresta — BR-319: Careiro da Várzea ➔ Careiro (Castanho) ➔ Humaitá (AM) ➔ Porto Velho (RO) (trecho crítico com ~400 km sem asfalto).
3. Trecho Rondônia — BR-364: Porto Velho ➔ Ariquemes ➔ Ji-Paraná ➔ Cacoal ➔ Vilhena (RO).
4. Trecho Mato Grosso — BR-364: Vilhena (RO) ➔ Comodoro ➔ Cáceres ➔ Cuiabá ➔ Rondonópolis (MT).
5. Trecho Goiás — BR-364: Rondonópolis (MT) ➔ Jataí ➔ Rio Verde ➔ São Simão (GO).
6. Trecho Minas Gerais — BR-365 e BR-050: São Simão (GO) ➔ Ituiutaba ➔ Uberlândia (pega a BR-050) ➔ Uberaba (MG).
7. Trecho São Paulo — SP-330 (Via Anhanguera): Uberaba (MG) ➔ Ituverava ➔ Ribeirão Preto ➔ Araraquara ➔ Campinas ➔ São Paulo (SP).

ROTA 2: Via Balsa até Belém (Pelo Rio Amazonas + Belém-Brasília)

(Aproximadamente 1.500 km de rio + 2.900 km de estrada)
1. Trecho Fluvial (Rio Amazonas - Balsa): Manaus (AM) ➔ Itacoatiara (AM) ➔ Parintins (AM) ➔ Óbidos (PA) ➔ Santarém (PA) ➔ Almeirim (PA) ➔ Breves (PA) ➔ Belém / Barcarena (PA).
2. Trecho Pará — BR-316 e BR-010: Belém ➔ Santa Maria do Pará (pega a BR-010) ➔ Paragominas ➔ Ulianópolis (PA).
3. Trecho Maranhão — BR-010: Ulianópolis (PA) ➔ Açailândia ➔ Imperatriz ➔ Estreito (MA).
4. Trecho Tocantins — BR-153 (Belém-Brasília): Estreito (MA) ➔ Araguaína ➔ Guaraí ➔ Paraíso do Tocantins (acesso a Palmas) ➔ Gurupi (TO).
5. Trecho Goiás — BR-153: Gurupi (TO) ➔ Porangatu ➔ Uruaçu ➔ Anápolis ➔ Goiânia ➔ Itumbiara (GO).
6. Trecho Minas Gerais — BR-153 e BR-050: Itumbiara (GO) ➔ Prata ➔ Uberlândia (pega a BR-050) ➔ Uberaba (MG).
7. Trecho São Paulo — SP-330 (Via Anhanguera): Uberaba (MG) ➔ Ribeirão Preto ➔ Campinas ➔ São Paulo (SP).
, O nome sera IAV,precisamos otimizar o mais rapido possivel para testar, a coleta de dados, e tambem validar se a biblioteca de alexandria pode nos ajudar, e criar um filtro de noticias relacionadas, para aparecer junto.nosso deploy sera na vercel so no final.eu repassei detalhadamente para voce o trecho para que fique melhor.usaremos carga seca/containerizada com os padreos de transportes que deve cnter em cada caminhao peso bruto total, ele deve decidir o criterio de usar um ou outro,e deve ter na arquitetrura formas de implementar outros serviso ou adicionar mais dados futuramente9microservicos,aprovo o plano com essa ressalvas me diga o que preciso ainda lhe responder e as duvidas para enxugarmos ele e comecar as construcoes, ausenica de dadospuxar ultima atualziar,voce tem autorizzacao para editar a pr e quando finalziar iremos comecar a construir, cire prompt atarefa para os demais subagents par aque consigamos abrangir e comecar a cnstruir, separa a parte de .env com quais api key serao necessarias, nao podemos desperdicar consultar a toa, mas confirmar que estamos receebndoos dados e limpos enoramlziados catarves dos testes. lembre dos criterios de segurancaa com a skill  do tech leads sera quem manda tirar o que, nao é um super projeto mas algo que preisa ser aprensetavel e defensavel simpls de enteder e oq ue faz;eu sou o Melo, e comando com voce a orquestracao desss subagents. boa sorte e pode comecar, voce ira seguri tbm e instalar esses dois skill para que execute com direcao clara,

curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g
npx skills add DietrichGebert/ponytail --skill ponytail
segue

## User message 3 (verbatim)

Atue como Engenheiro de Software Sênior autônomo. Seu objetivo é resolver todas as pendências do PR #9, implementar as regras de negócio abaixo e validar a suíte de testes sem pedir aprovação a cada passo. Pare e me pergunte APENAS se precisar de uma chave de API que não esteja no `.env`.

### 1. Credenciais, Extração Direta (GOV.BR/ANA) e Teste de Rede (Execute primeiro)
- **Substituição da API da ANA (NOVA REGRA):** Não utilizaremos mais tokens/credenciais da API da ANA. Remova essa dependência do `.env` e do código.
- **Scraping e Leitura de PDF (Sala de Situação):** Implemente a extração direta a partir da página `https://www.gov.br` buscando o link do boletim diário mais recente (padrão `https://www.gov.br/boletins/diario/boletim_01_amazonas_publicaDDMM-1.pdf`), aplicando *fallback* automático para a data mais recente disponível no topo da página caso o boletim do dia atual ainda não tenha sido publicado.
- **Teste Prático Obrigatório (Executar agora):** Rode um script de teste extraindo os dados da **Página 1** do boletim PDF especificamente para o corredor/caminho das seguintes estações:
  1. `MANAUS - RIO NEGRO` (Código 14990000)
  2. `ITACOATIARA - RIO AMAZONAS` (Código 16030000)
  3. `ÓBIDOS - RIO AMAZONAS` (Código 17050001)
  4. `SANTARÉM - RIO TAPAJÓS` (Código 17900000)
  *(Extraia Data, Nível em cm, Referência, Limite em cm e Diferença em cm — utilize leitura baseada em coordenadas/bounding boxes como `pdfplumber` ou `PyMuPDF` para não misturar as colunas da grade do PDF).*
- **Demais Credenciais e Rede:** Verifique o arquivo `.env`. Se `FIRECRAWL_API_KEY` estiver ausente, crie mocks/fallbacks locais para não travar os testes. Teste via terminal a conectividade com `servicos.dnit.gov.br` e `apiprevmet3.inmet.gov.br` (implementando fallback automático com log de aviso em caso de bloqueio/timeout).

### 2. Regras de Negócio e Normas DNIT (Decisões Aprovadas)
- **Normas de Peso (DNIT/CONTRAN):** Aplique os limites da Resolução CONTRAN nº 882/2021 para PBTC nas rodovias federais. Para rodovias estaduais ou sem dado específico de PBTC, retorne status `NAO_AVALIAVEL` com fallback seguro (sem bloquear a rota, apenas sinalizando ausência de dado).
- **Portarias BR-319 e SP-330:** Assuma a vigência das portarias mais recentes disponíveis nas fontes oficiais raspadas. Para a SP-330 (Anhanguera), priorize dados da ARTESP/DER-SP; se indisponível, marque qualidade como `NAO_AVALIAVEL`.
- **Tráfego Hidroviário e Limiar de Navegabilidade:** Utilize os dados extraídos do PDF do boletim da ANA (convertendo leituras de **cm para metros**, dividindo por 100) para as estações do corredor (incluindo Santarém e Breves, se disponível; caso Breves não conste no boletim diário, aplique fallback seguro). Defina o limiar de alerta de navegabilidade com base na cota de atenção/estiagem histórica (Cota 95% / Limite do boletim) ou parâmetro ajustável em config, usando `NAO_AVALIAVEL` como fallback caso o download/parsing do PDF falhe.
- **PNCT 2022:** Utilize os dados do PNCT 2022 apenas como referência secundária/fallback, adicionando uma flag/reason code indicando `dado_historico_defasado`.
- **Normalização:** Conclua a conversão do resumo do INMET para `rain_signal` e agregue o DNIT ICM por km em segmentos contínuos.

### 3. Correções Técnicas e Fechamento do PR #9
- **Fixtures (C01–C20):** Materialize todas as fixtures por cenário garantindo alinhamento estrito entre score, frescor e `reason_codes`.
- **Cenário C18:** Emita o bloqueador genérico `confirmed_restriction` quando houver restrição de PBTC ou portaria vigente bloqueando o trecho.
- **Sensibilidade de Pesos:** Documente a matriz de pesos atual em `/docs/pesos.md` e deixe os pesos injetáveis via configuração/variáveis de ambiente.
- **Banco de Dados (PostgreSQL):** Adie formalmente a persistência em PostgreSQL neste PR. Mantenha a execução stateless/em memória e registre um TODO arquitetural documentado.
- **Autenticação do Dashboard:** Implemente proteção básica via Basic Auth ou Token via variável de ambiente (`DASHBOARD_AUTH_TOKEN`) antes de qualquer deploy em ambientes não-locais (Vercel/staging).

### 4. Validação Obrigatória (Rode e corrija até passar)
- Execute todos os testes unitários e de integração cobrindo C01 a C20.
- Execute o teste E2E de browser validando especificamente o `EMPTY_STATE` do dashboard (cenário C20).
- Ao finalizar, me entregue apenas:
  1. Resumo do que foi alterado (incluindo a saída real do teste de extração das 4 estações do PDF);
  2. Status dos testes;
  3. Lista curta de chaves/tokens que preciso colar no `.env` (sem incluir tokens da ANA).
