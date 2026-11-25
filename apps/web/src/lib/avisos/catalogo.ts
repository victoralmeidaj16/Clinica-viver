/**
 * Catálogo dos avisos editáveis pela Gestão (especificação final, 12.01–12.02).
 *
 * Cada aviso diz qual evento o dispara, para quem vai, quais campos o texto
 * pode usar e o texto padrão. O texto padrão é a fonte única: as funções que
 * montam as mensagens no servidor renderizam este mesmo modelo, então o que a
 * Gestão vê como "padrão" no editor é exatamente o que sai quando não há
 * versão própria gravada.
 *
 * Essenciais não podem ser desligados (12.01); complementares começam
 * desligados e a Gestão os ativa (12.02).
 */

export type FinalidadeEditavel =
  | 'recebimento_paciente'
  | 'alocacao_psicologo'
  | 'confirmacao_triagem_paciente'
  | 'boas_vindas_psicologo'
  | 'agenda_confirmacao_paciente'
  | 'agenda_confirmacao_psicologo'
  | 'agenda_cancelamento_paciente'
  | 'agenda_remarcacao_paciente'
  | 'agenda_remarcacao_psicologo'
  | 'agenda_solicitacao_reagendamento_psicologo'
  | 'agenda_recusa_reagendamento_paciente'
  | 'aceite_sem_agendamento_gestao'
  | 'aviso_saida_turma'
  | 'lembrete_sessao_paciente';

/** `sino` registra o aviso no painel da Gestão, sem mensagem externa. */
export type CanalAviso = 'whatsapp' | 'email' | 'whatsapp_email' | 'sino';
export type DestinatarioAviso = 'paciente' | 'psicologo' | 'gestao';

export interface CampoDoAviso {
  nome: string;
  descricao: string;
  exemplo: string;
}

export interface AvisoDoCatalogo {
  finalidade: FinalidadeEditavel;
  titulo: string;
  evento: string;
  destinatario: DestinatarioAviso;
  essencial: boolean;
  campos: readonly CampoDoAviso[];
  /** Sem estes campos o aviso perde a ação que ele existe para pedir. */
  camposObrigatorios: readonly string[];
  canais: readonly CanalAviso[];
  canalPadrao: CanalAviso;
  /**
   * `false` quando o texto leva um segredo (link de ativação): o reenvio
   * passa pelo fluxo próprio, que gera um link novo.
   */
  reenviavel: boolean;
  /** Onde a ativação é controlada, quando não é neste editor. */
  ativacaoEm?: { rotulo: string; href: string };
  modeloPadrao: string;
}

export const ROTULO_CANAL: Record<CanalAviso, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  whatsapp_email: 'WhatsApp e e-mail',
  sino: 'Somente no painel da Gestão',
};

export const ROTULO_DESTINATARIO: Record<DestinatarioAviso, string> = {
  paciente: 'Paciente',
  psicologo: 'Psicólogo',
  gestao: 'Coordenação / Gestão',
};

const NOME_PACIENTE: CampoDoAviso = { nome: 'nome_paciente', descricao: 'Nome social, ou o nome civil quando não houver', exemplo: 'Ana' };
const NOME_PROFISSIONAL: CampoDoAviso = { nome: 'nome_profissional', descricao: 'Nome do psicólogo', exemplo: 'Carla Souza' };
const DIA_HORARIO: CampoDoAviso = { nome: 'dia_horario', descricao: 'Dia e horário da sessão, por extenso', exemplo: 'quinta-feira, 21 de agosto, às 14:00' };
const MODALIDADE: CampoDoAviso = { nome: 'modalidade', descricao: 'Modalidade da sessão', exemplo: 'Atendimento online' };

const URGENCIA = '⚠️ Em caso de urgência: se você estiver em sofrimento emocional intenso ou em uma situação de crise, ligue para o CVV, pelo número 188 (24 horas), ou procure um serviço de emergência da sua região.';

export const CATALOGO_AVISOS: readonly AvisoDoCatalogo[] = [
  {
    finalidade: 'recebimento_paciente',
    titulo: 'Solicitação recebida',
    evento: 'O paciente envia a solicitação de atendimento.',
    destinatario: 'paciente',
    essencial: true,
    campos: [NOME_PACIENTE],
    camposObrigatorios: [],
    canais: ['whatsapp', 'email', 'whatsapp_email'],
    canalPadrao: 'whatsapp_email',
    reenviavel: true,
    modeloPadrao: [
      'Olá! Seja bem-vindo(a) à Viver Mais Psicologia! 🫂',
      '',
      'Recebemos sua solicitação de agendamento e agradecemos por entrar em contato com a gente!',
      '',
      'Em breve, você receberá as próximas orientações por aqui, neste mesmo contato.',
      '',
      'Estamos à disposição para te acolher! ✨',
      '',
      URGENCIA,
    ].join('\n'),
  },
  {
    finalidade: 'alocacao_psicologo',
    titulo: 'Solicitação oferecida ao psicólogo',
    evento: 'O rodízio, a Gestão ou a escolha na vitrine oferece o paciente a um psicólogo.',
    destinatario: 'psicologo',
    essencial: true,
    campos: [
      NOME_PROFISSIONAL,
      { nome: 'aviso_escolha_direta', descricao: 'Linha que aparece só quando o paciente escolheu o profissional na vitrine', exemplo: 'O paciente escolheu você na vitrine.' },
      { nome: 'dados_paciente', descricao: 'Bloco com nome, WhatsApp, gênero, serviço, modalidade, turno e responsável', exemplo: '- *Nome civil:* Ana Lima\n- *Serviço:* Psicoterapia Individual' },
      { nome: 'instrucao_recusa', descricao: 'O que acontece se o profissional recusar (rodízio ou coordenação)', exemplo: '➡️ Se não desejar atender, poderá recusar pelo mesmo link.' },
      { nome: 'link_decisao', descricao: 'Link para aceitar ou recusar', exemplo: 'https://clinicavivermais.cloud/confirmar-contato/…' },
      { nome: 'prazo_resposta', descricao: 'Prazo da oferta', exemplo: '24 horas' },
      { nome: 'consequencia_sem_resposta', descricao: 'O que acontece se o prazo vencer', exemplo: 'o paciente será encaminhado automaticamente ao próximo profissional da fila' },
    ],
    camposObrigatorios: ['link_decisao'],
    canais: ['whatsapp', 'email', 'whatsapp_email'],
    canalPadrao: 'whatsapp_email',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_profissional}}! 💜 Você recebeu um novo paciente pela Viver Mais.',
      '{{aviso_escolha_direta}}',
      '',
      '*Dados do paciente*',
      '',
      '{{dados_paciente}}',
      '',
      '*📌 O que você precisa fazer?*',
      '',
      'Acesse o link abaixo para informar se deseja atender esse paciente.',
      '✅ Ao aceitar, o paciente recebe da clínica as orientações sobre os próximos passos, e você assume o contato para combinar o primeiro horário.',
      '{{instrucao_recusa}}',
      '',
      '{{link_decisao}}',
      '',
      '🚨 *Atenção:* é importante acessar o link e registrar sua decisão. Caso não haja uma resposta em até {{prazo_resposta}}, {{consequencia_sem_resposta}}.',
      '',
      'Entre em contato o quanto antes! Quanto mais rápido o paciente receber seu contato, maiores são as chances de conseguir agendar o atendimento. 💜',
    ].join('\n'),
  },
  {
    finalidade: 'confirmacao_triagem_paciente',
    titulo: 'Aceite comunicado ao paciente',
    evento: 'O psicólogo aceita o paciente. Não anuncia sessão marcada: o horário ainda será combinado.',
    destinatario: 'paciente',
    essencial: true,
    campos: [
      NOME_PACIENTE,
      { nome: 'saudacao', descricao: 'Saudação ao paciente, ou ao responsável quando o paciente é menor', exemplo: 'Olá, Ana! 💜' },
      { nome: 'servico', descricao: 'Serviço solicitado', exemplo: 'Psicoterapia Individual' },
      { nome: 'orientacoes_pagamento', descricao: 'Bloco de pagamento: valor por sessão ou cobertura do convênio', exemplo: '💳 Pagamento da consulta\n\nO valor para Psicoterapia Individual é de R$ 120,00 por sessão.' },
    ],
    camposObrigatorios: [],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      '{{saudacao}}',
      'Aqui é a equipe da Clínica Viver Mais Psicologia!',
      '',
      'Que bom ter você com a gente! 🫂 Ficamos felizes por você ter escolhido a Viver Mais para dar esse passo tão importante no seu processo de {{servico}}. Seu agendamento já foi encaminhado ao(à) psicólogo(a), e queremos te passar algumas informações importantes para os próximos passos.',
      '',
      '📲 Contato com o(a) psicólogo(a)',
      '',
      'O(a) psicólogo(a) tem até 24 horas para entrar em contato com você após o recebimento desta mensagem.',
      '',
      'Caso esse prazo coincida com finais de semana ou feriados, ele será estendido até o próximo dia útil.',
      '',
      'Se você não receber o contato dentro desse prazo, avise a gente por aqui para que possamos ajudar!',
      '',
      '{{orientacoes_pagamento}}',
      '',
      '📅 Horários e organização dos atendimentos',
      '',
      'A combinação dos dias, horários das sessões e demais detalhes do atendimento será feita diretamente com o(a) psicólogo(a).',
      '',
      'As sessões individuais têm duração de 50 minutos, enquanto as sessões de casal/família têm duração de 1h30.',
      '',
      'Se tiver qualquer dúvida ou precisar de ajuda durante esse processo, estamos à disposição por aqui! 💜',
      '',
      'Seja muito bem-vindo(a) à Viver Mais Psicologia! Esperamos que esse seja um espaço de cuidado e acolhimento para você. ✨',
      '',
      'Com carinho,',
      'Equipe Viver Mais Psicologia',
      '',
      URGENCIA,
    ].join('\n'),
  },
  {
    finalidade: 'boas_vindas_psicologo',
    titulo: 'Cadastro aprovado e acesso liberado',
    evento: 'A Gestão aprova o cadastro do psicólogo.',
    destinatario: 'psicologo',
    essencial: true,
    campos: [
      NOME_PROFISSIONAL,
      { nome: 'login', descricao: 'E-mail de acesso', exemplo: 'carla@exemplo.com' },
      { nome: 'link_ativacao', descricao: 'Link individual para criar a senha (expira em 72 horas)', exemplo: 'https://clinicavivermais.cloud/ativar/…' },
    ],
    camposObrigatorios: ['link_ativacao'],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: false,
    modeloPadrao: [
      'Olá, {{nome_profissional}}! Seu cadastro profissional foi aprovado pela Viver Mais Psicologia.',
      '',
      'Seu acesso à plataforma já está disponível.',
      'Login: {{login}}',
      '',
      'Crie sua senha pessoal pelo link seguro abaixo:',
      '{{link_ativacao}}',
      '',
      'O link é individual, expira em 72 horas e pode ser usado uma única vez.',
      'A Viver Mais nunca solicitará sua senha pelo WhatsApp.',
    ].join('\n'),
  },
  {
    finalidade: 'agenda_confirmacao_paciente',
    titulo: 'Sessão marcada (paciente)',
    evento: 'Uma sessão é marcada para o paciente.',
    destinatario: 'paciente',
    essencial: true,
    campos: [NOME_PACIENTE, NOME_PROFISSIONAL, DIA_HORARIO, MODALIDADE],
    camposObrigatorios: [],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_paciente}}! Sua sessão foi marcada na Viver Mais Psicologia.',
      '',
      'Profissional: {{nome_profissional}}',
      'Quando: {{dia_horario}}',
      '{{modalidade}}',
      '',
      'Se precisar remarcar ou desmarcar, responda esta mensagem com antecedência.',
    ].join('\n'),
  },
  {
    finalidade: 'agenda_confirmacao_psicologo',
    titulo: 'Sessão marcada pelo link (psicólogo)',
    evento: 'O paciente marca uma sessão pelo link de agendamento.',
    destinatario: 'psicologo',
    essencial: true,
    campos: [NOME_PACIENTE, NOME_PROFISSIONAL, DIA_HORARIO, MODALIDADE],
    camposObrigatorios: [],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_profissional}}! Uma sessão foi marcada na sua agenda pelo link de marcação.',
      '',
      'Paciente: {{nome_paciente}}',
      'Quando: {{dia_horario}}',
      '{{modalidade}}',
      '',
      'A sessão já aparece na aba Agenda da plataforma.',
    ].join('\n'),
  },
  {
    finalidade: 'agenda_cancelamento_paciente',
    titulo: 'Sessão cancelada (paciente)',
    evento: 'Uma sessão do paciente é cancelada.',
    destinatario: 'paciente',
    essencial: true,
    campos: [NOME_PACIENTE, NOME_PROFISSIONAL, DIA_HORARIO],
    camposObrigatorios: [],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_paciente}}. Sua sessão de {{dia_horario}} com {{nome_profissional}} foi cancelada.',
      '',
      'Entre em contato com seu(sua) psicólogo(a) para realizar um novo agendamento.',
    ].join('\n'),
  },
  {
    finalidade: 'agenda_remarcacao_paciente',
    titulo: 'Sessão remarcada (paciente)',
    evento: 'O dia, o horário ou a modalidade de uma sessão muda.',
    destinatario: 'paciente',
    essencial: true,
    campos: [
      NOME_PACIENTE, NOME_PROFISSIONAL,
      { nome: 'horario_anterior', descricao: 'Horário antes da mudança', exemplo: 'quinta-feira, 21 de agosto, às 14:00' },
      { nome: 'novo_horario', descricao: 'Horário depois da mudança', exemplo: 'sexta-feira, 22 de agosto, às 10:00' },
      MODALIDADE,
    ],
    camposObrigatorios: [],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_paciente}}! Sua sessão com {{nome_profissional}} foi remarcada.',
      '',
      'Horário anterior: {{horario_anterior}}',
      'Novo horário: {{novo_horario}}',
      '{{modalidade}}',
    ].join('\n'),
  },
  {
    finalidade: 'agenda_remarcacao_psicologo',
    titulo: 'Sessão remarcada (psicólogo)',
    evento: 'O dia, o horário ou a modalidade de uma sessão muda.',
    destinatario: 'psicologo',
    essencial: true,
    campos: [
      NOME_PACIENTE, NOME_PROFISSIONAL,
      { nome: 'horario_anterior', descricao: 'Horário antes da mudança', exemplo: 'quinta-feira, 21 de agosto, às 14:00' },
      { nome: 'novo_horario', descricao: 'Horário depois da mudança', exemplo: 'sexta-feira, 22 de agosto, às 10:00' },
      MODALIDADE,
    ],
    camposObrigatorios: [],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_profissional}}! A sessão de {{nome_paciente}} foi remarcada.',
      '',
      'Horário anterior: {{horario_anterior}}',
      'Novo horário: {{novo_horario}}',
      '{{modalidade}}',
    ].join('\n'),
  },
  {
    finalidade: 'agenda_solicitacao_reagendamento_psicologo',
    titulo: 'Paciente pediu reagendamento',
    evento: 'O paciente solicita outro horário pelo link.',
    destinatario: 'psicologo',
    essencial: true,
    campos: [
      NOME_PACIENTE, NOME_PROFISSIONAL, DIA_HORARIO,
      { nome: 'horario_solicitado', descricao: 'Horário pedido pelo paciente', exemplo: 'sexta-feira, 22 de agosto, às 10:00' },
      { nome: 'link_agenda', descricao: 'Link para aceitar ou recusar na agenda', exemplo: 'https://clinicavivermais.cloud/agenda?…' },
    ],
    camposObrigatorios: ['link_agenda'],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_profissional}}! {{nome_paciente}} solicitou um reagendamento.',
      '',
      'Horário atual: {{dia_horario}}',
      'Horário solicitado: {{horario_solicitado}}',
      '',
      'Acesse a plataforma para aceitar ou recusar: {{link_agenda}}',
    ].join('\n'),
  },
  {
    finalidade: 'agenda_recusa_reagendamento_paciente',
    titulo: 'Reagendamento recusado (paciente)',
    evento: 'O psicólogo recusa o horário pedido pelo paciente.',
    destinatario: 'paciente',
    essencial: true,
    campos: [NOME_PACIENTE, NOME_PROFISSIONAL, DIA_HORARIO],
    camposObrigatorios: [],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: 'Olá, {{nome_paciente}}. A solicitação de mudança não foi aceita. Sua sessão continua confirmada para {{dia_horario}}.',
  },
  {
    finalidade: 'aceite_sem_agendamento_gestao',
    titulo: 'Aceito há 48 horas sem primeiro agendamento',
    evento: 'Um paciente aceito completa 48 horas sem sessão marcada com o profissional do vínculo.',
    destinatario: 'gestao',
    essencial: true,
    campos: [
      { nome: 'protocolo', descricao: 'Protocolo da solicitação', exemplo: 'VM-2026-0042' },
      NOME_PROFISSIONAL,
      { nome: 'aceito_em', descricao: 'Data e hora do aceite', exemplo: 'segunda-feira, 23 de novembro, às 09:30' },
      { nome: 'horas', descricao: 'Horas do prazo', exemplo: '48' },
    ],
    camposObrigatorios: ['protocolo'],
    canais: ['whatsapp', 'sino'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Aviso à Gestão — paciente aceito sem primeiro agendamento.',
      'Protocolo: {{protocolo}}',
      'Profissional: {{nome_profissional}}',
      'Aceito em: {{aceito_em}}',
      'Já se passaram {{horas}} horas sem sessão marcada. O paciente continua ativo com esse profissional.',
    ].join('\n'),
  },
  {
    finalidade: 'aviso_saida_turma',
    titulo: 'Contagem de saída da turma',
    evento: 'Marco da contagem de saída depois do encerramento da turma.',
    destinatario: 'psicologo',
    essencial: false,
    campos: [
      NOME_PROFISSIONAL,
      { nome: 'texto_aviso', descricao: 'Texto do marco (dias restantes, curso e turma)', exemplo: 'Faltam 30 dias para sua saída da clínica.' },
    ],
    camposObrigatorios: ['texto_aviso'],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    ativacaoEm: { rotulo: 'Cursos, Turmas e Demandas › Avisos de saída', href: '/gestao/cursos' },
    modeloPadrao: 'Olá, {{nome_profissional}}! 💜\n\n{{texto_aviso}}\n\nEquipe Viver Mais Psicologia',
  },
  {
    finalidade: 'lembrete_sessao_paciente',
    titulo: 'Lembrete da sessão (paciente)',
    evento: 'Véspera de uma sessão agendada ou confirmada. Sai em horário comercial, uma vez por horário.',
    destinatario: 'paciente',
    essencial: false,
    campos: [NOME_PACIENTE, NOME_PROFISSIONAL, DIA_HORARIO, MODALIDADE],
    camposObrigatorios: ['dia_horario'],
    canais: ['whatsapp'],
    canalPadrao: 'whatsapp',
    reenviavel: true,
    modeloPadrao: [
      'Olá, {{nome_paciente}}! Lembrete da sua sessão na Viver Mais Psicologia.',
      '',
      'Profissional: {{nome_profissional}}',
      'Quando: {{dia_horario}}',
      '{{modalidade}}',
      '',
      'Se precisar remarcar ou desmarcar, responda esta mensagem com antecedência.',
    ].join('\n'),
  },
];

const POR_FINALIDADE = new Map(CATALOGO_AVISOS.map((aviso) => [aviso.finalidade, aviso]));

export function avisoDoCatalogo(finalidade: string): AvisoDoCatalogo | undefined {
  return POR_FINALIDADE.get(finalidade as FinalidadeEditavel);
}

export function modeloPadrao(finalidade: FinalidadeEditavel): string {
  return POR_FINALIDADE.get(finalidade)!.modeloPadrao;
}

/** Configuração gravada de um aviso (chave `modelo_aviso:<finalidade>`). */
export interface ConfiguracaoDoAviso {
  versao: number;
  /** `null` volta ao texto padrão. */
  texto: string | null;
  canal: CanalAviso;
  /** Só tem efeito para complementares; essenciais ficam sempre ativos. */
  ativo: boolean;
}

export const PREFIXO_CHAVE_MODELO = 'modelo_aviso:';

export function configuracaoPadrao(aviso: AvisoDoCatalogo): ConfiguracaoDoAviso {
  return { versao: 0, texto: null, canal: aviso.canalPadrao, ativo: aviso.essencial };
}

/** Lê o que veio do banco sem confiar no formato. */
export function normalizarConfiguracao(aviso: AvisoDoCatalogo, valor: unknown): ConfiguracaoDoAviso {
  const padrao = configuracaoPadrao(aviso);
  if (!valor || typeof valor !== 'object') return padrao;
  const bruto = valor as Record<string, unknown>;
  const canal = typeof bruto.canal === 'string' && aviso.canais.includes(bruto.canal as CanalAviso)
    ? bruto.canal as CanalAviso : padrao.canal;
  return {
    versao: Number.isSafeInteger(bruto.versao) && Number(bruto.versao) > 0 ? Number(bruto.versao) : 0,
    texto: typeof bruto.texto === 'string' && bruto.texto.trim() ? bruto.texto : null,
    canal,
    ativo: aviso.essencial ? true : bruto.ativo === true,
  };
}

export function usaWhatsApp(canal: CanalAviso): boolean {
  return canal === 'whatsapp' || canal === 'whatsapp_email';
}

export function usaEmail(canal: CanalAviso): boolean {
  return canal === 'email' || canal === 'whatsapp_email';
}
