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
  psicologoIgnoradoId?: string,
  servicoDesejado?: string
): PsicologoPerfil | null {
  // Filtrar psicólogos ativos, que atendam o turno, modalidade e serviço específico
  const elegiveis = psicologos.filter((p) => {
    if (psicologoIgnoradoId && p.id === psicologoIgnoradoId) return false;
    if (!p.exibirNaVitrine) return false;
    if (p.pacientesAtivosCount >= p.limitePacientesAtivos) return false;
    if (!p.turnosDisponiveis.includes(turnoDesejado)) return false;
    if (!p.modalidadesAtendidas.includes(modalidadeDesejada)) return false;
    if (servicoDesejado && p.servicosHabilitados && p.servicosHabilitados.length > 0) {
      if (!p.servicosHabilitados.includes(servicoDesejado)) return false;
    }
    return true;
  });

  if (elegiveis.length === 0) return null;

  // Ordena por menor data de último lead recebido (rodízio circular mais justo).
  //
  // Quem nunca recebeu ninguém vem primeiro — sem isso, o profissional recém
  // aprovado nunca entraria na roda. A ausência de data vira `0` (epoch), que
  // é anterior a qualquer recebimento real, em vez de um retorno direto de
  // -1/1: um comparador que responde "a vem antes de b" e "b vem antes de a"
  // para o mesmo par (o caso de ambos sem data) não é consistente, e a ordem
  // final passa a depender do algoritmo de ordenação em vez da regra.
  const ultimoRecebimentoMs = (psicologo: PsicologoPerfil): number => {
    if (!psicologo.ultimoLeadRecebidoEm) return 0;
    const ms = new Date(psicologo.ultimoLeadRecebidoEm).getTime();
    // Data ilegível é tratada como ausente: `NaN` no comparador embaralharia a
    // fila inteira, não só a linha com o defeito.
    return Number.isFinite(ms) ? ms : 0;
  };

  // `sort` é estável, então empate preserva a ordem de cadastro.
  elegiveis.sort((a, b) => ultimoRecebimentoMs(a) - ultimoRecebimentoMs(b));

  return elegiveis[0];
}

/**
 * Processa um novo lead atribuindo ao psicólogo da vez via Round-Robin.
 */
export function processarTriagemLead(
  lead: LeadTriagem,
  psicologos: PsicologoPerfil[],
  servicoDesejado?: string
): MatchingResult {
  const selecionado = selecionarPsicologoRoundRobin(
    psicologos,
    lead.turno,
    lead.modalidade,
    undefined,
    servicoDesejado
  );

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
  tempoLimiteHoras = 24,
  opcoes: { servicoDesejado?: string; psicologosJaTentados?: readonly string[] } = {}
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

  // Transbordo: buscar o próximo psicólogo ignorando o atual, que estourou o
  // SLA, e todos os que já tiveram a chance neste mesmo lead.
  const jaTentados = opcoes.psicologosJaTentados ?? [];
  const candidatos = psicologos.filter((p) => !jaTentados.includes(p.id));

  const novoPsicologo = selecionarPsicologoRoundRobin(
    candidatos,
    lead.turno,
    lead.modalidade,
    lead.psicologoAlocadoId,
    opcoes.servicoDesejado
  );

  const agoraIso = new Date().toISOString();

  if (!novoPsicologo) {
    // Sem ninguém para receber, o lead **continua aguardando contato** com o
    // profissional atual, marcado como estourado. Movê-lo para `TRANSBORDADO`
    // aqui diria que alguém assumiu quando ninguém assumiu, e o tiraria da
    // varredura — a pessoa ficaria esquecida numa fila que ninguém relê.
    return {
      sucesso: false,
      leadAtualizado: {
        ...lead,
        slaExpirado: true,
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
