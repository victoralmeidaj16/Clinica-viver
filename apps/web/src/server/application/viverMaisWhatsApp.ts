import 'server-only';

import {
  assertWhatsAppRecipientAllowed,
  RecipientNotAllowedError,
} from '@/server/adapters/whatsappAllowlist';
import { gerarTokenConfirmacao } from '@/server/viverMaisConfirmToken';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import { formatBrazilPhone, normalizeBrazilPhone } from '@/lib/brazilPhone';
import { formatGender } from '@/lib/gender';
import { nomeDeExibicao, normalizarTurno, SLA_CONTATO_HORAS } from './viverMaisRodizio';
import { COMANDO_CONFIRMAR, COMANDO_ENCAMINHAR } from './viverMaisComandos';

/**
 * Avisos de WhatsApp da triagem — o "disparo duplo" do fluxo de captação.
 *
 * Toda solicitação gera **duas** mensagens, com conteúdos deliberadamente
 * diferentes:
 *
 *   - ao **psicólogo**, os dados para ele fazer o primeiro contato e o link que
 *     registra que ele fez;
 *   - ao **paciente**, apenas a confirmação de que a solicitação chegou e o
 *     prazo de retorno. Sem nome de profissional, sem valor, sem nada clínico.
 *
 * O paciente não recebe o nome de quem vai atendê-lo porque o vínculo ainda não
 * existe: até a confirmação, aquele profissional pode ser trocado pelo
 * transbordo — e prometer um nome que muda em 24h é pior do que não prometer.
 *
 * Nada aqui lança para o chamador em caso de falha de envio. Alocar e avisar
 * são coisas distintas: um WhatsApp fora do ar não pode desfazer uma alocação
 * já decidida e gravada.
 */

export type FinalidadeMensagem =
  | 'alocacao_psicologo'
  | 'recebimento_paciente'
  | 'boas_vindas_psicologo'
  | 'alerta_coordenacao'
  | 'resposta_psicologo'
  | 'agenda_confirmacao_paciente'
  | 'agenda_confirmacao_psicologo'
  | 'agenda_cancelamento_paciente'
  | 'transbordo_paciente';

export interface ResultadoEnvio {
  finalidade: FinalidadeMensagem;
  chaveDedupe: string;
  situacao: 'enviada' | 'bloqueada_allowlist' | 'provedor_desconfigurado' | 'falha';
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
    });

    if (!resposta.ok) {
      console.warn(`[whatsapp] Provedor recusou "${finalidade}": HTTP ${resposta.status}.`);
      return { finalidade, chaveDedupe, situacao: 'falha' };
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
  activationUrl: string
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
    `boas-vindas:${psicologo.id}`,
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
  const idade = lead.idade?.toString().trim();

  if (lead.nomeSocial?.trim()) {
    linhas.push(`Nome social: ${lead.nomeSocial.trim()}`);
    linhas.push(`Nome civil: ${lead.nomePaciente}`);
  } else {
    linhas.push(`Nome completo: ${lead.nomePaciente}`);
  }
  linhas.push(`WhatsApp do paciente: ${formatBrazilPhone(lead.telefone) || lead.telefone}`);
  if (idade) linhas.push(`Idade: ${idade}`);
  const genero = formatGender(lead.genero, lead.generoOutro);
  if (genero) linhas.push(`Gênero: ${genero}`);
  if (lead.paraQuemE) linhas.push(`Atendimento para: ${lead.paraQuemE}`);
  linhas.push(`Serviço: ${lead.servico || 'Não informado'}`);
  if (lead.opcaoAvaliacaoPsicologica) linhas.push(`Tipo de avaliação: ${lead.opcaoAvaliacaoPsicologica}`);
  linhas.push(`Modalidade: ${rotuloModalidadeLead(lead.modalidade)}`);
  linhas.push(`Turno de preferência: ${rotuloTurnoLead(lead.turno)}`);
  // Só aparece quando houve pedido. É o que explica por que este lead chegou a
  // esta pessoa e não à próxima da fila — e o que a gestão precisa respeitar se
  // o caso for devolvido.
  if (lead.preferenciaGeneroPsicologo === 'FEMININO') {
    linhas.push('Pediu ser atendido(a) por: psicóloga');
  } else if (lead.preferenciaGeneroPsicologo === 'MASCULINO') {
    linhas.push('Pediu ser atendido(a) por: psicólogo');
  }
  if (lead.possuiConvenio === 'SIM' && lead.convenioSelecionado && lead.convenioSelecionado !== 'Nenhum') {
    linhas.push(`Convênio: ${lead.convenioSelecionado}`);
  }

  const demandas = [
    ...(lead.necessidadesPaciente ?? []),
    ...(lead.necessidadesOutro ? [lead.necessidadesOutro] : []),
  ];
  if (demandas.length > 0) linhas.push(`Demandas informadas: ${demandas.join(', ')}`);

  return linhas;
}

/** O turno como a pessoa fala, não como o formulário grava. */
function rotuloTurnoLead(turno: string | undefined): string {
  switch (normalizarTurno(turno)) {
    case 'MANHA':
      return 'Manhã';
    case 'TARDE':
      return 'Tarde';
    case 'NOITE':
      return 'Noite';
    default:
      return turno || 'Não informado';
  }
}

/** Faixa de valor escolhida na vitrine, no vocabulário que o profissional usa. */
function rotuloModalidadeLead(modalidade: string | undefined): string {
  switch (modalidade?.trim().toUpperCase()) {
    case 'SOCIAL':
      return 'Acessível (social)';
    case 'CASAL_SOCIAL':
      return 'Acessível (social) — casal';
    case 'PARTICULAR':
      return 'Particular';
    case 'CASAL_PARTICULAR':
      return 'Particular — casal';
    default:
      return modalidade || 'Não informada';
  }
}

/**
 * Mensagem ao profissional que recebeu o lead.
 *
 * Pede resposta no próprio chat — `CONFIRMAR` ou `ENCAMINHAR` — porque é o gesto
 * mais barato de todos: quem está no WhatsApp responde ali, sem abrir link nem
 * lembrar de senha. O link de confirmação continua junto para quem prefere
 * clicar, e os dois caminhos gravam exatamente a mesma coisa.
 */
export function textoParaPsicologo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord
): string {
  const linhas = [
    `Olá, ${nomeDeExibicao(psicologo)}! Você recebeu um novo paciente pela Viver Mais.`,
    '',
    ...dadosDoPaciente(lead),
    '',
    `O primeiro contato precisa ser feito em até ${SLA_CONTATO_HORAS}h. Responda aqui mesmo:`,
    '',
    `*${COMANDO_CONFIRMAR}* — quando você já tiver falado com o paciente.`,
    `*${COMANDO_ENCAMINHAR}* — se não for atender, e o paciente vai para o próximo profissional da fila que atende os critérios.`,
    '',
    'Se preferir, confirme pelo link:',
    linkConfirmacao(lead, psicologo.id),
    '',
    '💡 *Dica:* entre em contato o quanto antes! Quanto mais rápido você falar com o paciente, maiores são as chances de conseguir agendar o atendimento com ele.',
    '',
    `Sem resposta em ${SLA_CONTATO_HORAS}h, o paciente é encaminhado automaticamente ao próximo da fila.`,
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

/**
 * Mensagem de confirmação enviada ao paciente quando solicita atendimento na vitrine.
 */
export function textoParaPaciente(lead: TriagemPacienteRecord): string {
  const nomePaciente = lead.nomeSocial?.trim() || lead.nomePaciente?.trim() || 'Paciente';
  const { servico, modalidadeRotulo, valor } = resolverPrecoEModalidade(lead);

  return [
    `Olá, ${nomePaciente}! 💜`,
    'Aqui é a Clínica Viver Mais Psicologia!',
    '',
    `Ficamos felizes por você ter escolhido a Viver Mais para dar esse passo tão importante no seu processo de ${servico}. 💜🧡 Seu agendamento já foi encaminhado ao(à) psicólogo(a).`,
    '',
    'Aqui estão algumas informações importantes sobre o seu atendimento:',
    '',
    '📲 Contato com o(a) psicólogo(a)',
    'O(a) psicólogo(a) tem até 24 horas para entrar em contato com você após o recebimento desta mensagem.',
    '',
    '💳 Pagamento da consulta',
    'O pagamento da sua consulta é realizado diretamente para a Viver Mais Psicologia, via PIX ou cartão de crédito.',
    '',
    'O(a) psicólogo(a) enviará o link de pagamento para você. Ao acessar o link, você encontrará as informações da Viver Mais para conferência:',
    '',
    'Nome: Viviane Oliveira de Almeida Jeremias e Cia LTDA',
    'Nome comercial: Viver Mais Psicologia',
    '',
    `O valor para ${servico} ${modalidadeRotulo} é de ${valor} por sessão.`,
    '',
    '📅 Horários e pagamento',
    'A combinação de horários, datas das sessões e demais detalhes do atendimento será feita diretamente com o(a) psicólogo(a).',
    '',
    'As sessões individuais têm duração de 50 minutos e as sessões de casal/família, 1h30.',
    '',
    'Se após 24 horas você ainda não tiver recebido o contato do(a) psicólogo(a), por favor, me avise para que eu possa ajudar.',
    '',
    'Caso o prazo de 24 horas coincida com finais de semana ou feriados, ele será estendido até o próximo dia útil.',
    '',
    'Seja muito bem-vindo(a) à Viver Mais! 💜',
    'Estamos felizes em poder fazer parte desse processo com você.',
    '',
    'Com carinho,',
    'Clínica Viver Mais Psicologia',
    '',
    '⚠️ Em caso de urgência: se você estiver em sofrimento emocional agudo ou em uma situação de crise, ligue gratuitamente para o CVV – 188 (24h) ou procure o serviço de emergência mais próximo.',
  ].join('\n');
}

/**
 * Mensagem acolhedora enviada ao paciente em caso de encaminhamento / transbordo ("alerta operacional").
 */
export function textoParaPacienteTransbordo(): string {
  return [
    'Para dar continuidade ao seu atendimento, vamos encaminhar você para outro(a) psicólogo(a) da nossa equipe.',
    '',
    'Essa mudança é necessária por questões de organização e disponibilidade dos(as) psicólogos(as) da clínica, para que possamos garantir a continuidade do seu atendimento. 💜',
    '',
    'O(a) novo(a) psicólogo(a) entrará em contato com você em breve.',
  ].join('\n');
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

/**
 * Disparo duplo de uma alocação nova: avisa o profissional e o paciente.
 *
 * Usado tanto na entrada do lead quanto na aprovação manual. O paciente só é
 * avisado uma vez, na primeira alocação — ver `avisarTransbordo`.
 */
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
    await enviarTexto(
      lead.telefone,
      textoParaPaciente(lead),
      'recebimento_paciente',
      `recebimento:${lead.id}`
    ),
  ];
}

/**
 * Aviso de transbordo ("alerta operacional"): o novo profissional, o paciente
 * e a coordenação são notificados.
 *
 * O paciente recebe mensagem acolhedora informando o encaminhamento para outro
 * profissional da equipe a fim de garantir a continuidade do atendimento.
 */
export async function avisarTransbordo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord,
  psicologoAnteriorNome?: string,
  motivo: 'sla_vencido' | 'encaminhamento_voluntario' | 'reatribuicao_gestao' = 'sla_vencido'
): Promise<ResultadoEnvio[]> {
  const transbordosContador = lead.transbordos ?? 0;
  const resultados = [
    await enviarTexto(
      psicologo.whatsapp,
      textoParaPsicologo(lead, psicologo),
      'alocacao_psicologo',
      `alocacao:${lead.id}:${psicologo.id}`
    ),
    await enviarTexto(
      lead.telefone,
      textoParaPacienteTransbordo(),
      'transbordo_paciente',
      `transbordo-paciente:${lead.id}:${psicologo.id}:${transbordosContador}`
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
        : 'Alerta operacional — responsável reatribuído pela gestão.',
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
