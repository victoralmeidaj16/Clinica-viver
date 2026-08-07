import 'server-only';

import {
  assertWhatsAppRecipientAllowed,
  RecipientNotAllowedError,
} from '@/server/adapters/whatsappAllowlist';
import { gerarTokenConfirmacao } from '@/server/viverMaisConfirmToken';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import { nomeDeExibicao, SLA_CONTATO_HORAS } from './viverMaisRodizio';

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

export type FinalidadeMensagem = 'alocacao_psicologo' | 'recebimento_paciente';

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
async function enviarTexto(
  telefone: string,
  texto: string,
  finalidade: FinalidadeMensagem,
  chaveDedupe: string
): Promise<ResultadoEnvio> {
  if (jaDisparado.has(chaveDedupe)) {
    return { finalidade, chaveDedupe, situacao: 'enviada' };
  }

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

  const config = evolutionConfig();
  if (!config) {
    console.info(`[whatsapp] Provedor não configurado; "${finalidade}" não foi enviada.`);
    return { finalidade, chaveDedupe, situacao: 'provedor_desconfigurado' };
  }

  try {
    const resposta = await fetch(`${config.url}/message/sendText/${config.instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
      body: JSON.stringify({ number: telefone.replace(/\D/g, ''), text: texto }),
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

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
    'https://app.vivermaispsicologia.com.br'
  );
}

function linkConfirmacao(lead: TriagemPacienteRecord, psicologoId: string): string {
  const token = gerarTokenConfirmacao(lead.id, psicologoId);
  return `${baseUrl()}/confirmar-contato/${lead.id}?psi=${encodeURIComponent(psicologoId)}&t=${token}`;
}

/** Mensagem ao profissional que recebeu o lead. */
export function textoParaPsicologo(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord
): string {
  const linhas = [
    `Olá, ${nomeDeExibicao(psicologo)}! Você recebeu um novo paciente pela Viver Mais.`,
    '',
    `Paciente: ${lead.nomePaciente}`,
    `WhatsApp: ${lead.telefone}`,
    `Serviço: ${lead.servico || 'Não informado'}`,
    `Turno de preferência: ${lead.turno}`,
    `Protocolo: ${lead.protocolo}`,
    '',
    `O primeiro contato precisa ser feito em até ${SLA_CONTATO_HORAS}h. Depois de falar com a pessoa, confirme aqui:`,
    linkConfirmacao(lead, psicologo.id),
    '',
    'Sem a confirmação dentro do prazo, o paciente é encaminhado ao próximo profissional da fila.',
  ];
  return linhas.join('\n');
}

/**
 * Mensagem ao paciente.
 *
 * Curta de propósito. Ela existe para a pessoa saber que não caiu no vazio e
 * quanto tempo esperar — não para adiantar nada sobre o atendimento.
 */
export function textoParaPaciente(lead: TriagemPacienteRecord): string {
  return [
    `Olá, ${lead.nomePaciente}! Recebemos sua solicitação de atendimento na Viver Mais Psicologia.`,
    '',
    `Protocolo: ${lead.protocolo}`,
    '',
    `Um de nossos psicólogos entra em contato com você em até ${SLA_CONTATO_HORAS} horas para combinar o dia e o horário.`,
  ].join('\n');
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
 * Aviso de transbordo: só o novo profissional é notificado.
 *
 * O paciente não recebe nada aqui. Troca de profissional antes do primeiro
 * contato é rearranjo interno de fila; contar isso a quem está esperando
 * ajuda em nada e comunica desorganização onde houve, na verdade, a regra
 * funcionando.
 */
export async function avisarTransbordo(
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
