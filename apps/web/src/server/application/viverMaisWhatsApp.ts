import { resolveAttendancePricing } from '@/lib/attendancePricing';
import { deliverWhatsApp } from '@/server/communication/whatsappDelivery';
import { rotuloTurnoPreferencia } from '@/lib/turnos';
import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { custeioEfetivoSql } from '@/server/persistence/mysql/custeioSql';
import { patientSessionPricingFromRow } from '@/server/persistence/mysql/patientSessionPricing';

import {
  assertWhatsAppRecipientAllowed,
  RecipientNotAllowedError,
} from '@/server/adapters/whatsappAllowlist';
import { gerarTokenConfirmacao } from '@/server/viverMaisConfirmToken';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import { formatBrazilPhone, normalizeBrazilPhone } from '@/lib/brazilPhone';
import { formatGender } from '@/lib/gender';
import { nomeDeExibicao } from './viverMaisRodizio';
import { prazoDaOferta, rotuloPrazo } from '@/lib/prazoOferta';
import { responsavelDoPrimeiroContato } from '@/lib/responsavelFinanceiro';
import { ROTULO_TIPO_COLETIVO } from '@/lib/vinculoColetivo';

/**
 * Avisos da triagem: acolhimento na solicitação, orientações no aceite.
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

function evolutionConfig(): { url: string; apiKey: string; instancia: string } | null {
  const url = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instancia = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  if (!url || !apiKey || !instancia) return null;
  return { url, apiKey, instancia };
}

/**
 * Envia um texto pelo WhatsApp, validando o telefone **antes** de qualquer
 * chamada de rede: número vazio ou truncado não é assunto do provedor.
 */
export async function enviarTexto(
  telefone: string,
  texto: string,
  finalidade: FinalidadeMensagem,
  chaveDedupe: string,
  autorizadoPelaGestao = false
): Promise<ResultadoEnvio> {
  if (!autorizadoPelaGestao) {
    try {
      assertWhatsAppRecipientAllowed(telefone);
    } catch (erro) {
      if (erro instanceof RecipientNotAllowedError) {
        // Recusa explícita e sem o número no log — bloqueio registrado não é
        // falha silenciosa, e log não é lugar de contato de paciente.
        console.warn(`[whatsapp] Envio "${finalidade}" bloqueado: telefone inválido.`);
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
    const result = await deliverWhatsApp({
      scope: 'operacional', key: chaveDedupe,
      number: normalizeBrazilPhone(telefone) ?? telefone.replace(/\D/g, ''), text: texto, config,
    });
    return { finalidade, chaveDedupe, situacao: result.state === 'sent' ? 'enviada' : 'falha',
      ...(result.state !== 'sent' ? { reenvioSeguro: result.state === 'rejected' } : {}) };
  } catch {
    console.warn(`[whatsapp] Não foi possível confirmar o envio "${finalidade}".`);
    return { finalidade, chaveDedupe, situacao: 'falha', reenvioSeguro: false };
  }
}

/**
 * Convite de acesso enviado apenas depois da aprovação autenticada da gestão.
 * O telefone foi informado pelo próprio profissional e conferido pela
 * administração.
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
  // O primeiro contato do menor é com o responsável (6.03): sem o número dele,
  // o psicólogo ligaria para quem a clínica não deve abordar primeiro.
  const responsavel = responsavelDoPrimeiroContato(lead);
  if (responsavel) {
    linhas.push(`- *Responsável:* ${responsavel.nome}${responsavel.parentesco ? ` (${responsavel.parentesco})` : ''}`);
    if (responsavel.telefone) {
      linhas.push(`- *WhatsApp do responsável:* ${formatBrazilPhone(responsavel.telefone) || responsavel.telefone}`);
    }
  }
  if (lead.vinculoColetivo) {
    linhas.push(`- *Atendimento:* ${ROTULO_TIPO_COLETIVO[lead.vinculoColetivo.tipo]} (um vínculo, uma vaga)`);
  }

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
  // Pedido para profissional específico: recusa e silêncio vão para a
  // coordenação, nunca para o rodízio (especificação final, 4.05 e 5.04).
  const direto = lead.tipoAlocacao === 'ESCOLHA_DIRETA';
  const linhas = [
    `Olá, ${nomeDeExibicao(psicologo)}! 💜 Você recebeu um novo paciente pela Viver Mais.`,
    ...(direto ? ['O paciente escolheu você na vitrine.'] : []),
    '',
    '*Dados do paciente*',
    '',
    ...dadosDoPaciente(lead),
    '',
    '*📌 O que você precisa fazer?*',
    '',
    'Acesse o link abaixo para informar se deseja atender esse paciente.',
    '✅ Ao aceitar, o paciente recebe da clínica as orientações sobre os próximos passos, e você assume o contato para combinar o primeiro horário.',
    direto
      ? '➡️ Se não desejar atender, poderá recusar pelo mesmo link, e a coordenação da clínica decidirá o encaminhamento.'
      : '➡️ Se não desejar atender, poderá selecionar a opção de encaminhar o paciente ao próximo profissional da fila que atenda aos critérios.',
    '',
    linkConfirmacao(lead, psicologo.id),
    '',
    `🚨 *Atenção:* é importante acessar o link e registrar sua decisão. Caso não haja uma resposta em até ${rotuloPrazo(prazoDaOferta(lead))}, ${direto ? 'a solicitação seguirá para a coordenação da clínica' : 'o paciente será encaminhado automaticamente ao próximo profissional da fila'}.`,
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
  const { modalidadeRotulo, valor } = resolveAttendancePricing(servico, lead.modalidade);

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

export interface OpcoesPagamentoPaciente {
  custeadoPelaEmpresa?: boolean;
  convenioNome?: string;
  valorPersonalizadoCentavos?: number;
}

function formatarReaisCentavos(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(centavos / 100)
    .replace(/\u00a0/g, ' ');
}

async function resolverPagamentoPaciente(lead: TriagemPacienteRecord): Promise<OpcoesPagamentoPaciente> {
  if (!isMysqlConfigured()) return {};
  try {
    const pool = getMysqlPool();
    if (lead.pacienteRef) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT pa.categoria_valor_sessao, pa.valor_sessao_personalizado_centavos,
                conv.nome AS convenio_nome,
                ${custeioEfetivoSql({ paciente: 'pa', convenio: 'conv' })} AS custeado_pela_empresa
           FROM clinica_pacientes pa
           JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
           LEFT JOIN clinica_convenios conv
             ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
            AND conv.ref_core = pa.convenio_ref
          WHERE pa.instituicao_id = ? AND pa.ref_core = ?
          LIMIT 1`,
        [instituicaoId(), lead.pacienteRef]
      );
      const row = rows[0];
      if (row) {
        if (Boolean(row.custeado_pela_empresa)) {
          return {
            custeadoPelaEmpresa: true,
            convenioNome: row.convenio_nome ? String(row.convenio_nome) : undefined,
          };
        }
        const pricing = patientSessionPricingFromRow({
          categoria_valor_sessao: row.categoria_valor_sessao,
          valor_sessao_personalizado_centavos: row.valor_sessao_personalizado_centavos,
        });
        return pricing.category === 'personalizado' && pricing.customAmountCents
          ? { custeadoPelaEmpresa: false, valorPersonalizadoCentavos: pricing.customAmountCents }
          : { custeadoPelaEmpresa: false };
      }
    }

    const convenioNome = lead.convenioSelecionado?.trim();
    if (convenioNome && convenioNome.toLocaleLowerCase('pt-BR') !== 'nenhum') {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT nome, empresa_paga_sessoes
           FROM clinica_convenios
          WHERE instituicao_id = ? AND ativo = 1 AND LOWER(TRIM(nome)) = LOWER(TRIM(?))
          LIMIT 1`,
        [instituicaoId(), convenioNome]
      );
      const row = rows[0];
      if (row && Boolean(row.empresa_paga_sessoes)) {
        return { custeadoPelaEmpresa: true, convenioNome: String(row.nome) };
      }
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Orientações enviadas quando o psicólogo aceita o paciente (especificação
 * final, 5.03, 7.02, 9.01, 10.02 e 12.01): próximos passos e prazo para o
 * contato do psicólogo, adaptados ao pagador e ao preço efetivo.
 * Não anuncia sessão marcada — o horário ainda será combinado (12.01).
 */
export function textoParaPaciente(
  lead: TriagemPacienteRecord,
  opcoes?: OpcoesPagamentoPaciente
): string {
  const nomePaciente = lead.nomeSocial?.trim() || lead.nomePaciente?.trim() || 'Paciente';
  // Criança ou adolescente: a mensagem é do responsável e fala do menor (6.03).
  const responsavel = responsavelDoPrimeiroContato(lead);
  const saudacao = responsavel
    ? [`Olá, ${responsavel.nome}! 💜`, `Esta mensagem é sobre o atendimento de ${nomePaciente}, de quem você é responsável.`]
    : [`Olá, ${nomePaciente}! 💜`];
  const { servico, modalidadeRotulo, valor } = resolverPrecoEModalidade(lead);
  const custeado = opcoes?.custeadoPelaEmpresa === true;
  const valorPersonalizado =
    !custeado && Number.isSafeInteger(opcoes?.valorPersonalizadoCentavos) && (opcoes?.valorPersonalizadoCentavos ?? 0) > 0
      ? formatarReaisCentavos(opcoes!.valorPersonalizadoCentavos!)
      : undefined;

  const blocoPagamento = custeado
    ? [
        '🏢 Atendimento por convênio',
        '',
        opcoes?.convenioNome
          ? `Seu atendimento está vinculado ao convênio ${opcoes.convenioNome} e é custeado pela empresa conforme as condições do contrato, sem envio de link de cobrança individual para as sessões cobertas.`
          : 'Seu atendimento é custeado pelo convênio empresarial conforme as condições do contrato, sem envio de link de cobrança individual para as sessões cobertas.',
        '',
        'Caso alguma sessão fique fora da cobertura ou da cota contratada, você será informado(a) previamente antes de qualquer cobrança individual.',
      ]
    : [
        '💳 Pagamento da consulta',
        '',
        'O pagamento é realizado diretamente à Viver Mais Psicologia, via PIX ou cartão de crédito.',
        '',
        'O(a) psicólogo(a) enviará o link de pagamento para você. Ao acessá-lo, encontrará os dados da clínica para conferência:',
        '',
        'Nome: Viviane Oliveira de Almeida Jeremias e Cia LTDA',
        'Nome comercial: Viver Mais Psicologia',
        '',
        valorPersonalizado
          ? `O valor acordado para ${servico} é de ${valorPersonalizado} por sessão.`
          : `O valor para ${servico} ${modalidadeRotulo} é de ${valor} por sessão.`,
      ];

  return [
    ...saudacao,
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
    ...blocoPagamento,
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

export async function avisarConfirmacaoPaciente(
  lead: TriagemPacienteRecord,
  opcoes?: OpcoesPagamentoPaciente
): Promise<ResultadoEnvio> {
  const pagamento = opcoes ?? (await resolverPagamentoPaciente(lead));
  return enviarTexto(
    responsavelDoPrimeiroContato(lead)?.telefone || lead.telefone,
    textoParaPaciente(lead, pagamento),
    'confirmacao_triagem_paciente',
    `confirmacao-paciente:${lead.id}`
  );
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
  motivo: 'sla_vencido' | 'encaminhamento_voluntario' | 'reatribuicao_gestao' | 'limite_atingido' = 'sla_vencido'
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
  // telefone do paciente.
  const destinatarios = (process.env.WHATSAPP_COORDINATION_NUMBERS ?? '')
    .split(',')
    .map((numero) => numero.trim())
    .filter(Boolean);
  const anterior = psicologoAnteriorNome?.trim() || 'profissional anterior';
  const textoCoordenacao = [
    {
      sla_vencido: 'Alerta operacional — prazo para o primeiro contato vencido.',
      encaminhamento_voluntario: 'Alerta operacional — profissional respondeu ENCAMINHAR.',
      reatribuicao_gestao: 'Alerta operacional — paciente encaminhado pela gestão para um novo responsável.',
      limite_atingido: 'Solicitação oferecida a outro profissional porque a última vaga foi ocupada.',
    }[motivo],
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
