# Histórico — plano técnico de operação clínica dentro do Sponteiro

> Registro de levantamento de julho de 2026. As premissas de OCI, Oracle e
> Sponteiro abaixo não descrevem a produção atual da Clínica Viver Mais, que
> usa Hostinger VPS. Para infraestrutura vigente, consulte
> [`docs/hostinger-vps.md`](./docs/hostinger-vps.md).

Documento interno. Referência: proposta comercial da Bells Clinic à Viver Mais
(26/07/2026, R$ 890/mês, instância Oracle dedicada em `vivermais.bellsclinic.com.br`).

O objetivo aqui não é responder àquela proposta, e sim espelhar o escopo dela e
executá-lo na nossa própria infraestrutura, reaproveitando o que a plataforma já
tem. Vale a premissa registrada em memória: o Sponteiro substitui o sistema
legado por inteiro, não convive com ele.

Complementa `docs/oci-migracao.md`, que descreve a migração Firebase → OCI. Este
plano assume aquele documento como base de infraestrutura e não repete o que já
está lá.

Duas decisões de 29/07/2026 tiraram este plano do puro espelhamento. O WhatsApp
deixa de ser só canal de saída e ganha **robô de atendimento** (seção 7), e o
cruzamento entre quem procura a clínica e o psicólogo que atende vira
funcionalidade, não visão de futuro. A proposta externa não tem nenhum dos dois.

**Estado em 29/07/2026.** Já existem no repositório: o cliente da Evolution API
com monitor de sessão, opt-out e status de envio (`lib/whatsapp/*`,
`app/api/clinica/whatsapp/webhook`); o schema clínico completo
(`infra/mysql/004_clinica.sql`); e a regra de indicação
(`lib/clinica/matching.ts`). Schema e matching foram exercitados contra um MySQL
9.7.2 descartável — mesma linha do 9.7.1 da OCI — e o resultado está registrado
nas seções 5 e 7.2. Nada disso encostou na OCI ainda. Faltam o roteiro da
conversa, o trabalhador que esvazia a fila de envio, e tudo que depende da VM.

---

## 1. Escopo espelhado e situação real

Os oito módulos da proposta externa, confrontados com o que existe hoje no
repositório.

| # | Escopo da proposta | Situação no Sponteiro | Onde está |
| --- | --- | --- | --- |
| 01 | Usuários e acessos | Parcial — controle por perfil funciona, mas `/clinica` não está mapeada e não existe papel de psicólogo | `lib/permissoes.ts`, `lib/auth-context.tsx` |
| 02 | Agenda | Parcial — CRUD de agendamento existe; sem confirmação, remarcação, bloqueio de conflito ou lembrete | `components/agenda-clinica-manager.tsx`, `lib/clinica.ts` |
| 03 | Atendimento | Parcial — cadastro de paciente existe; **prontuário e evolução não existem** | `components/pacientes-clinicos-manager.tsx` |
| 04 | Documentos | Parcial — motor de documento assinado com validação pública já existe no acadêmico; falta o conjunto clínico | `lib/doc-token.ts`, `lib/cert-token.ts`, `lib/supervisao-token.ts` |
| 05 | Financeiro | Pronto e acima do escopo proposto — DRE, despesas, cobrança Asaas, webhook idempotente, conciliação, comissões | `app/api/financeiro/*`, `lib/oci/financeiro-migration.ts` |
| 06 | WhatsApp | Parcial — cliente, webhook, opt-out e monitor de sessão prontos; falta o trabalhador de envio e as réguas | `lib/whatsapp/*`, `app/api/clinica/whatsapp/webhook` |
| 07 | NPS | Parcial — módulo existe e o tipo `"clinica"` já está previsto; falta campanha em massa e público de inativos | `lib/satisfaction.ts` |
| 08 | IA | Pronto e acima do escopo proposto — transcrição ao vivo, feedback de supervisão gerado, revisado, assinado e validável | `lib/use-assembly-live.ts`, `lib/supervisao.ts`, `app/api/ia/*` |
| 09 | **Robô de atendimento e indicação** — fora do escopo da proposta externa | Parcial — modelagem e regra de matching prontas; falta o roteiro da conversa | `infra/mysql/004_clinica.sql`, `lib/clinica/matching.ts` |

Conclusão do levantamento: o trabalho real está concentrado em **prontuário**,
**robô de atendimento** e **régua de cobrança**. O restante é acabamento sobre
base existente.

A vantagem estrutural de fazer internamente não é preço, é topologia de dados.
Uma instância isolada de fornecedor coloca o paciente em um banco separado do
aluno, do estagiário e do supervisor. Aqui eles ficam na mesma base, que é a
única forma de sustentar matching da clínica-escola, taxa de ocupação e DRE
consolidado — os três itens que aparecem como visão de futuro no
`levantamento-funcionalidades-e-apresentacao.md`.

O item 09 é a prova disso: indicar paciente a psicólogo exige ler, na mesma
consulta, especialidade, disponibilidade e fila de espera. Numa instância de
fornecedor isso seria integração entre dois sistemas; aqui é um `SELECT`.

---

## 2. Decisões de arquitetura

**D1 — O sistema opera 100% no MySQL OCI (sem Firestore).**
Prontuário, agendamentos, triagem e dados cadastrais rodam nativamente no MySQL. Isso garante retenção
legal com prazo, trilha de auditoria de leitura, registro imutável com
retificação rastreável e consultas relacionais diretas.

**D2 — Paciente, agendamento e prontuário nascem nativamente no MySQL.**
Sem necessidade de espelhamento ou escrita dupla. A aplicação Web consulta e persiste diretamente nas rotas de servidor (API) conectadas ao MySQL OCI.

**D3 — Paciente e aluno são entidades distintas com vínculo opcional.**
`clinica_pacientes.pessoa_ref` aponta para o aluno ou egresso quando existir. É
esse campo que habilita, depois, matching e ocupação. Sem ele, a clínica vira
um silo dentro da própria casa — exatamente o defeito da proposta externa.

**D4 — Todo acesso aos dados clínicos passa obrigatoriamente por rotas de servidor.**
Qualquer leitura ou alteração de prontuários entra por API autenticada no Next.js Server Side que registra auditoria em `clinica_acessos_prontuario`.

**D5 — Anexos clínicos não vão para o MySQL.** O DB System Always Free tem 50 GiB
e é o ativo mais caro de substituir. Áudio, imagem e PDF ficam em Object Storage
(camada Always Free, 20 GB) com referência na tabela; o banco guarda metadado e
hash.

**D6 — O robô tria e indica; não agenda.** Ele identifica a pessoa, entende a
demanda, cruza com os profissionais cadastrados e entrega o contato ao psicólogo
escolhido. Quem combina dia e hora é o próprio psicólogo, direto com a pessoa.
Isso troca a pergunta difícil ("o robô pode marcar sozinho na agenda de um
profissional?") por uma fácil ("o robô pode apresentar duas pessoas?"), e mantém
o julgamento clínico do primeiro contato com quem tem CRP.

**D7 — Queixa em texto livre não vira campo estruturado.** Para
`clinica_encaminhamentos` vai apenas o tema classificado — `ansiedade`, `luto`,
`casal` —, que é o que o cruzamento precisa. O relato como a pessoa escreveu fica
em `clinica_conversas_mensagens`, com expurgo por `expira_em`. Relato de
sofrimento guardado sem prazo numa tabela de triagem é prontuário sem as regras
de prontuário.

**D8 — Entregar contato ao profissional é compartilhamento, e tem hora.** A
pessoa é avisada antes de o contato dela sair, e a entrega grava
`contato_liberado_em`. Sem isso, "o psicólogo vai te chamar" é uma promessa sem
rastro de quem recebeu o quê e quando.

---

## 3. Correções de acesso — fazer antes de qualquer feature

Três problemas encontrados no levantamento, todos anteriores ao escopo clínico.

1. **`/clinica` não está mapeada em `lib/permissoes.ts`.** `podeAcessarCaminho`
   termina em `return true` para papéis não previstos. Hoje `responsavel`
   alcança a área clínica, e `professor` — que devia supervisionar — não
   alcança, porque `/clinica` não está em `ROTAS_PROFESSOR`. O fallback precisa
   virar `return false`, com as rotas declaradas explicitamente.

2. **Não existe papel clínico.** `Role` tem `admin`, `diretora`, `financeiro`,
   `secretaria`, `professor`, `responsavel`. Faltam `psicologo` (vê apenas os
   próprios pacientes) e `recepcao` (vê agenda e cadastro, nunca evolução).
   Enquanto não existirem, "sigilo por profissional" não é implementável.

3. **`firestore.rules` lê o papel clínico de `escolas/{clinicaId}/usuarios`.**
   O namespace de dados é `clinicas/`, o de identidade é `escolas/`. Funciona
   porque hoje o id é o mesmo, e quebra silenciosamente no dia em que não for.
   Resolver junto com o papel clínico.

O `delete: if false` já presente nas duas coleções clínicas está correto e deve
ser mantido como padrão do domínio.

---

## 4. Infraestrutura

O que a proposta externa vende como 1 OCPU / 8 GB / 100 GB por R$ 890/mês já
existe aqui em camada Always Free, conforme `docs/oci-migracao.md`: MySQL 9.7.1,
1 ECPU, 8 GiB, 50 GiB, `sa-vinhedo-1`, endpoint privado, TLS `VERIFY_CA`
validado. O que falta é o mesmo item que aquele documento já registra como
próxima etapa — subir a aplicação dentro da VCN.

Sequência, sem novidade em relação ao `oci-migracao.md`:

1. VM Compute Always Free em sub-rede pública da `vcn-viver-mais-prod`.
2. Regras mínimas: SSH 22 restrito ao IP administrativo; 80/443 público;
   3306 apenas da NSG da aplicação para a sub-rede do banco.
3. Runtime em container supervisionado, com reinício automático.
   Junto dele sobe o **Evolution API** (seção 6) como container próprio, com
   volume persistente para o estado de sessão e o datastore que a versão fixada
   exigir. Isso muda o dimensionamento da VM: não é mais só a aplicação Next.
   Escolher o shape considerando os dois processos.
4. Proxy HTTPS e subdomínio **no domínio da própria Viver** (ex.:
   `clinica.vivermaispsicologia.com.br`). Custo adicional zero, contra um
   subdomínio de terceiro na proposta externa.
5. Segredos na VM fora do Git; migrar para OCI Vault na sequência.
6. Remover a regra temporária de 3306 originada do Cloud Shell.

**Capacidade.** Adotar os mesmos gatilhos de revisão que a proposta externa
declara, agora medidos por nós e expostos em `/api/infra/oci/status`: CPU ≥ 70%
sustentado, RAM ≥ 80% sustentado, disco ≥ 75%, p95 acima de 1,5 s. Envelope de
referência igual: 150–200 cadastrados, até 50 simultâneos. A diferença é que
estourar o envelope aqui significa subir de shape, não renegociar contrato.

---

## 5. Modelagem — `infra/mysql/004_clinica.sql`

O DDL fica no arquivo, não aqui: manter o mesmo schema em dois lugares é
exatamente como as duas versões divergem. Este documento guarda o inventário e
as escolhas que não se leem no SQL.

Segue as convenções do `001_financeiro.sql`: `CHAR(36)` como id, `instituicao_id`
em toda tabela, `TIMESTAMP(3)`, InnoDB, `utf8mb4_0900_ai_ci`, unicidade
explícita para idempotência.

| Tabela | Papel |
| --- | --- |
| `clinica_profissionais` | psicólogos, estagiários e supervisores; telefone, gênero, valores, modalidades e teto de fila |
| `clinica_profissionais_especialidades` | especialidade em linha própria, porque indicação filtra por igualdade |
| `clinica_pacientes` | paciente, com `pessoa_ref` para o aluno/egresso quando existir |
| `clinica_disponibilidades` | janelas recorrentes por dia e horário, com `turno` derivado |
| `clinica_agendamentos` | sessão, com unicidade de slot no banco |
| `clinica_evolucoes` | registro clínico append-only, com retificação rastreável |
| `clinica_documentos` | documento clínico com validação pública |
| `clinica_consentimentos` | consentimento por finalidade, com revogação |
| `clinica_encaminhamentos` | indicação de paciente a profissional, com critérios e trilha |
| `clinica_mensagens` | fila de saída do WhatsApp, com status do provedor |
| `clinica_conversas` | conversa do robô: etapa, contexto e quem responde agora |
| `clinica_conversas_mensagens` | turnos da conversa, com expurgo obrigatório por `expira_em` |
| `clinica_acessos_prontuario` | trilha de leitura e escrita de prontuário |

Observações de implantação:

- `clinica_agendamentos_slot_uq` impede dois agendamentos no mesmo horário do
  mesmo profissional no próprio banco, sem depender de checagem na aplicação.
  Com robô e recepção operando ao mesmo tempo, essa linha deixa de ser zelo e
  passa a ser o que impede agenda dobrada.
- A deduplicação de envio mudou de forma: `clinica_mensagens.chave_dedupe` é
  montada pela aplicação (`lembrete24h:agendamento:<id>`,
  `encaminhamento:<id>`). A chave composta anterior dependia de
  `agendamento_id`, e coluna nula não deduplica em `UNIQUE` — o aviso ao
  profissional, que não tem agendamento, escapava.
- `clinica_conversas.telefone_aberto` é coluna gerada: repete o telefone
  enquanto a conversa está aberta e vira `NULL` quando encerra. É assim que o
  banco garante uma única conversa viva por número sem perder o histórico.
- **A revogação de `DELETE` para `viver_mais_app@10.20.%` deixou de ser
  possível como estava prevista.** O expurgo de `clinica_conversas_mensagens`
  por `expira_em` é uma exclusão legítima e obrigatória. O alinhamento passa a
  ser por escopo: negar `DELETE` nas tabelas de registro clínico e permitir
  apenas onde a retenção curta exige.
- A fila de disparo reaproveita `jobs_execucoes`, que já existe e já tem
  idempotência por `(fila, chave_idempotencia)`. Não criar fila nova.

**Validação (29/07/2026).** O arquivo foi aplicado em um MySQL 9.7.2 em
container descartável, sobre o `001_financeiro.sql`, e depois aplicado de novo:
as 13 tabelas nascem na ordem certa e a segunda passada não quebra. As três
garantias que dependem do banco foram testadas por violação deliberada, não por
inspeção:

| Garantia | Prova |
| --- | --- |
| Agenda dobrada | Segundo agendamento no mesmo horário do mesmo profissional recusado por `clinica_agendamentos_slot_uq` |
| Aviso repetido ao profissional | Segunda mensagem com a mesma `chave_dedupe` recusada; mensagens avulsas sem chave continuam entrando |
| Duas conversas vivas no mesmo número | Segunda conversa aberta recusada; após encerrar a primeira, a nova entra e o histórico permanece |

O que isso ainda **não** prova: que o schema aplica no DB System da OCI. Lá o
usuário é restrito e o `viver_mais_app` não tem DDL — a aplicação precisa de
credencial administrativa e continua pendente.

---

## 6. WhatsApp — Evolution API

**Situação.** A integração da aplicação está feita: cliente da API, rota de
webhook autenticada por token, estado da sessão persistido com alerta na
primeira queda, opt-out por palavra-chave e status de envio mapeado dos eventos
do provedor. O que falta é infraestrutura — a VM, o pareamento do número — e o
trabalhador que esvazia `clinica_mensagens`.

**Provedor: Evolution API auto-hospedada**, não a Cloud API da Meta. A decisão
troca a natureza do problema, e vale registrar a troca com clareza.

O que se ganha: custo zero por mensagem (contra tarifação por conversa iniciada
pela empresa), nenhuma aprovação de template, nenhuma verificação de Meta
Business, mensagem livre sem a restrição de janela de 24 h, e o número que a
clínica já usa continua sendo o mesmo — sem migrar contato ou histórico.

O que se perde: a conexão não é oficial. Ela se comporta como um cliente
WhatsApp pareado, o que significa risco real de bloqueio do número por volume ou
padrão de envio, queda de sessão exigindo novo pareamento, e nenhuma garantia de
entrega contratual. Não existe suporte a acionar. **Esse risco é de operação
contínua, não de implantação** — some do cronograma e reaparece todo mês.

Consequência direta no plano: **o caminho crítico externo deixa de existir.** O
módulo de WhatsApp sai da lista de dependências com espera de terceiro e passa a
depender só de nós. Em compensação, entra um componente de infraestrutura para
manter de pé.

**Componente.** Container próprio na mesma VM, com volume persistente para o
estado de autenticação da sessão e o datastore exigido pela versão fixada
(a v2 usa PostgreSQL e Redis; confirmar na versão que for adotada e fixar a tag
da imagem — não usar `latest` em produção). A API fica **exclusivamente na rede
interna**: sem porta pública, alcançável só pela aplicação, autenticada por
chave que vive nos segredos da VM.

**Perda de sessão é o modo de falha mais perigoso**, porque é silencioso: a
sessão cai, a fila continua enfileirando, nada é entregue e ninguém percebe até
um paciente faltar. Tratar como incidente de primeira classe:

- Consumir o evento de mudança de conexão e persistir o estado.
- Expor a saúde da sessão em `/api/infra/oci/status`, junto de MySQL e Redis.
- Alertar na primeira falha, não no acumulado.
- Runbook de repareamento por QR documentado antes de entrar em produção, com
  responsável nomeado — repareamento é presencial e manual.
- Backup do volume de sessão junto do backup do banco.

**Modelagem de envio.** As mensagens continuam versionadas por `template` em
`clinica_mensagens`, mesmo sem aprovação externa: o campo deixa de ser um id da
Meta e passa a ser o identificador interno do texto. Isso preserva a
deduplicação por `clinica_mensagens_dedupe_uq` e permite auditar o que foi dito
a cada paciente. Textos iniciais, um por finalidade: lembrete 24 h, confirmação
de presença, aviso de remarcação, cobrança pré-vencimento, cobrança
pós-vencimento, convite de NPS e aviso de encaminhamento ao profissional.

**Status.** O mapeamento de `clinica_mensagens.status` passa a vir dos eventos
da Evolution (envio, entrega, leitura, falha). Mensagem que fica em `enviada`
além de um limite de tempo vira pendência operacional, porque nessa arquitetura
"sem confirmação" costuma significar sessão caída, não atraso de rede.

**Anti-bloqueio — obrigatório, não recomendação.** É a diferença entre a régua
funcionar e a clínica perder o número:

- Throttle de envio com intervalo mínimo e jitter aleatório entre mensagens.
- Teto diário de disparos, configurável, com a fila respeitando a sobra para o
  dia seguinte em vez de estourar.
- Campanha de NPS de inativos (seção 9) é o maior fator de risco de bloqueio de
  todo o escopo: volume alto, destinatários frios, texto repetido. Diluir em
  vários dias, com lote pequeno, e nunca disparar junto da régua de cobrança.
- Priorizar a fila: lembrete e confirmação antes de cobrança, cobrança antes de
  NPS. Se o teto diário for atingido, o que fica para amanhã é o NPS.
- Aquecer o número gradualmente nas primeiras semanas em vez de estrear com a
  base inteira.

**Regras não negociáveis** (independentes de provedor):

- Disparo só com consentimento vigente em `clinica_consentimentos`
  (`finalidade='whatsapp'`, `revogado_em IS NULL`).
- Opt-out por palavra-chave, agora capturado pelo evento de mensagem recebida,
  grava revogação e passa a bloquear a fila.
- Nenhum conteúdo clínico em mensagem. Lembrete cita data, hora e profissional —
  nunca motivo, queixa ou qualquer dado de evolução.
- Falha permanente vira pendência operacional, não é descartada em silêncio.
- Mensagens recebidas eram para ser descartadas após o opt-out, e o robô mudou
  isso: sem guardar em que ponto a pessoa parou, ele recomeça a cada mensagem.
  A decisão tomada é persistir apenas dentro de uma conversa
  (`clinica_conversas_mensagens`), com prazo curto e obrigatório em `expira_em`.
  Fora de uma conversa de triagem, mensagem recebida continua sendo lida só para
  opt-out e descartada.

---

## 7. Robô de atendimento e indicação

Não estava na proposta externa e não estava neste plano até 29/07/2026. É o
único módulo que fala com quem ainda não é paciente.

**O que ele faz.** Atende quem chama o WhatsApp da clínica, entende que a pessoa
procura atendimento, coleta o mínimo — nome, o que a traz, preferência de turno
e dia, modalidade —, classifica a demanda num tema, cruza com os profissionais
cadastrados e entrega o contato dela ao psicólogo escolhido. Para a pessoa, a
conversa termina em "o profissional vai te chamar". Para o psicólogo, começa uma
mensagem com nome e telefone de alguém que já disse o que precisa.

**O que ele não faz.** Não marca horário, não dá orientação clínica, não opina
sobre a queixa, não diz se o caso é grave, não sugere conduta e não substitui
triagem profissional. Ele é recepção, não é clínica.

### 7.1 Regras não negociáveis

Estas não são preferências de produto. São o que separa um roteiro de
atendimento de um problema sério.

- **Sinal de risco transfere na primeira ocorrência.** Menção a suicídio,
  autolesão, violência ou emergência tira o robô da conversa imediatamente,
  aciona a equipe e devolve à pessoa um contato humano e o CVV (188). O robô não
  volta a responder naquela conversa, nem para "confirmar" nada.
- **Humano assumiu, robô cala.** `clinica_conversas.responsavel` vira `humano` e
  não volta sozinho para `robo`. Nada é pior num canal de saúde do que um robô
  falando por cima de quem está atendendo.
- **Aviso antes de passar o contato.** A pessoa é informada de que o nome e o
  telefone dela vão para o profissional. `contato_liberado_em` registra quando.
- **Nada de conteúdo clínico na mensagem ao profissional.** Nome, telefone, tema
  e preferência de horário. O relato fica na conversa.
- **Opt-out continua valendo.** Quem pediu para parar não recebe, nem do robô.
- **Fora do horário o robô responde, mas não promete.** Ele diz quando a equipe
  retorna em vez de fingir disponibilidade que não existe.

### 7.2 Como a indicação escolhe

Implementado em `lib/clinica/matching.ts`. Três critérios em ordem, e a ordem é
a decisão:

1. **Aderência** — tema da queixa contra especialidade vale mais que horário,
   porque horário se negocia na conversa com o profissional e especialidade não.
   Turno, dia, modalidade e público somam pontos.
2. **Fila do profissional** — entre candidatos de mesma aderência, recebe quem
   tem menos gente esperando. `fila_maxima` tira da roda quem já estourou o
   próprio teto.
3. **Rodízio** — o empate final vai para quem ficou mais tempo sem receber
   ninguém. Sem esse critério, o profissional mais bem cadastrado leva a fila
   inteira e os demais nunca entram.

Modalidade, gênero pedido e Libras são **exclusão, não pontuação**: não adianta
indicar atendimento online para quem só atende presencial, por melhor que seja a
nota. Quando ninguém atende aos critérios, o encaminhamento nasce sem
profissional e a pessoa fica na fila para decisão humana — o robô não inventa
compatibilidade.

O encaminhamento e o aviso ao profissional nascem na mesma transação.
Indicação sem aviso é fila parada; aviso sem indicação é contato de paciente
entregue sem rastro.

**Validação (29/07/2026).** A consulta foi exercitada contra seis profissionais
montados para forçar cada regra. Confirmado: teto de fila tira o profissional da
roda e o devolve quando o teto sobe; quem não tem telefone nunca aparece, porque
não há como avisar; gênero pedido e Libras excluem em vez de pontuar; e o
desempate por rodízio colocou à frente quem nunca havia recebido ninguém, com
pontuação e fila idênticas.

O teste também encontrou um erro que a leitura não pegou: **a janela de horário
tem modalidade própria**, e a consulta ignorava isso — um horário que só existe
para atendimento online pontuava como disponível para quem pediu presencial.
Corrigido, com a janela filtrada pela modalidade pedida.

**Nuance que sobra para o roteiro.** Quando o tema pedido não é especialidade de
ninguém, a consulta ainda devolve candidatos, com pontuação baixa e
`casaTema: false`. Isso é proposital — generalista atende —, mas significa que
quem chama precisa olhar esse campo. A regra do roteiro é: **sem `casaTema`, a
indicação vai para decisão humana em vez de sair direto para o psicólogo.** Sem
isso, o robô indicaria especialista em luto para quem procurou por dependência
química.

### 7.3 Classificação do tema — decisão em aberto

Transformar "não estou dormindo e brigo com todo mundo em casa" em
`tema='ansiedade'` pode ser feito por palavra-chave ou por modelo de linguagem.
A escolha não é de precisão, é de perímetro:

- **Palavra-chave** — nada sai da nossa infraestrutura, custo zero, e erra mais.
  Erro aqui é indicação com aderência menor, corrigível pela recepção.
- **Modelo** — classifica melhor, custa por mensagem e **manda relato de
  sofrimento para fora**, o que transforma triagem em transferência de dado de
  saúde a terceiro, com base legal e contrato próprios.

O projeto já usa Gemini e AssemblyAI no acadêmico, mas ali o dado é aula, não
paciente. Enquanto a decisão não for tomada, implementar por palavra-chave: é o
caminho reversível dos dois.

Independentemente da escolha, a **detecção de risco não é classificação** — ela
é lista de termos avaliada localmente, sempre, sem depender de serviço externo
estar de pé.

### 7.4 Dependência de cadastro

O matching cruza dados que hoje não existem em lugar nenhum. Antes do robô
atender a primeira pessoa, cada profissional precisa ter cadastrado: telefone de
WhatsApp, especialidades, públicos atendidos, modalidades, disponibilidade por
dia e turno, e teto de fila. Sem isso o robô responde bonito e não indica
ninguém.

Esse cadastro é trabalho de gente, não de código, e é o item de caminho crítico
mais fácil de subestimar no plano inteiro.

---

## 8. Régua de cobrança

Reaproveitamento quase integral do que existe. Hoje já há criação de cobrança
(`app/api/financeiro/cobranca`), webhook idempotente do Asaas e conciliação. O
que falta é o agendamento das mensagens e o vínculo com a sessão.

1. Sessão realizada gera ou vincula um `financeiro_recebimentos` via
   `clinica_agendamentos.recebimento_id`.
2. Job enfileira em `clinica_mensagens` nos marcos: 5 dias antes, no vencimento,
   3 e 7 dias após o atraso — a mesma régua já descrita como pipeline no
   `levantamento-funcionalidades-e-apresentacao.md`.
3. Webhook de pagamento cancela os disparos pendentes daquele recebimento. Esse
   é o ponto onde régua de cobrança costuma queimar reputação: cobrar quem já
   pagou. Cancelar na confirmação, não filtrar no envio.
4. Inadimplência clínica entra no DRE pelo mesmo caminho do acadêmico. Sem
   relatório paralelo.

---

## 9. NPS e pacientes inativos

`lib/satisfaction.ts` já prevê `tipo: "clinica"`. Falta o público e o disparo.

- Público de inativos por consulta: paciente com status `ativo` e sem
  agendamento `realizado` em N dias, N configurável.
- Campanha grava um lote em `clinica_mensagens` com `finalidade='nps'`,
  respeitando consentimento e limite diário de envio.
- Resposta entra pelo formulário já existente, com `referencia` apontando para o
  profissional e o período.
- Leitura de resultado por profissional e por modalidade, não só agregada — é
  isso que transforma NPS em decisão de escala.

---

## 10. LGPD e conselho profissional

- **Base legal.** Atendimento em saúde tem base própria na LGPD e não depende de
  consentimento; comunicação por WhatsApp e pesquisa de NPS dependem. Por isso
  `clinica_consentimentos` separa por finalidade em vez de guardar um aceite
  único.
- **Retenção.** Prontuário tem prazo mínimo de guarda definido em resolução do
  CFP (referência: Resolução CFP nº 001/2009, guarda mínima de cinco anos).
  Confirmar a redação vigente antes de implementar expurgo — nenhuma rotina de
  exclusão automática entra sem essa confirmação.
- **Atendimento online.** Modalidade `online` está sujeita à resolução de
  serviços psicológicos por meios de tecnologia (referência: Resolução CFP nº
  011/2018). Igualmente sujeita a confirmação da redação vigente.
- **Sigilo por profissional.** Evolução é visível ao autor e ao supervisor
  vinculado. Nem `admin` lê evolução pela interface comum; leitura excepcional é
  possível, mas sempre registrada em `clinica_acessos_prontuario`.
- **Conversa de triagem não é prontuário.** `clinica_conversas_mensagens` tem
  retenção curta e obrigatória por `expira_em`, diferente da guarda longa da
  evolução. O que sobrevive à conversa é o tema classificado, não o relato.
- **Compartilhamento com o profissional.** Entregar nome e telefone ao psicólogo
  que vai atender tem base legal de atendimento, mas exige transparência e
  registro: a pessoa é avisada antes e `contato_liberado_em` guarda a hora.
- **Robô e responsabilidade técnica.** A triagem automática organiza contato,
  não avalia caso. Nenhuma saída do robô é orientação psicológica, e a decisão
  clínica permanece inteira com o profissional.
- **Titular.** Exportação dos dados do paciente por rota autenticada, registrada
  como `exportacao` na trilha de acesso.
- **Backup.** O plano de retenção do DB System precisa ser revisto quando o
  prontuário entrar. Perder financeiro é recuperável por conciliação com o
  gateway; perder prontuário não é recuperável de lugar nenhum.

---

## 11. Roadmap

Cinco blocos, espelhando o cronograma de 90 dias da proposta externa. A ordem
resolve dependência, não é sequência de calendário.

Com a Evolution API no lugar da Cloud API, **nenhum bloco depende de aprovação
externa**. A ordem abaixo é puramente técnica e pode ser comprimida se houver
gente disponível.

**Bloco 1 — Fundação (dias 1–10)**
- Corrigir os três problemas de acesso da seção 3.
- Cadastrar os profissionais com telefone, especialidade, disponibilidade e teto
  de fila. É pré-requisito do robô e é trabalho de gente — começar cedo.
- Subir a VM, o proxy HTTPS e o subdomínio no domínio da Viver.
- Aplicar `004_clinica.sql` e validar com `/api/infra/oci/status`.
- Subir a Evolution API em rede interna, parear o número da clínica e deixar a
  sessão rodando ociosa até o Bloco 4. São duas semanas de observação gratuita
  sobre estabilidade de sessão antes de qualquer paciente depender dela.

**Bloco 2 — Prontuário (dias 11–30)**
- Rotas de servidor para evolução: criar, listar, retificar.
- Trilha de acesso gravando em toda leitura, desde o primeiro commit — retrofit
  de auditoria depois é onde se perde o histórico que justamente importa.
- Tela de atendimento: paciente, histórico, evolução do dia.
- Documentos clínicos reusando `lib/doc-token.ts` e a validação pública.

**Bloco 3 — Agenda operacional (dias 31–50)**
- Confirmação, remarcação e cancelamento com motivo.
- Bloqueio de conflito apoiado na unicidade de slot.
- Espelho de paciente e agendamento no MySQL, no padrão de
  `financeiro-migration.ts`, com `GET` de consistência antes da escrita dupla.
- Agenda por profissional e visão de ocupação.

**Bloco 4 — Comunicação, robô e cobrança (dias 51–75)**
- Cliente da Evolution API, eventos de status, opt-out e monitor de sessão.
  *(feito em 29/07/2026, antes do bloco — falta só o pareamento.)*
- Trabalhador de envio com throttle, teto diário e priorização de fila — antes
  do primeiro envio real, não depois do primeiro susto.
- Roteiro do robô: identificação, coleta, classificação de tema, transferência
  por risco e desligamento quando um humano assume.
- Indicação em produção, com painel de encaminhamentos para a recepção
  acompanhar quem foi indicado a quem e o que não teve resposta.
- Régua de lembrete e régua de cobrança sobre `jobs_execucoes`.
- Vínculo sessão → recebimento → DRE.
- Campanha de NPS de inativos, por último e em lotes pequenos.

**Bloco 5 — Estabilização (dias 76–90)**
- Teste de carga contra o envelope de 50 simultâneos.
- Painel de capacidade com os quatro gatilhos da seção 4.
- Virar a leitura de paciente e agenda para o MySQL após consistência
  confirmada.
- Treinamento da equipe e revisão dos indicadores.

---

## 12. Critérios de aceite

Cada item precisa ser demonstrável, não declarado. Os marcados com **[banco]**
já foram demonstrados em ambiente descartável (seções 5 e 7.2); em produção
valem de novo, contra o DB System da OCI.

1. `/clinica` inacessível a papel não autorizado por URL direta, incluindo
   `responsavel`.
2. Evolução criada não pode ser alterada nem apagada; retificação gera novo
   registro e a interface mostra os dois.
3. Toda leitura de prontuário tem linha correspondente em
   `clinica_acessos_prontuario`.
4. **[banco]** Dois agendamentos simultâneos para o mesmo profissional são
   rejeitados pelo banco, não apenas pela interface.
5. Lembrete não dispara para paciente sem consentimento vigente.
6. Queda de sessão do WhatsApp aparece em `/api/infra/oci/status` e gera alerta
   na primeira ocorrência, com a fila retendo as mensagens em vez de marcá-las
   como falhadas.
7. Teto diário de envio respeitado sob carga: o excedente fica para o dia
   seguinte na ordem de prioridade, sem perda de mensagem.
8. Pagamento confirmado cancela cobranças pendentes da régua antes do envio.
9. `GET` de consistência de paciente e agenda retorna `consistente: true` antes
   de qualquer troca de leitura, no mesmo critério usado no financeiro.
10. Nenhum dado clínico aparece em log, mensagem ou payload de webhook.
11. Teste de carga com 50 sessões simultâneas mantém p95 abaixo de 1,5 s.
12. Sinal de risco na conversa transfere para humano na primeira ocorrência, e o
    robô não volta a responder naquela conversa.
13. Assim que um humano assume, o robô para de responder — verificável por
    `clinica_conversas.responsavel`.
14. Contato da pessoa só chega ao profissional depois do aviso explícito, e a
    entrega tem hora registrada em `contato_liberado_em`.
15. **[banco]** Reprocessar a mesma triagem não gera segundo aviso ao mesmo
    profissional.
16. **[banco]** Nenhum profissional recebe indicação acima do próprio teto de
    fila, e a distribuição entre profissionais equivalentes não se concentra em
    um só.
17. Relato em texto livre não aparece em `clinica_encaminhamentos` nem na
    mensagem enviada ao profissional.
18. **[banco]** Uma pessoa nunca tem duas conversas vivas ao mesmo tempo, mesmo
    escrevendo de novo antes de a anterior encerrar.
19. Indicação sem aderência de tema não sai direto para o profissional: para em
    decisão humana.

---

## 13. Riscos e custos

**Riscos**

| Risco | Mitigação |
| --- | --- |
| **Bloqueio do número pelo WhatsApp** — maior risco do escopo, e permanente | Throttle com jitter, teto diário, aquecimento gradual, NPS diluído em lotes pequenos; manter número secundário identificado como plano de contingência |
| **Queda silenciosa de sessão** — fila enche e nada é entregue | Estado da sessão em `/api/infra/oci/status`, alerta na primeira falha, runbook de repareamento com responsável nomeado, backup do volume de sessão |
| Evolution API é dependência auto-hospedada sem suporte | Tag de imagem fixa, atualização testada fora de produção, API só em rede interna |
| 50 GiB insuficientes com o crescimento do prontuário | Anexos em Object Storage desde o início; monitorar o gatilho de 75% |
| VM agora roda aplicação + Evolution + datastore próprio | Dimensionar o shape para os dois processos; acompanhar os gatilhos de CPU e RAM da seção 4 |
| Sem redundância — VM Always Free única | Backup automático do DB System e runbook de recriação da VM |
| Vazamento de dado clínico | Acesso só por servidor, sigilo por profissional, trilha de auditoria, nada de clínico em mensagem |
| **Robô responder a quem está em sofrimento agudo** — o risco mais grave do escopo novo | Transferência para humano na primeira palavra de risco, sem retomada; nenhuma orientação clínica no roteiro; CVV na resposta de transferência |
| Indicação concentrar a fila em poucos profissionais | Teto por profissional, rodízio por último encaminhamento e leitura periódica da distribuição |
| Contato entregue ao profissional errado ou duas vezes | Encaminhamento e aviso na mesma transação, com chave de deduplicação e hora de liberação |
| Conversa de triagem virar base paralela de dado de saúde | Só o tema classificado é estruturado; relato expira por `expira_em`; nada disso é prontuário |
| Cadastro dos profissionais atrasar e o robô não ter com o que cruzar | Cadastro entra no Bloco 1, não no Bloco 4; robô sem candidato encaminha para decisão humana em vez de improvisar |
| Prazo interno concorre com o acadêmico | Blocos 1 a 3 entregam valor isolado; 4 e 5 podem escorregar sem travar o uso |

**Custos recorrentes**

| Item | Custo |
| --- | --- |
| OCI MySQL + Compute + Object Storage (Always Free) | R$ 0 |
| Subdomínio no domínio próprio da Viver | R$ 0 |
| Evolution API auto-hospedada | R$ 0 de licença e R$ 0 por mensagem — roda na VM já contabilizada |
| Número de WhatsApp da clínica | Já existe, sem custo novo |
| Asaas | Já em operação, sem mudança |
| Robô de atendimento | R$ 0 se a classificação de tema for por palavra-chave; custo por mensagem se for por modelo (seção 7.3) |

A licença externa evitada é de R$ 890/mês, R$ 10.680 no primeiro ciclo anual. A
Evolution API elimina também a tarifação por conversa que existiria com a Cloud
API — e que a proposta externa repassaria como custo de terceiro. O custo real
de fazer internamente é tempo de desenvolvimento, concentrado em prontuário,
WhatsApp e régua, mais um custo operacional novo e permanente: manter uma sessão
de WhatsApp viva. Esse último não aparece em fatura, aparece em plantão.

---

## 14. Próxima ação

Antes de escrever qualquer código de prontuário, executar em ordem:

1. Aplicar `infra/mysql/004_clinica.sql` na OCI com credencial administrativa.
   O arquivo já foi validado em MySQL 9.7.2 descartável (seção 5); o que falta é
   o acesso administrativo ao DB System.
2. Corrigir o fallback de `podeAcessarCaminho` e criar os papéis `psicologo` e
   `recepcao`.
3. Subir a VM e concluir as pendências já listadas em `docs/oci-migracao.md`.
4. Subir a Evolution API em rede interna e parear o número, deixando a sessão em
   observação enquanto os Blocos 2 e 3 são construídos.
5. Cadastrar os profissionais com o que o matching exige. Sem esse cadastro, o
   robô e a indicação existem no código e não existem na prática.
