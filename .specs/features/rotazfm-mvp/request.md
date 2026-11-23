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
