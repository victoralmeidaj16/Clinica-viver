import { rotuloTurnoPreferencia } from '@/lib/turnos';
import 'server-only';

import {
  assertWhatsAppRecipientAllowed,
  RecipientNotAllowedError,
} from '@/server/adapters/whatsappAllowlist';
import { gerarTokenConfirmacao } from '@/server/viverMaisConfirmToken';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import { formatBrazilPhone, normalizeBrazilPhone } from '@/lib/brazilPhone';
import { formatGender } from '@/lib/gender';
import { nomeDeExibicao, SLA_CONTATO_HORAS } from './viverMaisRodizio';

/**
 * Avisos da triagem: acolhimento na solicitação, orientações na confirmação.
 * Alocações e encaminhamentos avisam somente profissionais e coordenação.
 * Falhas de envio não desfazem operações já persistidas.
 */

export type FinalidadeMensagem =
  | 'alocacao_psicologo'
  | 'recebimento_paciente'
  | 'boas_vindas_psicologo'
  | 'alerta_coordenacao'
  | 'resposta_psicologo'
  | 'agenda_confirmacao_paciente'
  | 'agenda_confirmacao_psicologo'
  | 'agenda_remarcacao_paciente'
  | 'agenda_remarcacao_psicologo'
  | 'agenda_solicitacao_reagendamento_psicologo'
  | 'agenda_recusa_reagendamento_paciente'
  | 'agenda_cancelamento_paciente'
  | 'confirmacao_triagem_paciente';

export interface ResultadoEnvio {
  finalidade: FinalidadeMensagem;
  chaveDedupe: string;
  situacao: 'enviada' | 'bloqueada_allowlist' | 'provedor_desconfigurado' | 'falha';
  /** Recusa explícita antes da entrega; timeout não permite presumir falha de entrega. */
  reenvioSeguro?: boolean;
}

/**
 * Chaves já disparadas neste processo.
 *
 * Deduplicação de escopo modesto e honesto: impede o caso real de hoje — a
 * varredura do SLA rodando várias vezes na mesma janela e reavisando o mesmo
 * profissional pelo mesmo lead. Não sobrevive a restart nem é compartilhada
 * entre instâncias; a garantia forte virá quando a fila de
 * `packages/core/src/communication` assumir o envio.
 */
const jaDisparado = new Set<string>();

function evolutionConfig(): { url: string; apiKey: string; instancia: string } | null {
  const url = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instancia = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  if (!url || !apiKey || !instancia) return null;
  return { url, apiKey, instancia };
}

/**
 * Envia um texto pelo WhatsApp, passando obrigatoriamente pela trava do piloto.
 *
 * A ordem importa: a allowlist é consultada **antes** de qualquer chamada de
 * rede. Enquanto a operação está em piloto, número fora da lista não é assunto
 * do provedor — a mensagem não deve sequer sair daqui.
 */
export async function enviarTexto(
  telefone: string,
  texto: string,
  finalidade: FinalidadeMensagem,
  chaveDedupe: string,
  autorizadoPelaGestao = false
): Promise<ResultadoEnvio> {
  if (jaDisparado.has(chaveDedupe)) {
    return { finalidade, chaveDedupe, situacao: 'enviada' };
  }

  if (!autorizadoPelaGestao) {
    try {
      assertWhatsAppRecipientAllowed(telefone);
    } catch (erro) {
      if (erro instanceof RecipientNotAllowedError) {
        // Recusa explícita e sem o número no log — bloqueio registrado não é
        // falha silenciosa, e log não é lugar de contato de paciente.
        console.warn(`[whatsapp] Envio "${finalidade}" bloqueado: destinatário fora da allowlist.`);
        return { finalidade, chaveDedupe, situacao: 'bloqueada_allowlist' };
      }
      throw erro;
    }
  }

  const config = evolutionConfig();
  if (!config) {
    console.info(`[whatsapp] Provedor não configurado; "${finalidade}" não foi enviada.`);
    return { finalidade, chaveDedupe, situacao: 'provedor_desconfigurado' };
  }

  try {
    const resposta = await fetch(`${config.url}/message/sendText/${config.instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
      body: JSON.stringify({ number: normalizeBrazilPhone(telefone) ?? telefone.replace(/\D/g, ''), text: texto }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resposta.ok) {
      console.warn(`[whatsapp] Provedor recusou "${finalidade}": HTTP ${resposta.status}.`);
      return { finalidade, chaveDedupe, situacao: 'falha', reenvioSeguro: resposta.status >= 400 && resposta.status < 500 };
    }

    jaDisparado.add(chaveDedupe);
    return { finalidade, chaveDedupe, situacao: 'enviada' };
  } catch (erro) {
    console.warn(`[whatsapp] Falha ao enviar "${finalidade}":`, erro);
    return { finalidade, chaveDedupe, situacao: 'falha' };
  }
}

/**
 * Convite de acesso enviado apenas depois da aprovação autenticada da gestão.
 * Esse destinatário não depende da allowlist do piloto: o telefone foi
 * informado pelo próprio profissional e conferido pela administração.
 */
export async function avisarBoasVindasPsicologo(
  psicologo: CadastroPsicologoRecord,
  activationUrl: string,
  tentativaId?: string
): Promise<ResultadoEnvio> {
  const nome = psicologo.nomeSocial?.trim() || psicologo.nomeCompleto.trim();
  const texto = [
    `Olá, ${nome}! Seu cadastro profissional foi aprovado pela Viver Mais Psicologia.`,
    '',
    'Seu acesso à plataforma já está disponível.',
    `Login: ${psicologo.email}`,
    '',
    'Crie sua senha pessoal pelo link seguro abaixo:',
    activationUrl,
    '',
    'O link é individual, expira em 72 horas e pode ser usado uma única vez.',
    'A Viver Mais nunca solicitará sua senha pelo WhatsApp.',
  ].join('\n');
  return enviarTexto(
    psicologo.whatsapp,
    texto,
    'boas_vindas_psicologo',
    `boas-vindas:${psicologo.id}${tentativaId ? `:${tentativaId}` : ''}`,
    true
  );
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
    'https://clinicavivermais.cloud'
  );
}

function linkConfirmacao(lead: TriagemPacienteRecord, psicologoId: string): string {
  const token = gerarTokenConfirmacao(lead.id, psicologoId);
  return `${baseUrl()}/confirmar-contato/${lead.id}?psi=${encodeURIComponent(psicologoId)}&t=${token}`;
}

/**
 * O que o profissional precisa saber do paciente para decidir e para ligar.
 *
 * Nome, CPF, e-mail e endereço ficam de fora de propósito: a decisão de assumir
 * ou devolver o caso se toma pelo perfil da demanda, e este texto trafega por
 * WhatsApp — que é o canal menos controlado da operação. O telefone é a única
 * exceção, porque sem ele não existe o primeiro contato que a mensagem cobra.
 * O resto do cadastro está no cockpit, atrás de sessão.
 */
function dadosDoPaciente(lead: TriagemPacienteRecord): string[] {
  const linhas: string[] = [];
  linhas.push(`- *Nome social:* ${lead.nomeSocial?.trim() || 'Não informado'}`);
  linhas.push(`- *Nome civil:* ${lead.nomePaciente}`);
  linhas.push(`- *WhatsApp do paciente:* ${formatBrazilPhone(lead.telefone) || lead.telefone}`);
  const genero = formatGender(lead.genero, lead.generoOutro);
  linhas.push(`- *Gênero:* ${genero || 'Não informado'}`);
  linhas.push(`- *Serviço:* ${lead.servico || 'Não informado'}`);
  linhas.push(`- *Modalidade:* ${rotuloModalidadeLead(lead.modalidade)}`);
  linhas.push(`- *Turno de preferência:* ${rotuloTurnoLead(lead.turno)}`);

  return linhas;
}

/** O turno como a pessoa fala, não como o formulário grava. */
function rotuloTurnoLead(turno: string | undefined): string {
  return rotuloTurnoPreferencia(turno);
}

/** Faixa de valor escolhida na vitrine, no vocabulário que o profissional usa. */
function rotuloModalidadeLead(modalidade: string | undefined): string {
  switch (modalidade?.trim().toUpperCase()) {
    case 'SOCIAL':
      return 'Acessível (social)';
    case 'CASAL_SOCIAL':
      return 'Acessível (social) — casal';
    case 'FAMILIA_SOCIAL':
      return 'Acessível (social) — família';
    case 'PARTICULAR':
      return 'Particular';
    case 'CASAL_PARTICULAR':
      return 'Particular — casal';
    case 'FAMILIA_PARTICULAR':
      return 'Particular — família';
    default:
      return modalidade || 'Não informada';
  }
}

/**
 * Mensagem ao profissional que recebeu o lead.
 *
 * Um único link concentra o aceite, a recusa e a confirmação posterior do
 * primeiro contato, mantendo a decisão protegida pelo token da alocação.
 */
export function textoParaPsicologo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord
): string {
  const linhas = [
    `Olá, ${nomeDeExibicao(psicologo)}! 💜 Você recebeu um novo paciente pela Viver Mais.`,
    '',
    '*Dados do paciente*',
    '',
    ...dadosDoPaciente(lead),
    '',
    '*📌 O que você precisa fazer?*',
    '',
    'Acesse o link abaixo para informar se deseja atender esse paciente.',
    '➡️ Se não desejar atender, poderá selecionar a opção de encaminhar o paciente ao próximo profissional da fila que atenda aos critérios.',
    '',
    linkConfirmacao(lead, psicologo.id),
    '',
    `🚨 *Atenção:* é importante acessar o link e registrar sua decisão. Caso não haja uma resposta em até ${SLA_CONTATO_HORAS} horas, o paciente será encaminhado automaticamente ao próximo profissional da fila.`,
    '',
    'Entre em contato o quanto antes! Quanto mais rápido o paciente receber seu contato, maiores são as chances de conseguir agendar o atendimento. 💜',
  ];
  return linhas.join('\n');
}

/**
 * Determina o rótulo do serviço, da modalidade e o valor para exibição na mensagem ao paciente.
 */
export function resolverPrecoEModalidade(lead: TriagemPacienteRecord): {
  servico: string;
  modalidadeRotulo: string;
  valor: string;
} {
  const servico = lead.servico?.trim() || 'Psicoterapia Individual';
  const modalidade = lead.modalidade?.trim().toUpperCase();
  const isCasal = modalidade?.includes('CASAL') || servico.toLowerCase().includes('casal');
  const isAvaliacao = servico.toLowerCase().includes('avaliação') || servico.toLowerCase().includes('avaliacao');
  const isParticular = modalidade === 'PARTICULAR' || modalidade === 'CASAL_PARTICULAR';

  const modalidadeRotulo = isParticular ? 'Particular' : 'Acessível';

  let valor = isParticular ? 'R$ 130,00' : 'R$ 75,00';
  if (isCasal) {
    valor = isParticular ? 'R$ 260,00' : 'R$ 150,00';
  } else if (isAvaliacao) {
    valor = isParticular ? 'R$ 150,00' : 'R$ 100,00';
  }

  return { servico, modalidadeRotulo, valor };
}

/** Acolhimento imediato, inclusive quando não há profissional disponível. */
export function textoRecebimentoPaciente(): string {
  return [
    'Olá! Seja bem-vindo(a) à Viver Mais Psicologia! 🫂',
    '',
    'Recebemos sua solicitação de agendamento e agradecemos por entrar em contato com a gente!',
    '',
    'Em breve, você receberá as próximas orientações por aqui, neste mesmo contato.',
    '',
    'Estamos à disposição para te acolher! ✨',
    '',
    '⚠️ Em caso de urgência: se você estiver em sofrimento emocional intenso ou em uma situação de crise, ligue para o CVV, pelo número 188 (24 horas), ou procure um serviço de emergência da sua região.',
  ].join('\n');
}

/** Orientações enviadas somente depois da confirmação do psicólogo. */
export function textoParaPaciente(lead: TriagemPacienteRecord): string {
  const nomePaciente = lead.nomeSocial?.trim() || lead.nomePaciente?.trim() || 'Paciente';
  const { servico, modalidadeRotulo, valor } = resolverPrecoEModalidade(lead);

  return [
    `Olá, ${nomePaciente}! 💜`,
    'Aqui é a equipe da Clínica Viver Mais Psicologia!',
    '',
    `Que bom ter você com a gente! 🫂 Ficamos felizes por você ter escolhido a Viver Mais para dar esse passo tão importante no seu processo de ${servico}. Seu agendamento já foi encaminhado ao(à) psicólogo(a), e queremos te passar algumas informações importantes para os próximos passos.`,
    '',
    '📲 Contato com o(a) psicólogo(a)',
    '',
    'O(a) psicólogo(a) tem até 24 horas para entrar em contato com você após o recebimento desta mensagem.',
    '',
    'Caso esse prazo coincida com finais de semana ou feriados, ele será estendido até o próximo dia útil.',
    '',
    'Se você não receber o contato dentro desse prazo, avise a gente por aqui para que possamos ajudar!',
    '',
    '💳 Pagamento da consulta',
    '',
    'O pagamento é realizado diretamente à Viver Mais Psicologia, via PIX ou cartão de crédito.',
    '',
    'O(a) psicólogo(a) enviará o link de pagamento para você. Ao acessá-lo, encontrará os dados da clínica para conferência:',
    '',
    'Nome: Viviane Oliveira de Almeida Jeremias e Cia LTDA',
    'Nome comercial: Viver Mais Psicologia',
    '',
    `O valor para ${servico} ${modalidadeRotulo} é de ${valor} por sessão.`,
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
    '⚠️ Em caso de urgência: se você estiver em sofrimento emocional intenso ou em uma situação de crise, ligue para o CVV, pelo número 188 (24 horas), ou procure um serviço de emergência da sua região.',
  ].join('\n');
}

export async function avisarRecebimentoPaciente(lead: TriagemPacienteRecord): Promise<ResultadoEnvio> {
  return enviarTexto(lead.telefone, textoRecebimentoPaciente(), 'recebimento_paciente', `recebimento:${lead.id}`);
}

export async function avisarConfirmacaoPaciente(lead: TriagemPacienteRecord): Promise<ResultadoEnvio> {
  return enviarTexto(lead.telefone, textoParaPaciente(lead), 'confirmacao_triagem_paciente', `confirmacao-paciente:${lead.id}`);
}

/**
 * Resposta ao próprio profissional, no fio da conversa dele.
 *
 * Existe porque o WhatsApp virou canal de mão dupla: quem responde `CONFIRMAR` ou
 * `ENCAMINHAR` precisa saber se a clínica registrou. Silêncio depois de uma
 * resposta é o que faz a pessoa mandar de novo — e duplicar comando é como se
 * perde um paciente para o profissional errado.
 */
export async function responderPsicologo(
  psicologo: CadastroPsicologoRecord,
  texto: string,
  chaveDedupe: string
): Promise<ResultadoEnvio> {
  return enviarTexto(psicologo.whatsapp, texto, 'resposta_psicologo', `resposta:${chaveDedupe}`);
}

/** Aviso operacional para os números da coordenação, se houver algum configurado. */
export async function avisarCoordenacao(texto: string, chaveDedupe: string): Promise<ResultadoEnvio[]> {
  const destinatarios = (process.env.WHATSAPP_COORDINATION_NUMBERS ?? '')
    .split(',')
    .map((numero) => numero.trim())
    .filter(Boolean);

  const resultados: ResultadoEnvio[] = [];
  for (const destinatario of destinatarios) {
    resultados.push(
      await enviarTexto(
        destinatario,
        texto,
        'alerta_coordenacao',
        `${chaveDedupe}:${destinatario.replace(/\D/g, '')}`
      )
    );
  }
  return resultados;
}

/** A alocação avisa apenas o profissional; o recebimento pertence à entrada do lead. */
export async function avisarAlocacao(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord
): Promise<ResultadoEnvio[]> {
  return [
    await enviarTexto(
      psicologo.whatsapp,
      textoParaPsicologo(lead, psicologo),
      'alocacao_psicologo',
      `alocacao:${lead.id}:${psicologo.id}`
    ),
  ];
}

/** Encaminhamentos avisam o novo profissional e a coordenação, sem mensagem ao paciente. */
export async function avisarTransbordo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord,
  psicologoAnteriorNome?: string,
  motivo: 'sla_vencido' | 'encaminhamento_voluntario' | 'reatribuicao_gestao' = 'sla_vencido'
): Promise<ResultadoEnvio[]> {
  const resultados = [
    await enviarTexto(
      psicologo.whatsapp,
      textoParaPsicologo(lead, psicologo),
      'alocacao_psicologo',
      `alocacao:${lead.id}:${psicologo.id}`
    ),
  ];

  // A coordenação vê o evento operacional, não os dados clínicos nem o
  // telefone do paciente. Cada número ainda passa pela allowlist do piloto.
  const destinatarios = (process.env.WHATSAPP_COORDINATION_NUMBERS ?? '')
    .split(',')
    .map((numero) => numero.trim())
    .filter(Boolean);
  const anterior = psicologoAnteriorNome?.trim() || 'profissional anterior';
  const textoCoordenacao = [
    motivo === 'sla_vencido'
      ? 'Alerta operacional — prazo para o primeiro contato vencido.'
      : motivo === 'encaminhamento_voluntario'
        ? 'Alerta operacional — profissional respondeu ENCAMINHAR.'
        : 'Alerta operacional — paciente encaminhado pela gestão para um novo responsável.',
    `Protocolo: ${lead.protocolo}`,
    `Transbordo: ${anterior} → ${nomeDeExibicao(psicologo)}`,
    `Transbordos realizados: ${lead.transbordos ?? 0}`,
  ].join('\n');

  for (const destinatario of destinatarios) {
    resultados.push(
      await enviarTexto(
        destinatario,
        textoCoordenacao,
        'alerta_coordenacao',
        `alerta-transbordo:${lead.id}:${psicologo.id}:${destinatario.replace(/\D/g, '')}`
      )
    );
  }

  return resultados;
}
