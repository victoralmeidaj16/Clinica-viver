import {
  Brain, CalendarDays, CalendarOff, CalendarPlus, CheckCircle2, CreditCard, FileText,
  Bell, LogIn, Share2, Smartphone, UserPlus, Zap, type LucideIcon,
} from 'lucide-react';

/**
 * Conteúdo da página Ajuda — o mesmo do `docs/manual-pratico-psicologo.pdf`.
 *
 * Os prints em `public/ajuda/` foram tirados da plataforma com dados de
 * exemplo; os números laranja desenhados em cada imagem são os mesmos de
 * `passos[].n`. Ao trocar uma imagem, regenere pelos scripts em
 * `docs/manual-psicologo-fonte/` para a numeração continuar batendo.
 * Texto entre `**` aparece em negrito.
 */
export interface Passo { n: number | '•'; texto: string }
export interface Imagem { src: string; alt: string; largura: number; altura: number }
export interface Bloco { titulo?: string; imagens?: Imagem[]; passos: Passo[] }
export interface Etapa {
  id: string;
  numero: number;
  titulo: string;
  icone: LucideIcon;
  serve: string;
  comoAbrir?: string;
  blocos: Bloco[];
  porque: string;
  dica?: string;
  atencao?: string;
}

const img = (nome: string, alt: string, largura: number, altura: number): Imagem =>
  ({ src: `/ajuda/${nome}.webp`, alt, largura: largura / 2, altura: altura / 2 });
const lista = (...textos: string[]): Passo[] => textos.map((texto, i) => ({ n: i + 1, texto }));

export const ETAPAS: Etapa[] = [
  {
    id: 'entrar', numero: 1, titulo: 'Entrar na plataforma', icone: LogIn,
    serve: 'É o seu acesso pessoal. Você usa o e-mail e a senha criados quando seu credenciamento foi aprovado.',
    blocos: [{ imagens: [img('login', 'Tela de login com os campos marcados', 1240, 1460)], passos: lista(
      'Digite o **e-mail profissional** do seu cadastro.',
      'Digite a **senha**. O ícone de olho mostra o que você digitou.',
      'Esqueceu a senha? Clique em **Esqueceu a senha?** e peça uma nova.',
      'Clique em **Entrar na plataforma**.') }],
    porque: 'Cada psicólogo vê só os próprios pacientes. O login é o que garante o sigilo exigido pelo CFP e pela LGPD.',
    dica: 'Primeiro acesso? Use o link de convite que chegou no seu e-mail depois da aprovação para criar sua senha.',
  },
  {
    id: 'menu', numero: 2, titulo: 'Conhecer o menu', icone: Brain,
    serve: 'O menu à esquerda leva a todas as telas que você usa. Ele aparece em qualquer página, depois do login.',
    blocos: [{ imagens: [img('menu', 'Menu lateral com os itens numerados', 540, 1800)], passos: lista(
      '**Meu Painel**: atalhos do dia, link da agenda e próximas sessões.',
      '**Meu Cadastro**: seu perfil profissional e o status do credenciamento.',
      '**Meus Pacientes**: sua lista de pacientes e o cadastro de novos.',
      '**Prontuários dos Pacientes**: evolução clínica e histórico de cada paciente.',
      '**Meu Financeiro**: pagamentos recebidos e seu crédito de 70%.',
      '**Agenda & Horários**: grade semanal, bloqueios e sessões marcadas.',
      '**Sair da conta**: encerra seu acesso. Use sempre em computador compartilhado.') }],
    porque: 'Saber onde cada coisa fica evita perder tempo — e evita mexer na tela errada.',
    dica: 'No celular o menu fica escondido. Toque em **Abrir menu**, no canto superior esquerdo.',
    atencao: 'Se **Meu Cadastro** mostrar “Ainda não encontramos uma candidatura vinculada”, o e-mail desta conta é diferente do usado no formulário da vitrine. Use o mesmo e-mail nos dois.',
  },
  {
    id: 'painel', numero: 3, titulo: 'Meu Painel', icone: Zap,
    serve: 'É a tela inicial. Reúne os atalhos do seu dia: prontuário rápido, link da agenda e próximas sessões.',
    blocos: [
      { imagens: [img('painel-topo', 'Topo do Meu Painel', 2020, 700)], passos: lista(
        'Clique em **Cadastrar Paciente** para abrir o formulário (Etapa 05).',
        'Em **Prontuário Rápido**, escolha o paciente na lista.',
        'Clique em **Abrir / Lançar Prontuário** para ir direto à evolução dele.',
        'Clique em **Copiar Link** para copiar o link da sua agenda.',
        'Ou clique em **Enviar Wpp** para mandar o link pelo WhatsApp.') },
      { titulo: 'Suas próximas sessões', imagens: [img('painel-sessoes', 'Lista de próximas sessões no painel', 2020, 580)], passos: lista(
        'Clique em **Lembrar Wpp**: abre o WhatsApp com a mensagem de lembrete pronta.',
        'Clique em **Prontuário** para abrir o prontuário do paciente daquela sessão.',
        '**Ver grade completa** leva à Agenda & Horários.') },
    ],
    porque: 'Em poucos cliques você lembra o paciente, abre o prontuário ou manda sua agenda — sem procurar em vários menus.',
  },
  {
    id: 'paciente-novo', numero: 4, titulo: 'Receber paciente novo', icone: Smartphone,
    serve: 'Quando a clínica indica um paciente novo para você, você tem **24 horas** para confirmar o primeiro contato.',
    blocos: [{ passos: lista(
      'Você recebe o aviso por **WhatsApp** e **e-mail**, com os dados do caso e o telefone do paciente.',
      'Clique no **link da mensagem**. Ele abre a página de confirmação; não é preciso entrar no painel antes.',
      'Confirme o primeiro contato. Se não puder atender, use o link do e-mail para **encaminhar a um colega**.',
      'Pronto: o paciente passa a aparecer em **Meus Pacientes**. Agora é só marcar a primeira sessão.') }],
    porque: 'A clínica quer que o paciente seja acolhido logo. Se passar de 24 h sem resposta, o sistema repassa o paciente ao próximo colega da fila.',
    dica: 'Deixe as notificações do WhatsApp ligadas: o prazo de 24 h começa no momento do aviso.',
    atencao: 'Esta etapa acontece nas mensagens que você recebe, não dentro do painel. Por isso não há print de tela aqui.',
  },
  {
    id: 'cadastrar-paciente', numero: 5, titulo: 'Cadastrar paciente', icone: UserPlus,
    serve: 'Coloca o paciente na sua carteira. Só depois do cadastro você consegue agendar sessões, registrar prontuário e emitir documentos para ele.',
    comoAbrir: 'Abra **Meus Pacientes → Cadastrar Novo Paciente** (ou **Cadastrar Paciente** no Meu Painel).',
    blocos: [{ imagens: [
      img('cad-topo', 'Parte de cima do formulário de cadastro', 1324, 1488),
      img('cad-base', 'Parte de baixo do formulário de cadastro', 1324, 1730),
    ], passos: lista(
      'Escolha o **Serviço**.', 'Escolha a **Modalidade** (online ou presencial).', 'Digite o **Nome completo**.',
      'Digite o **Telefone** e repita em *Confirme o telefone*.', 'Digite o **E-mail** do paciente.', 'Selecione o **Gênero**.',
      'Digite o **CPF** (e também CEP e número da residência).', 'Marque o **Período de preferência**: manhã, tarde ou noite.',
      'Clique em **Salvar paciente**.') }],
    porque: 'Com o cadastro completo o paciente aparece na agenda e pode receber cobrança e documentos.',
    atencao: 'Campos com * são obrigatórios. O campo *Observações cadastrais* é só administrativo: nunca escreva evolução clínica ali — use o prontuário.',
  },
  {
    id: 'grade', numero: 6, titulo: 'Montar sua agenda', icone: CalendarDays,
    serve: 'A grade semanal define em quais dias e horários o paciente pode marcar com você. Sem ela, o link da agenda não mostra horários.',
    comoAbrir: 'Abra **Agenda & Horários** e role até **Disponibilidade semanal**.',
    blocos: [{ imagens: [img('agenda-grade', 'Grade semanal de atendimento', 2020, 1240)], passos: lista(
      'Ligue o **interruptor** do dia em que você atende.',
      'Escolha a **duração das sessões** (e a modalidade, ao lado).',
      'Ajuste os **períodos de atendimento**, por exemplo 08:00 até 12:00.',
      'Clique em **Adicionar período** se atende em mais de um horário no dia.',
      'Use **Copiar para…** para repetir esses horários em outros dias.') }],
    porque: 'O paciente só enxerga horários livres da sua grade. Grade atualizada = sem conflito e sem remarcação.',
    dica: 'Seus turnos do cadastro já montam uma grade inicial de segunda a sexta. Ajuste só o que for diferente.',
  },
  {
    id: 'bloqueios', numero: 7, titulo: 'Bloquear férias e folgas', icone: CalendarOff,
    serve: 'Esconde do link do paciente os dias em que você não atende, sem apagar a sua grade semanal.',
    comoAbrir: 'Abra **Agenda & Horários** e role até **Períodos bloqueados**.',
    blocos: [
      { titulo: 'Férias, congresso, folga longa', imagens: [img('agenda-bloqueios', 'Formulário de períodos bloqueados', 2020, 720)], passos: lista(
        'Em **Períodos bloqueados**, escolha a data **De**.', 'Escolha a data **Até**.', 'Clique em **Bloquear**.') },
      { titulo: 'Um dia ou horário pontual', imagens: [img('agenda-calendario', 'Calendário do profissional com a agenda do dia', 2020, 1520)], passos: [
        { n: '•', texto: 'No calendário, clique no **dia**. Ele fica roxo e aparece em **Agenda do dia**.' },
        { n: 1, texto: '**Selecionar todos os livres** marca os horários vagos do dia.' },
        { n: 2, texto: '**Bloquear dia inteiro** fecha o dia todo.' }] },
    ],
    porque: 'No período bloqueado você sai da fila de novos pacientes e a coordenação é avisada. Seus pacientes atuais continuam vendo seu perfil.',
    atencao: 'Dias com sessão marcada aparecem em verde. Reagende ou cancele a sessão (Etapa 10) antes de bloquear esse dia.',
  },
  {
    id: 'link-agenda', numero: 8, titulo: 'Link da agenda', icone: Share2,
    serve: 'É o seu endereço pessoal de agendamento. O paciente abre, informa o CPF e escolhe sozinho um horário livre.',
    blocos: [
      { imagens: [img('agenda-link', 'Cartão do link de agendamento', 2020, 670)], passos: lista(
        'Em **Agenda & Horários**, clique em **Copiar** para copiar o link.',
        'Ou clique em **WhatsApp** para enviar direto.',
        'Para agendar você mesmo, clique em **Agendar sessão** (Etapa 09).') },
      { titulo: 'Pelo cartão do paciente', imagens: [img('pacientes-card', 'Cartão do paciente em Meus Pacientes', 960, 550)], passos: [
        { n: 3, texto: 'Em **Meus Pacientes**, clique em **Enviar Agenda** no cartão do paciente.' }] },
      { titulo: 'E do lado do paciente?', passos: lista(
        'Abre o link.', 'Informa o CPF.', 'Escolhe um horário livre.', 'Paga por Pix ou cartão.') },
    ],
    porque: 'O paciente marca no horário dele, sem troca de mensagens. A sessão já entra na sua agenda com a cobrança gerada.',
    dica: 'Quem paga de uma vez 4 ou mais sessões do mês ganha 10% de desconto. Vale avisar o paciente.',
  },
  {
    id: 'agendar', numero: 9, titulo: 'Agendar sessão', icone: CalendarPlus,
    serve: 'Marca uma sessão combinada diretamente com o paciente. A cobrança (Pix e cartão) é criada junto.',
    comoAbrir: 'Abra **Agenda & Horários → Agendar sessão** (ou **Agendar** no cartão do paciente).',
    blocos: [{ imagens: [
      img('agendar-topo', 'Novo agendamento, parte de cima', 1080, 1724),
      img('agendar-base', 'Novo agendamento, parte de baixo', 1080, 1724),
    ], passos: lista(
      'Escolha o **Paciente**.', 'Escolha a **Data**.', 'Escolha o **Horário de início**.',
      'Escolha a **Frequência**: semanal, quinzenal ou personalizada.',
      'Confira o resumo: **quantas sessões** serão criadas e em quais dias.',
      'Escolha a **Modalidade**: online ou presencial.', 'Clique em **Agendar … sessões**.',
      'Opcional: ajuste o **Vencimento da cobrança**, o dia e a hora em que o link e o Pix se encerram.') }],
    porque: 'Com a sessão agendada o paciente recebe o link de pagamento e o horário fica reservado na sua agenda.',
    atencao: 'A frequência **Semanal** vem marcada e cria várias sessões de uma vez. Leia o resumo e o texto do botão antes de salvar.',
  },
  {
    id: 'depois-da-sessao', numero: 10, titulo: 'Depois da sessão', icone: CheckCircle2,
    serve: 'Confirmar que a sessão aconteceu atualiza a agenda e libera os próximos passos: prontuário, documentos e o crédito de 70%.',
    comoAbrir: 'Abra **Agenda & Horários** e role até **Sessões e confirmações**.',
    blocos: [{ imagens: [img('agenda-sessoes', 'Lista de sessões e confirmações', 2020, 1120)], passos: lista(
      'Sessão já realizada, com aviso **Aguardando confirmação**? Clique em **Confirmar que ocorreu**.',
      'Para ver ou gerenciar a cobrança, clique em **Pagamento da sessão**.',
      'Para mandar o link de pagamento ao paciente, clique em **Copiar link**.',
      'Mudou o horário? Clique em **Reagendar**. O vencimento da cobrança acompanha o novo horário.',
      'Sessão não vai acontecer? Clique em **Cancelar**. O sistema pede o motivo.') }],
    porque: 'Sem a confirmação, a sessão fica “em aberto” na agenda e o prontuário e o crédito de 70% não seguem o fluxo.',
    atencao: 'Confirme só depois de a sessão acontecer. Para corrigir data ou valor, use **Editar**, não cancele e crie outra.',
  },
  {
    id: 'prontuario', numero: 11, titulo: 'Prontuário', icone: FileText,
    serve: 'É onde você registra a evolução de cada atendimento. O registro fica no histórico do paciente, com acesso só seu.',
    comoAbrir: 'Abra **Prontuários dos Pacientes** no menu (ou **Prontuário** no cartão do paciente).',
    blocos: [
      { imagens: [img('pront-topo', 'Topo do prontuário do paciente', 2020, 600)], passos: lista(
        'Escolha o **paciente** na lista do topo.', 'Clique em **Registrar Prontuário Manual**.',
        '**Documentos** leva à emissão de documentos (Etapa 12).') },
      { titulo: 'Formulário de evolução', imagens: [img('pront-form', 'Formulário de registro de prontuário', 2020, 1000)], passos: lista(
        'Dê um **título** ao atendimento.', '**Subjetivo**: o que o paciente relatou.', '**Objetivo**: o que você observou.',
        '**Avaliação**: sua análise clínica.', '**Plano**: conduta e próximos passos.', 'Clique em **Salvar no Prontuário**.') },
    ],
    porque: 'O prontuário é obrigatório e protegido por sigilo (CFP e LGPD). Registrar logo após a sessão evita esquecimentos.',
  },
  {
    id: 'documentos', numero: 12, titulo: 'Documentos', icone: FileText,
    serve: 'Emite documentos do paciente, como a declaração de comparecimento, sempre ligados a um atendimento concluído.',
    comoAbrir: 'Abra **Meus Pacientes** e clique em **Documentos** no cartão do paciente (ou em **Documentos** dentro do prontuário).',
    blocos: [{ imagens: [img('docs', 'Tela de emissão de documentos', 2020, 1120)], passos: lista(
      'Escolha o **Modelo** do documento.', 'Preencha o **Local do atendimento e emissão**.', 'Escolha a **Finalidade**.',
      'Escolha o **Atendimento concluído** a que o documento se refere.',
      'Clique em **Revisar documento** e confira a prévia ao lado.') }],
    porque: 'Cada documento fica registrado no **Histórico de emissões**, o que dá segurança se alguém pedir uma segunda via.',
    atencao: 'Apareceu “Nenhum atendimento concluído disponível”? Falta confirmar a sessão. Volte à Etapa 10.',
  },
  {
    id: 'financeiro', numero: 13, titulo: 'Meu Financeiro', icone: CreditCard,
    serve: 'Mostra o que seus pacientes pagaram e quanto é seu: **70% de cada sessão** vira crédito para você.',
    blocos: [{ imagens: [img('financeiro', 'Tela Meu Financeiro (exemplo sem pagamentos)', 2020, 1200)], passos: lista(
      'Escolha o **Mês** que quer consultar.', 'Clique em **Atualizar**.', 'Veja o **crédito de 70%** do mês.',
      'Clique em **Exportar CSV** para baixar a planilha.',
      'Em **Status dos atendimentos**, acompanhe cada cobrança: valor, recebido, em aberto e link de pagamento.') }],
    porque: 'Aqui você confere se uma sessão foi paga e quanto já é seu. O crédito pode abater a mensalidade da pós-graduação.',
    atencao: 'O crédito só aparece depois que o pagamento é conciliado e a sessão foi confirmada (Etapa 10).',
  },
  {
    id: 'busca-avisos', numero: 14, titulo: 'Busca e notificações', icone: Bell,
    serve: 'A barra do topo ajuda a achar um paciente ou sessão e mostra os avisos da plataforma.',
    blocos: [{ imagens: [
      img('header', 'Barra do topo com busca, sino e perfil', 2048, 200),
      img('sino', 'Painel de notificações aberto', 1840, 600),
    ], passos: lista(
      'Clique em **Buscar paciente ou sessão** e digite o nome.',
      'Clique no **sino** para ver os avisos, como as cobranças de novas sessões.',
      'Seu **nome e perfil** ficam sempre visíveis aqui.') }],
    porque: 'Os avisos do sino mostram o que aconteceu sem você precisar abrir cada tela.',
    dica: 'Sem avisos novos, o sino mostra “Nenhuma notificação por aqui”.',
  },
];
