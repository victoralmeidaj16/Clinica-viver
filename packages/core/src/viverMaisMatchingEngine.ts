import { LeadTriagem, PsicologoPerfil, ModalidadeAtendimento, TurnoAtendimento } from './viverMaisTypes';

export interface MatchingResult {
  sucesso: boolean;
  leadAtualizado: LeadTriagem;
  psicologoAlocado?: PsicologoPerfil;
  mensagem: string;
}

/**
 * Encontra o próximo psicólogo elegível na fila circular (Round-Robin).
 */
export function selecionarPsicologoRoundRobin(
  psicologos: PsicologoPerfil[],
  turnoDesejado: TurnoAtendimento,
  modalidadeDesejada: ModalidadeAtendimento,
  psicologoIgnoradoId?: string
): PsicologoPerfil | null {
  // Filtrar psicólogos ativos, que atendam o turno e modalidade, e com capacidade livre (< 33)
  const elegiveis = psicologos.filter((p) => {
    if (psicologoIgnoradoId && p.id === psicologoIgnoradoId) return false;
    if (!p.exibirNaVitrine) return false;
    if (p.pacientesAtivosCount >= p.limitePacientesAtivos) return false;
    if (!p.turnosDisponiveis.includes(turnoDesejado)) return false;
    if (!p.modalidadesAtendidas.includes(modalidadeDesejada)) return false;
    return true;
  });

  if (elegiveis.length === 0) return null;

  // Ordena por menor data de último lead recebido (rodízio circular mais justo)
  elegiveis.sort((a, b) => {
    if (!a.ultimoLeadRecebidoEm) return -1;
    if (!b.ultimoLeadRecebidoEm) return 1;
    return new Date(a.ultimoLeadRecebidoEm).getTime() - new Date(b.ultimoLeadRecebidoEm).getTime();
  });

  return elegiveis[0];
}

/**
 * Processa um novo lead atribuindo ao psicólogo da vez via Round-Robin.
 */
export function processarTriagemLead(
  lead: LeadTriagem,
  psicologos: PsicologoPerfil[]
): MatchingResult {
  const selecionado = selecionarPsicologoRoundRobin(psicologos, lead.turno, lead.modalidade);

  if (!selecionado) {
    return {
      sucesso: false,
      leadAtualizado: {
        ...lead,
        status: 'AGUARDANDO_CONTATO',
        slaExpirado: false,
      },
      mensagem: 'Nenhum psicólogo disponível no momento para os critérios selecionados.',
    };
  }

  const agoraIso = new Date().toISOString();

  return {
    sucesso: true,
    leadAtualizado: {
      ...lead,
      psicologoAlocadoId: selecionado.id,
      dataAlocacao: agoraIso,
      status: 'AGUARDANDO_CONTATO',
      slaExpirado: false,
    },
    psicologoAlocado: {
      ...selecionado,
      ultimoLeadRecebidoEm: agoraIso,
      pacientesAtivosCount: selecionado.pacientesAtivosCount + 1,
    },
    mensagem: `Lead alocado com sucesso para o psicólogo ${selecionado.nome}.`,
  };
}

/**
 * Checa SLA de 24h e executa transbordo automático se estourar o tempo.
 */
export function checarEExecutarTransbordoSla(
  lead: LeadTriagem,
  psicologos: PsicologoPerfil[],
  tempoLimiteHoras = 24
): MatchingResult {
  if (lead.status !== 'AGUARDANDO_CONTATO' || !lead.dataAlocacao) {
    return {
      sucesso: false,
      leadAtualizado: lead,
      mensagem: 'Lead não está aguardando contato ou não possui data de alocação.',
    };
  }

  const inicioMs = new Date(lead.dataAlocacao).getTime();
  const agoraMs = Date.now();
  const horasDecorridas = (agoraMs - inicioMs) / (1000 * 60 * 60);

  if (horasDecorridas < tempoLimiteHoras) {
    return {
      sucesso: false,
      leadAtualizado: lead,
      mensagem: `SLA dentro do prazo (${horasDecorridas.toFixed(1)}h decorridas).`,
    };
  }

  // Transbordo: Buscar próximo psicólogo ignorando o atual que estourou o SLA
  const novoPsicologo = selecionarPsicologoRoundRobin(
    psicologos,
    lead.turno,
    lead.modalidade,
    lead.psicologoAlocadoId
  );

  const agoraIso = new Date().toISOString();

  if (!novoPsicologo) {
    return {
      sucesso: false,
      leadAtualizado: {
        ...lead,
        slaExpirado: true,
        status: 'TRANSBORDADO',
      },
      mensagem: 'SLA expirado em 24h. Fila sem outro psicólogo disponível para transbordo automático.',
    };
  }

  return {
    sucesso: true,
    leadAtualizado: {
      ...lead,
      psicologoAlocadoId: novoPsicologo.id,
      dataAlocacao: agoraIso,
      status: 'AGUARDANDO_CONTATO',
      slaExpirado: true,
    },
    psicologoAlocado: {
      ...novoPsicologo,
      ultimoLeadRecebidoEm: agoraIso,
      pacientesAtivosCount: novoPsicologo.pacientesAtivosCount + 1,
    },
    mensagem: `Transbordo de 24h executado com sucesso para ${novoPsicologo.nome}.`,
  };
}

/**
 * Confirma contato efetuado pelo psicólogo (via WhatsApp ou Portal Web).
 */
export function confirmarContatoPsicologo(lead: LeadTriagem): LeadTriagem {
  return {
    ...lead,
    status: 'CONTATO_CONFIRMADO',
    confirmadoPeloPsicologoEm: new Date().toISOString(),
  };
}
