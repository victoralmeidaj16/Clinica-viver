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
import { modeloPadrao } from '@/lib/avisos/catalogo';
import { renderizarModelo, type ValoresDoModelo } from '@/lib/avisos/modelo';
import { prepararAviso, registrarResultadoDoAviso, type OpcoesDoAviso } from '@/server/communication/avisoEnvio';

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
  | 'confirmacao_triagem_paciente'
  | 'aviso_saida_turma'
  | 'aceite_sem_agendamento_gestao'
  | 'lembrete_sessao_paciente';

export interface ResultadoEnvio {
  finalidade: FinalidadeMensagem;
  chaveDedupe: string;
  /**
   * `canal_desligado`: a Gestão escolheu outro canal para este aviso (12.01)
   * ou o aviso é complementar e está desativado (12.02).
   */
  situacao: 'enviada' | 'bloqueada_allowlist' | 'provedor_desconfigurado' | 'falha' | 'canal_desligado';
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
 *
 * `texto` é a mensagem montada com o modelo padrão. Com `opcoes.variaveis`, a
 * versão gravada pela Gestão substitui o padrão (12.02); o canal escolhido
 * por ela decide se o WhatsApp sai (12.01). Todo resultado fica no registro
 * de envios (12.04), inclusive bloqueios e falhas.
 */
export async function enviarTexto(
  telefone: string,
  texto: string,
  finalidade: FinalidadeMensagem,
  chaveDedupe: string,
  autorizadoPelaGestao = false,
  opcoes: OpcoesDoAviso = {}
): Promise<ResultadoEnvio> {
  const aviso = await prepararAviso(finalidade, texto, opcoes);
  const resultado = await entregarTexto(telefone, aviso.texto, finalidade, chaveDedupe, autorizadoPelaGestao, aviso.desligado);
  await registrarResultadoDoAviso({ finalidade, chaveDedupe, telefone, texto: aviso.texto,
    versao: aviso.versao, situacao: resultado.situacao, reenvioSeguro: resultado.reenvioSeguro, opcoes });
  return resultado;
}

async function entregarTexto(
  telefone: string,
  texto: string,
  finalidade: FinalidadeMensagem,
  chaveDedupe: string,
  autorizadoPelaGestao: boolean,
  desligado: boolean
): Promise<ResultadoEnvio> {
  if (desligado) {
    console.info(`[whatsapp] "${finalidade}" não sai por WhatsApp: canal ou ativação definidos pela Gestão.`);
    return { finalidade, chaveDedupe, situacao: 'canal_desligado' };
  }
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

function variaveisBoasVindas(psicologo: CadastroPsicologoRecord, activationUrl: string): ValoresDoModelo {
  return {
    nome_profissional: psicologo.nomeSocial?.trim() || psicologo.nomeCompleto.trim(),
    login: psicologo.email,
    link_ativacao: activationUrl,
  };
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
  const variaveis = variaveisBoasVindas(psicologo, activationUrl);
  return enviarTexto(
    psicologo.whatsapp,
    renderizarModelo(modeloPadrao('boas_vindas_psicologo'), variaveis),
    'boas_vindas_psicologo',
    `boas-vindas:${psicologo.id}${tentativaId ? `:${tentativaId}` : ''}`,
    true,
    { variaveis, referencia: `cadastro:${psicologo.id}` }
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
export function variaveisParaPsicologo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord
): ValoresDoModelo {
  // Pedido para profissional específico: recusa e silêncio vão para a
  // coordenação, nunca para o rodízio (especificação final, 4.05 e 5.04).
  const direto = lead.tipoAlocacao === 'ESCOLHA_DIRETA';
  return {
    nome_profissional: nomeDeExibicao(psicologo),
    aviso_escolha_direta: direto ? 'O paciente escolheu você na vitrine.' : '',
    dados_paciente: dadosDoPaciente(lead).join('\n'),
    instrucao_recusa: direto
      ? '➡️ Se não desejar atender, poderá recusar pelo mesmo link, e a coordenação da clínica decidirá o encaminhamento.'
      : '➡️ Se não desejar atender, poderá selecionar a opção de encaminhar o paciente ao próximo profissional da fila que atenda aos critérios.',
    link_decisao: linkConfirmacao(lead, psicologo.id),
    prazo_resposta: rotuloPrazo(prazoDaOferta(lead)),
    consequencia_sem_resposta: direto
      ? 'a solicitação seguirá para a coordenação da clínica'
      : 'o paciente será encaminhado automaticamente ao próximo profissional da fila',
  };
}

export function textoParaPsicologo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord
): string {
  return renderizarModelo(modeloPadrao('alocacao_psicologo'), variaveisParaPsicologo(lead, psicologo));
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
  return renderizarModelo(modeloPadrao('recebimento_paciente'), {});
}

function nomeDoPaciente(lead: TriagemPacienteRecord): string {
  return lead.nomeSocial?.trim() || lead.nomePaciente?.trim() || 'Paciente';
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
export function variaveisParaPaciente(
  lead: TriagemPacienteRecord,
  opcoes?: OpcoesPagamentoPaciente
): ValoresDoModelo {
  const nomePaciente = nomeDoPaciente(lead);
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

  return {
    nome_paciente: nomePaciente,
    saudacao: saudacao.join('\n'),
    servico,
    orientacoes_pagamento: blocoPagamento.join('\n'),
  };
}

export function textoParaPaciente(
  lead: TriagemPacienteRecord,
  opcoes?: OpcoesPagamentoPaciente
): string {
  return renderizarModelo(modeloPadrao('confirmacao_triagem_paciente'), variaveisParaPaciente(lead, opcoes));
}

export async function avisarRecebimentoPaciente(lead: TriagemPacienteRecord): Promise<ResultadoEnvio> {
  return enviarTexto(lead.telefone, textoRecebimentoPaciente(), 'recebimento_paciente', `recebimento:${lead.id}`,
    false, { variaveis: { nome_paciente: nomeDoPaciente(lead) }, referencia: `protocolo:${lead.protocolo}` });
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
    `confirmacao-paciente:${lead.id}`,
    false,
    { variaveis: variaveisParaPaciente(lead, pagamento), referencia: `protocolo:${lead.protocolo}` }
  );
}

/** Aviso operacional para os números da coordenação, se houver algum configurado. */
export async function avisarCoordenacao(
  texto: string,
  chaveDedupe: string,
  finalidade: FinalidadeMensagem = 'alerta_coordenacao',
  opcoes: OpcoesDoAviso = {}
): Promise<ResultadoEnvio[]> {
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
        finalidade,
        `${chaveDedupe}:${destinatario.replace(/\D/g, '')}`,
        false,
        opcoes
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
      `alocacao:${lead.id}:${psicologo.id}`,
      false,
      { variaveis: variaveisParaPsicologo(lead, psicologo), referencia: `protocolo:${lead.protocolo}` }
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
      `alocacao:${lead.id}:${psicologo.id}`,
      false,
      { variaveis: variaveisParaPsicologo(lead, psicologo), referencia: `protocolo:${lead.protocolo}` }
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
        `alerta-transbordo:${lead.id}:${psicologo.id}:${destinatario.replace(/\D/g, '')}`,
        false,
        { referencia: `protocolo:${lead.protocolo}` }
      )
    );
  }

  return resultados;
}
