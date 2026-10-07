import fs from 'node:fs';
import {chromium} from 'playwright-core';

const I = JSON.parse(fs.readFileSync('icons.json','utf8'));
const ic = (n, cls='') => `<span class="ic ${cls}">${I[n]||''}</span>`;
const img = (f, cls='') => `<figure class="shot ${cls}"><img src="shots/${f}.png"></figure>`;
const steps = (list, start=1) => `<ol class="steps${list.length>=6?' two':''}">${list.map((t,i)=>`<li><b class="n">${typeof t==='object'?t.n:i+start}</b><span>${typeof t==='object'?t.t:t}</span></li>`).join('')}</ol>`;
const box = (kind, title, text) => `<div class="note ${kind}"><span class="ni">${ic(kind==='dica'?'Lightbulb':'AlertTriangle')}</span><div><b>${title}</b><p>${text}</p></div></div>`;
const why = (t) => `<div class="why"><span class="wi">${ic('Info')}</span><p><b>Por que fazer?</b> ${t}</p></div>`;
const serve = (t) => `<div class="serve"><b>① Para que serve?</b><p>${t}</p></div>`;

let pageNo = 0;
const page = (inner, {cls='', footer='', step=null}={}) => { pageNo++; return `<section class="page ${cls}"${step?` data-step="${step}"`:''}>${inner}<footer><span>Manual do Psicólogo · Viver Mais Psicologia</span><span>${footer}</span><b>@@N@@</b></footer></section>`; };
const head = (num, icon, title, tag='') => `<header class="eh"><div class="eico">${ic(icon)}</div><div><span class="etapa">ETAPA ${String(num).padStart(2,'0')}</span><h2>${title}</h2></div>${tag?`<span class="tag">${tag}</span>`:''}</header>`;
const sec = (t, n) => `<h3 class="sec"><b>${['','①','②','③','④'][n]}</b> ${t}</h3>`;

const TOC = [
  [1,'LogIn','Entrar na plataforma'],
  [2,'Brain','Conhecer o menu'],
  [3,'Zap','Meu Painel'],
  [4,'Smartphone','Receber paciente novo'],
  [5,'UserPlus','Cadastrar paciente'],
  [6,'CalendarDays','Montar sua agenda'],
  [7,'CalendarOff','Bloquear férias e folgas'],
  [8,'Share2','Link da agenda'],
  [9,'CalendarPlus','Agendar sessão'],
  [10,'CheckCircle2','Depois da sessão'],
  [11,'FileText','Prontuário'],
  [12,'FileText','Documentos'],
  [13,'CreditCard','Meu Financeiro'],
  [14,'Bell','Busca e notificações'],
  [15,'HelpCircle','Bússola rápida'],
  [16,'ShieldCheck','Regras de ouro'],
];
const tocPage = {};

const pages = [];

// ---------- CAPA
pages.push(`<section class="page cover"><div class="blob b1"></div><div class="blob b2"></div>
  <div class="logo"><img src="shots/logo.png"></div>
  <div class="cover-main"><span class="pill">GUIA RÁPIDO DE OPERAÇÃO</span>
  <h1>Manual do<br>Psicólogo</h1>
  <p>Como usar a plataforma Viver Mais Psicologia, passo a passo — olhando para a tela.</p></div>
  <div class="cover-icons">${['Zap','Users','CalendarDays','FileText','CreditCard'].map(n=>`<span>${ic(n)}</span>`).join('')}</div>
  <div class="cover-foot">Outubro/2026 · Prints da plataforma real com dados de exemplo</div></section>`);
pageNo++;

// ---------- COMO USAR
pages.push(page(`
  <header class="eh"><div class="eico">${ic('BookOpen')}</div><div><span class="etapa">ANTES DE COMEÇAR</span><h2>Como usar este manual</h2></div></header>
  <p class="lead">Cada etapa ocupa uma página (ou duas) e segue sempre a mesma ordem. Procure a etapa no sumário e vá direto a ela.</p>
  <div class="legend">
    <div class="lg"><b class="lgn">①</b><div><b>Para que serve</b><p>Em uma frase: por que essa função existe.</p></div></div>
    <div class="lg"><b class="lgn">②</b><div><b>Como fazer</b><p>Passos numerados. Cada número está <u>no print</u>, no lugar exato onde você clica.</p></div></div>
    <div class="lg"><b class="lgn">③</b><div><b>Print da plataforma</b><p>Tela real, com marcações em laranja.</p></div></div>
    <div class="lg"><b class="lgn">④</b><div><b>Dica ou Atenção</b><p>O que ajuda — e o que costuma dar errado.</p></div></div>
  </div>
  <h3 class="sec2">Como ler as marcações</h3>
  <div class="demo"><div class="demo-btn"><span class="demo-ring"></span><b class="demo-n">1</b>Botão de exemplo</div>
  <p>O <b>círculo laranja numerado</b> mostra onde clicar ou preencher. O número é o mesmo da lista de passos ao lado.</p></div>
  <div class="two">
    ${box('dica','Dica','Conferiu um passo e algo não bate com a sua tela? Veja se está no menu certo: o nome da etapa sempre diz onde ir.')}
    ${box('atencao','Atenção','Os nomes de pacientes nos prints são de exemplo (Paciente Exemplo 1, 2, 3). Na sua tela aparecem os seus pacientes.')}
  </div>
  <h3 class="sec2">A rotina em 5 passos</h3>
  <div class="flow">${[['UserPlus','Cadastrar o paciente'],['CalendarPlus','Agendar a sessão'],['CheckCircle2','Confirmar que ocorreu'],['FileText','Registrar o prontuário'],['CreditCard','Conferir o financeiro']].map(([n,t],i)=>`<div class="fl"><span class="fli">${ic(n)}</span><b>${t}</b></div>${i<4?`<span class="arr">${ic('ArrowRight')}</span>`:''}`).join('')}</div>
`, {footer:'Como usar'}));

// ---------- SUMÁRIO (preenche depois)
const SUM = '@@SUMARIO@@';
pages.push(SUM);

// ---------- 01 LOGIN
pages.push(page(`${head(1,'LogIn','Entrar na plataforma')}
  ${serve('É o seu acesso pessoal. Você usa o e-mail e a senha criados quando seu credenciamento foi aprovado.')}
  <div class="cols"><div class="col-txt">
   ${sec('Como fazer',2)}
   ${steps([
     'Digite o <b>e-mail profissional</b> do seu cadastro.',
     'Digite a <b>senha</b>. O ícone de olho mostra o que você digitou.',
     'Esqueceu a senha? Clique em <b>Esqueceu a senha?</b> e peça uma nova.',
     'Clique em <b>Entrar na plataforma</b>.'])}
   ${why('Cada psicólogo vê só os próprios pacientes. O login é o que garante o sigilo exigido pelo CFP e pela LGPD.')}
   ${box('dica','Dica','Primeiro acesso? Use o link de convite que chegou no seu e-mail depois da aprovação para criar sua senha.')}
  </div><div class="col-img">${sec('Print da plataforma',3)}${img('login')}</div></div>`, {footer:'Etapa 01 · Entrar'}));

// ---------- 02 MENU
pages.push(page(`${head(2,'Brain','Conhecer o menu')}
  ${serve('O menu à esquerda leva a todas as telas que você usa. Ele aparece em qualquer página, depois do login.')}
  <div class="cols menu"><div class="col-img narrow">${sec('Print da plataforma',3)}${img('menu')}</div><div class="col-txt">
   ${sec('O que cada item faz',2)}
   <ul class="menu-list">
    ${[['Zap','Meu Painel','Atalhos do dia, link da agenda e próximas sessões.'],['UserPlus','Meu Cadastro','Seu perfil profissional e o status do credenciamento.'],['Users','Meus Pacientes','Sua lista de pacientes e o cadastro de novos.'],['FileText','Prontuários dos Pacientes','Evolução clínica e histórico de cada paciente.'],['CreditCard','Meu Financeiro','Pagamentos recebidos e seu crédito de 70%.'],['CalendarDays','Agenda & Horários','Grade semanal, bloqueios e sessões marcadas.'],['LogOut','Sair da conta','Encerra seu acesso. Use sempre em computador compartilhado.']].map(([n,t,d],i)=>`<li><b class="n">${i+1}</b><span class="mi">${ic(n)}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('')}
   </ul>
   ${why('Saber onde cada coisa fica evita perder tempo — e evita mexer na tela errada.')}
   ${box('dica','Dica','No celular o menu fica escondido. Toque em <b>Abrir menu</b>, no canto superior esquerdo.')}
   ${box('atencao','Atenção','Se <b>Meu Cadastro</b> mostrar “Ainda não encontramos uma candidatura vinculada”, o e-mail desta conta é diferente do usado no formulário da vitrine. Use o mesmo e-mail nos dois.')}
  </div></div>`, {footer:'Etapa 02 · Menu'}));

// ---------- 03 PAINEL
pages.push(page(`${head(3,'Zap','Meu Painel')}
  ${serve('É a tela inicial. Reúne os atalhos do seu dia: prontuário rápido, link da agenda e próximas sessões.')}
  ${sec('Como fazer',2)}
  <div class="cols-wide"><div class="col-img wide">${img('painel-topo')}</div></div>
  ${steps([
    'Clique em <b>Cadastrar Paciente</b> para abrir o formulário (Etapa 05).',
    'Em <b>Prontuário Rápido</b>, escolha o paciente na lista.',
    'Clique em <b>Abrir / Lançar Prontuário</b> para ir direto à evolução dele.',
    'Clique em <b>Copiar Link</b> para copiar o link da sua agenda.',
    'Ou clique em <b>Enviar Wpp</b> para mandar o link pelo WhatsApp.'])}
  <div class="cols-wide"><div class="col-img wide">${img('painel-sessoes')}</div></div>
  ${steps([
    {n:1,t:'Em <b>Suas Próximas Sessões</b>, clique em <b>Lembrar Wpp</b>: abre o WhatsApp com a mensagem de lembrete pronta.'},
    {n:2,t:'Clique em <b>Prontuário</b> para abrir o prontuário do paciente daquela sessão.'},
    {n:3,t:'<b>Ver grade completa</b> leva à Agenda & Horários.'}])}
  ${why('Em poucos cliques você lembra o paciente, abre o prontuário ou manda sua agenda — sem procurar em vários menus.')}
`, {cls:'dense', footer:'Etapa 03 · Painel'}));

// ---------- 04 RECEBER PACIENTE
pages.push(page(`${head(4,'Smartphone','Receber paciente novo','Fora do painel')}
  ${serve('Quando a clínica indica um paciente novo para você, você tem <b>24 horas</b> para confirmar o primeiro contato.')}
  ${sec('Como fazer',2)}
  <div class="flowv">
   ${[['Smartphone','Você recebe o aviso','Chega por <b>WhatsApp</b> e <b>e-mail</b>, com os dados do caso e o telefone do paciente.'],
      ['Link','Clique no link da mensagem','O link abre a página de confirmação. Não é preciso entrar no painel antes.'],
      ['CheckCircle2','Confirme o primeiro contato','Clique para confirmar. Se não puder atender, use o link do e-mail para <b>encaminhar a um colega</b>.'],
      ['Users','Pronto: paciente na sua lista','Ele passa a aparecer em <b>Meus Pacientes</b>. Agora é só marcar a primeira sessão.']].map(([n,t,d],i)=>`<div class="fv"><b class="n big">${i+1}</b><span class="fvi">${ic(n)}</span><div><b>${t}</b><p>${d}</p></div></div>${i<3?`<span class="arr down">${ic('ArrowRight')}</span>`:''}`).join('')}
  </div>
  ${why('A clínica quer que o paciente seja acolhido logo. Se passar de 24 h sem resposta, o sistema repassa o paciente ao próximo colega da fila.')}
  <div class="two">
   ${box('atencao','Atenção','Esta etapa acontece nas mensagens que você recebe, não dentro do painel. Por isso não há print de tela aqui.')}
   ${box('dica','Dica','Deixe as notificações do WhatsApp ligadas: o prazo de 24 h começa no momento do aviso.')}
  </div>`, {footer:'Etapa 04 · Paciente novo'}));

// ---------- 05 CADASTRAR PACIENTE (2 páginas lado a lado numa)
pages.push(page(`${head(5,'UserPlus','Cadastrar paciente')}
  ${serve('Coloca o paciente na sua carteira. Só depois do cadastro você consegue agendar sessões, registrar prontuário e emitir documentos para ele.')}
  <div class="cols two-img"><div class="col-img">${sec('Print: parte de cima do formulário',3)}${img('cad-topo','cb1')}</div>
  <div class="col-img">${sec('Print: parte de baixo',3)}${img('cad-base','ct1')}</div></div>
  ${sec('Como fazer',2)}
  <p class="how">Abra em <b>Meus Pacientes → Cadastrar Novo Paciente</b> (ou <b>Cadastrar Paciente</b> no Meu Painel).</p>
  ${steps([
    'Escolha o <b>Serviço</b>.','Escolha a <b>Modalidade</b> (online ou presencial).','Digite o <b>Nome completo</b>.','Digite o <b>Telefone</b> e repita em <i>Confirme o telefone</i>.','Digite o <b>E-mail</b> do paciente.','Selecione o <b>Gênero</b>.','Digite o <b>CPF</b> (e também CEP e número da residência).','Marque o <b>Período de preferência</b>: manhã, tarde ou noite.','Clique em <b>Salvar paciente</b>.'])}
  <div class="two">
   ${why('Com o cadastro completo o paciente aparece na agenda e pode receber cobrança e documentos.')}
   ${box('atencao','Atenção','Campos com * são obrigatórios. O campo <i>Observações cadastrais</i> é só administrativo: nunca escreva evolução clínica ali — use o prontuário.')}
  </div>`, {cls:'dense', footer:'Etapa 05 · Cadastro'}));

// ---------- 06 AGENDA GRADE
pages.push(page(`${head(6,'CalendarDays','Montar sua agenda')}
  ${serve('A grade semanal define em quais dias e horários o paciente pode marcar com você. Sem ela, o link da agenda não mostra horários.')}
  ${sec('Print da plataforma',3)}
  <p class="how">Abra <b>Agenda & Horários</b> e role até <b>Disponibilidade semanal</b>.</p>
  <div class="cols-wide"><div class="col-img wide">${img('agenda-grade')}</div></div>
  ${sec('Como fazer',2)}
  ${steps([
    'Ligue o <b>interruptor</b> do dia em que você atende.',
    'Escolha a <b>duração das sessões</b> (e a modalidade, ao lado).',
    'Ajuste os <b>períodos de atendimento</b>, por exemplo 08:00 até 12:00.',
    'Clique em <b>Adicionar período</b> se atende em mais de um horário no dia.',
    'Use <b>Copiar para…</b> para repetir esses horários em outros dias.'])}
  ${why('O paciente só enxerga horários livres da sua grade. Grade atualizada = sem conflito e sem remarcação.')}
  ${box('dica','Dica','Seus turnos do cadastro já montam uma grade inicial de segunda a sexta. Ajuste só o que for diferente.')}
`, {footer:'Etapa 06 · Grade'}));

// ---------- 07 BLOQUEIOS (2 páginas)
pages.push(page(`${head(7,'CalendarOff','Bloquear férias e folgas')}
  ${serve('Esconde do link do paciente os dias em que você não atende, sem apagar a sua grade semanal.')}
  ${sec('Print da plataforma',3)}
  <p class="how">Abra <b>Agenda & Horários</b> e role até <b>Períodos bloqueados</b>.</p>
  <div class="cols-wide"><div class="col-img wide">${img('agenda-bloqueios')}</div></div>
  ${sec('Como fazer: férias, congresso, folga longa',2)}
  ${steps([{n:1,t:'Em <b>Períodos bloqueados</b>, escolha a data <b>De</b>.'},{n:2,t:'Escolha a data <b>Até</b>.'},{n:3,t:'Clique em <b>Bloquear</b>.'}])}
  ${why('No período bloqueado você sai da fila de novos pacientes e a coordenação é avisada. Seus pacientes atuais continuam vendo seu perfil.')}
  ${box('dica','Dica','Quer bloquear só um dia ou alguns horários? Veja a página seguinte.')}
`, {footer:'Etapa 07 · Bloqueios'}));
pages.push(page(`${head(7,'CalendarOff','Bloquear um dia ou horário','continuação')}
  ${serve('Para fechar só um dia (ou alguns horários), use o calendário no Meu Painel ou na Agenda & Horários.')}
  ${sec('Print da plataforma',3)}
  <div class="cols-wide"><div class="col-img wide">${img('agenda-calendario')}</div></div>
  ${sec('Como fazer',2)}
  ${steps([{n:'•',t:'No calendário, clique no <b>dia</b>. Ele fica roxo e aparece em <b>Agenda do dia</b>.'},{n:1,t:'<b>Selecionar todos os livres</b> marca os horários vagos do dia.'},{n:2,t:'<b>Bloquear dia inteiro</b> fecha o dia todo.'}])}
  <div class="colors"><span><i style="background:#9e6bcf"></i>Hoje</span><span><i class="o"></i>Disponível</span><span><i style="background:#10a37f"></i>Sessão</span><span><i style="background:#f59e0b"></i>Bloqueio</span></div>
  ${box('atencao','Atenção','Dias com sessão marcada aparecem em verde. Reagende ou cancele a sessão (Etapa 10) antes de bloquear esse dia.')}
`, {footer:'Etapa 07 · Bloqueios (cont.)'}));

// ---------- 08 LINK DA AGENDA
pages.push(page(`${head(8,'Share2','Link da agenda')}
  ${serve('É o seu endereço pessoal de agendamento. O paciente abre, informa o CPF e escolhe sozinho um horário livre.')}
  ${sec('Print da plataforma',3)}
  <div class="cols-wide"><div class="col-img wide">${img('agenda-link')}</div></div>
  ${sec('Como fazer',2)}
  ${steps([{n:1,t:'Em <b>Agenda & Horários</b>, clique em <b>Copiar</b> para copiar o link.'},{n:2,t:'Ou clique em <b>WhatsApp</b> para enviar direto.'},{n:3,t:'Para agendar você mesmo, clique em <b>Agendar sessão</b> (Etapa 09).'}])}
  <div class="cols"><div class="col-txt">
   ${sec('Pelo cartão do paciente',2)}
   ${steps([{n:3,t:'Em <b>Meus Pacientes</b>, clique em <b>Enviar Agenda</b> no cartão do paciente.'}])}
   ${why('O paciente marca no horário dele, sem troca de mensagens. A sessão já entra na sua agenda com a cobrança gerada.')}
  </div><div class="col-img">${img('pacientes-card')}</div></div>
  <h3 class="sec2">E do lado do paciente?</h3>
  <div class="flow small">${[['Link','Abre o link'],['UserPlus','Informa o CPF'],['CalendarDays','Escolhe o horário'],['CreditCard','Paga por Pix ou cartão']].map(([n,t],i)=>`<div class="fl"><span class="fli">${ic(n)}</span><b>${t}</b></div>${i<3?`<span class="arr">${ic('ArrowRight')}</span>`:''}`).join('')}</div>
  ${box('dica','Dica','Quem paga de uma vez 4 ou mais sessões do mês ganha 10% de desconto. Vale avisar o paciente.')}
`, {cls:'dense', footer:'Etapa 08 · Link'}));

// ---------- 09 AGENDAR SESSÃO
pages.push(page(`${head(9,'CalendarPlus','Agendar sessão')}
  ${serve('Marca uma sessão combinada diretamente com o paciente. A cobrança (Pix e cartão) é criada junto.')}
  <p class="how">Abra <b>Agenda & Horários → Agendar sessão</b> (ou <b>Agendar</b> no cartão do paciente).</p>
  <div class="cols two-img"><div class="col-img">${sec('Print: parte de cima',3)}${img('agendar-topo','ct2')}</div>
  <div class="col-img">${sec('Print: parte de baixo',3)}${img('agendar-base','ct2')}</div></div>
  ${sec('Como fazer',2)}
  ${steps(['Escolha o <b>Paciente</b>.','Escolha a <b>Data</b>.','Escolha o <b>Horário de início</b>.','Escolha a <b>Frequência</b>: semanal, quinzenal ou personalizada.','Confira o resumo: <b>quantas sessões</b> serão criadas e em quais dias.','Escolha a <b>Modalidade</b>: online ou presencial.','Clique em <b>Agendar … sessões</b>.',{n:8,t:'Opcional: ajuste o <b>Vencimento da cobrança</b>, o dia e a hora em que o link e o Pix se encerram.'}])}
  <div class="two">
   ${why('Com a sessão agendada o paciente recebe o link de pagamento e o horário fica reservado na sua agenda.')}
   ${box('atencao','Atenção','A frequência <b>Semanal</b> vem marcada e cria várias sessões de uma vez. Leia o resumo e o texto do botão antes de salvar.')}
  </div>`, {cls:'dense', footer:'Etapa 09 · Agendar'}));

// ---------- 10 DEPOIS DA SESSÃO
pages.push(page(`${head(10,'CheckCircle2','Depois da sessão')}
  ${serve('Confirmar que a sessão aconteceu atualiza a agenda e libera os próximos passos: prontuário, documentos e o crédito de 70%.')}
  ${sec('Print da plataforma',3)}
  <p class="how">Abra <b>Agenda & Horários</b> e role até <b>Sessões e confirmações</b>.</p>
  <div class="cols-wide"><div class="col-img wide">${img('agenda-sessoes')}</div></div>
  ${sec('Como fazer',2)}
  ${steps([
   'Sessão já realizada, com aviso <b>Aguardando confirmação</b>? Clique em <b>Confirmar que ocorreu</b>.',
   'Para ver ou gerenciar a cobrança, clique em <b>Pagamento da sessão</b>.',
   'Para mandar o link de pagamento ao paciente, clique em <b>Copiar link</b>.',
   'Mudou o horário? Clique em <b>Reagendar</b>. O vencimento da cobrança acompanha o novo horário.',
   'Sessão não vai acontecer? Clique em <b>Cancelar</b>. O sistema pede o motivo.'])}
  ${why('Sem a confirmação, a sessão fica “em aberto” na agenda e o prontuário e o crédito de 70% não seguem o fluxo.')}
  ${box('atencao','Atenção','Confirme só depois de a sessão acontecer. Para corrigir data ou valor, use <b>Editar</b>, não cancele e crie outra.')}
`, {footer:'Etapa 10 · Confirmar'}));

// ---------- 11 PRONTUÁRIO
pages.push(page(`${head(11,'FileText','Prontuário')}
  ${serve('É onde você registra a evolução de cada atendimento. O registro fica no histórico do paciente, com acesso só seu.')}
  <p class="how">Abra <b>Prontuários dos Pacientes</b> no menu (ou <b>Prontuário</b> no cartão do paciente).</p>
  <div class="cols-wide"><div class="col-img wide">${img('pront-topo')}</div></div>
  ${steps([{n:1,t:'Escolha o <b>paciente</b> na lista do topo.'},{n:2,t:'Clique em <b>Registrar Prontuário Manual</b>.'},{n:3,t:'<b>Documentos</b> leva à emissão de documentos (Etapa 12).'}])}
  <div class="cols-wide"><div class="col-img wide">${img('pront-form')}</div></div>
  ${steps([{n:1,t:'Dê um <b>título</b> ao atendimento.'},{n:2,t:'<b>Subjetivo</b>: o que o paciente relatou.'},{n:3,t:'<b>Objetivo</b>: o que você observou.'},{n:4,t:'<b>Avaliação</b>: sua análise clínica.'},{n:5,t:'<b>Plano</b>: conduta e próximos passos.'},{n:6,t:'Clique em <b>Salvar no Prontuário</b>.'}])}
  ${why('O prontuário é obrigatório e protegido por sigilo (CFP e LGPD). Registrar logo após a sessão evita esquecimentos.')}
`, {cls:'dense', footer:'Etapa 11 · Prontuário'}));

// ---------- 12 DOCUMENTOS
pages.push(page(`${head(12,'FileText','Documentos')}
  ${serve('Emite documentos do paciente, como a declaração de comparecimento, sempre ligados a um atendimento concluído.')}
  <p class="how">Abra <b>Meus Pacientes</b> e clique em <b>Documentos</b> no cartão do paciente (ou em <b>Documentos</b> dentro do prontuário).</p>
  ${sec('Print da plataforma',3)}
  <div class="cols-wide"><div class="col-img wide">${img('docs')}</div></div>
  ${sec('Como fazer',2)}
  ${steps(['Escolha o <b>Modelo</b> do documento.','Preencha o <b>Local do atendimento e emissão</b>.','Escolha a <b>Finalidade</b>.','Escolha o <b>Atendimento concluído</b> a que o documento se refere.','Clique em <b>Revisar documento</b> e confira a prévia ao lado.'])}
  <div class="two">
   ${why('Cada documento fica registrado no <b>Histórico de emissões</b>, o que dá segurança se alguém pedir uma segunda via.')}
   ${box('atencao','Atenção','Apareceu “Nenhum atendimento concluído disponível”? Falta confirmar a sessão. Volte à Etapa 10.')}
  </div>`, {footer:'Etapa 12 · Documentos'}));

// ---------- 13 FINANCEIRO
pages.push(page(`${head(13,'CreditCard','Meu Financeiro')}
  ${serve('Mostra o que seus pacientes pagaram e quanto é seu: <b>70% de cada sessão</b> vira crédito para você.')}
  ${sec('Print da plataforma',3)}
  <div class="cols-wide"><div class="col-img wide">${img('financeiro')}</div></div>
  <p class="foot-note">As tabelas aparecem vazias porque este print foi feito em um ambiente de exemplo, sem pagamentos.</p>
  ${sec('Como fazer',2)}
  ${steps(['Escolha o <b>Mês</b> que quer consultar.','Clique em <b>Atualizar</b>.','Veja o <b>crédito de 70%</b> do mês.','Clique em <b>Exportar CSV</b> para baixar a planilha.','Em <b>Status dos atendimentos</b>, acompanhe cada cobrança: valor, recebido, em aberto e link de pagamento.'])}
  ${why('Aqui você confere se uma sessão foi paga e quanto já é seu. O crédito pode abater a mensalidade da pós-graduação.')}
  ${box('atencao','Atenção','O crédito só aparece depois que o pagamento é conciliado e a sessão foi confirmada (Etapa 10).')}
`, {cls:'dense', footer:'Etapa 13 · Financeiro'}));

// ---------- 14 BUSCA E NOTIFICAÇÕES
pages.push(page(`${head(14,'Bell','Busca e notificações')}
  ${serve('A barra do topo ajuda a achar um paciente ou sessão e mostra os avisos da plataforma.')}
  ${sec('Print da plataforma',3)}
  <div class="cols-wide"><div class="col-img wide">${img('header')}</div></div>
  <div class="cols-wide"><div class="col-img wide sino">${img('sino')}</div></div>
  ${sec('Como fazer',2)}
  ${steps(['Clique em <b>Buscar paciente ou sessão</b> e digite o nome.',{n:2,t:'Clique no <b>sino</b> para ver os avisos, como as cobranças de novas sessões.'},{n:3,t:'Seu <b>nome e perfil</b> ficam sempre visíveis aqui.'}])}
  <div class="two">
   ${why('Os avisos do sino mostram o que aconteceu sem você precisar abrir cada tela.')}
   ${box('dica','Dica','Sem avisos novos, o sino mostra “Nenhuma notificação por aqui”.')}
  </div>`, {footer:'Etapa 14 · Busca e avisos'}));

// ---------- 15 BÚSSOLA
const bus = [
 ['Smartphone','Chegou paciente novo','Link no WhatsApp ou e-mail → <b>Confirmar primeiro contato</b>','4'],
 ['Share2','Passar horários para o paciente escolher','Meu Painel ou Agenda → <b>Copiar</b> / <b>Enviar Wpp</b>','8'],
 ['CalendarPlus','Marcar uma sessão','Agenda & Horários → <b>Agendar sessão</b>','9'],
 ['MessageCircle','Lembrar o paciente da sessão','Meu Painel → <b>Lembrar Wpp</b>','3'],
 ['CheckCircle2','A sessão acabou de terminar','Agenda & Horários → <b>Confirmar que ocorreu</b>','10'],
 ['FileText','Registrar a evolução','Prontuários dos Pacientes → <b>Registrar Prontuário Manual</b>','11'],
 ['FileText','Emitir uma declaração','Meus Pacientes → <b>Documentos</b>','12'],
 ['CreditCard','Ver o que recebi','Meu Financeiro → escolher o mês','13'],
 ['CalendarOff','Vou tirar férias','Agenda & Horários → <b>Períodos bloqueados</b>','7'],
 ['UserX','Paciente desistiu','Meus Pacientes → <b>Registrar desistência</b> no cartão (devolve a vaga ao rodízio)','—'],
];
pages.push(page(`${head(15,'HelpCircle','Bússola rápida','Consulta')}
  <p class="lead">Precisa fazer algo agora? Encontre a situação e veja onde clicar.</p>
  <div class="bus">${bus.map(([n,a,b,e])=>`<div class="bus-row"><span class="bi">${ic(n)}</span><div class="bt"><b>${a}</b><p>${b}</p></div>${e==='—'?'':`<span class="be">Etapa ${e}</span>`}</div>`).join('')}</div>`, {footer:'Etapa 15 · Bússola'}));

// ---------- 16 REGRAS DE OURO
pages.push(page(`${head(16,'ShieldCheck','Regras de ouro','Leia uma vez')}
  <div class="rules">
   ${[['Lock','Sigilo absoluto','Cada psicólogo vê só os próprios pacientes. Os registros são protegidos conforme CFP e LGPD.'],
      ['Clock','24 horas para o primeiro contato','Paciente novo do rodízio: confirme em até 24 h. Passou do prazo, ele vai para o próximo colega.'],
      ['CreditCard','Crédito de 70%','Cada sessão paga e confirmada gera 70% de crédito para você, visível em Meu Financeiro.'],
      ['RefreshCw','Reagendar e cancelar','Ao reagendar, o vencimento da cobrança acompanha o novo horário. Cancelar exige um motivo.'],
      ['CheckCircle2','Confirme a sessão','Confirmar que ocorreu mantém agenda, prontuário e financeiro em ordem.'],
      ['Save','Prontuário no mesmo dia','Registrar logo após a sessão evita esquecimentos e protege você.']].map(([n,t,d])=>`<div class="rule"><span class="ri">${ic(n)}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}
  </div>
  <div class="closing"><b>Pronto!</b> Em caso de dúvida, volte ao Sumário e procure a etapa.</div>`, {footer:'Etapa 16 · Regras'}));

// Montar sumário com números de página reais
const stepPages = {};
let pn = 0; // capa=1? contamos: capa (sem contagem de footer) -> usamos ordem
// páginas: [capa, como usar, sumário, 01..16]
const order = pages.length;
const tocHtml = page(`<header class="eh"><div class="eico">${ic('BookOpen')}</div><div><span class="etapa">ENCONTRE RÁPIDO</span><h2>Sumário</h2></div></header>
  <div class="toc">${TOC.map(([n,i,t],k)=>`<div class="tc"><span class="tci">${ic(i)}</span><div><small>ETAPA ${String(n).padStart(2,'0')}</small><b>${t}</b></div><em>${'@@P'+n+'@@'}</em></div>`).join('')}</div>`, {footer:'Sumário'});
// page numbers: capa = 1 (sem número), como usar = 2, sumário = 3, etapa n = 3 + n (cada etapa 1 pág.)
let html = pages.map(p=>p===SUM?tocHtml:p).join('\n');
const secs=[...html.matchAll(/<section class="page[^"]*">([\s\S]*?)<\/section>/g)].map(m=>m[1]);
const startPage={}; secs.forEach((t,i)=>{const m=t.match(/<span class="etapa">ETAPA (\d+)<\/span>/); if(m&&!(Number(m[1]) in startPage)) startPage[Number(m[1])]=i+1;});
let seq=1; const final = html.replace(/@@P(\d+)@@/g,(m,n)=>String(startPage[Number(n)])).replace(/@@N@@/g,()=>String(++seq));

const css = fs.readFileSync('manual.css','utf8');
fs.writeFileSync('manual.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manual do Psicólogo — Viver Mais Psicologia</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>${css}</style></head><body>${final}</body></html>`);
console.log('html ok, páginas:', pageNo);
