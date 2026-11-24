import {
  FormatoAtendimento,
  LeadTriagem,
  PsicologoPerfil,
  ModalidadeAtendimento,
  PreferenciaFormatoAtendimento,
  PreferenciaGeneroPsicologo,
  TurnoAtendimento,
} from './viverMaisTypes';
import { publicoAlvoCompativel } from './viverMaisAudience';
export { normalizarPublicoAlvo } from './viverMaisAudience';

export interface MatchingResult {
  sucesso: boolean;
  leadAtualizado: LeadTriagem;
  psicologoAlocado?: PsicologoPerfil;
  mensagem: string;
}

/** Recortes opcionais da fila, além do turno e da modalidade. */
export interface CriteriosSelecao {
  /** Quem não pode receber este lead — o profissional que estourou o SLA. */
  psicologoIgnoradoId?: string;
  servicoDesejado?: string;
  paraQuemE?: string;
  necessidadesDesejadas?: readonly string[];
  formatoDesejado?: PreferenciaFormatoAtendimento;
  abordagemDesejada?: string;
  duracaoDesejadaMinutos?: number;
  ignorarCapacidade?: boolean;
  /**
   * Gênero pedido pelo paciente. `SEM_PREFERENCIA` (ou ausente) mantém a fila
   * inteira.
   */
  preferenciaGeneroPsicologo?: PreferenciaGeneroPsicologo;
  /**
   * Sorteio do desempate absoluto: recebe a quantidade de empatados e devolve
   * o índice escolhido. Injetável para teste; o padrão é `Math.random`.
   */
  sortear?: (quantidade: number) => number;
}

function normalizarTexto(valor?: string): string {
  return (valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarFormatoAtendimento(
  valor?: string
): FormatoAtendimento | 'INDIFERENTE' | undefined {
  const limpo = normalizarTexto(valor);
  if (!limpo) return undefined;
  if (
    limpo === 'ambos' ||
    limpo === 'hibrido' ||
    limpo === 'online e presencial' ||
    limpo === 'online_e_presencial'
  ) {
    return 'AMBOS';
  }
  if (limpo === 'online' || limpo === 'on-line' || limpo === 'remoto') return 'ONLINE';
  if (limpo === 'presencial') return 'PRESENCIAL';
  if (limpo === 'indiferente' || limpo === 'sem preferencia' || limpo === 'sem_preferencia') {
    return 'INDIFERENTE';
  }
  return undefined;
}

function expandirAliasesAbordagem(valor: string): string[] {
  const base = normalizarTexto(valor);
  if (!base) return [];
  const aliases = new Set<string>([base]);
  if (
    base === 'tcc' ||
    /\btcc\b/.test(base) ||
    base.includes('cognitivo-comportamental') ||
    base.includes('cognitivo comportamental')
  ) {
    aliases.add('tcc');
    aliases.add('terapia cognitivo-comportamental');
    aliases.add('terapias cognitivo-comportamentais');
    aliases.add('cognitivo-comportamental');
  }
  return [...aliases];
}

function abordagemCompativel(
  p: Pick<PsicologoPerfil, 'abordagem' | 'posGraduacaoViverMais' | 'outrasPosGraduacoes'>,
  abordagemDesejada?: string
): boolean {
  const alvoBruto = normalizarTexto(abordagemDesejada);
  if (!alvoBruto || alvoBruto === 'indiferente' || alvoBruto === 'sem preferencia' || alvoBruto === 'sem_preferencia') {
    return true;
  }
  const candidatos = [p.abordagem, p.posGraduacaoViverMais, ...(p.outrasPosGraduacoes ?? [])]
    .flatMap((item) => (item ? expandirAliasesAbordagem(item) : []));
  if (candidatos.length === 0) return false;
  const alvos = expandirAliasesAbordagem(alvoBruto);
  return candidatos.some((cand) => alvos.some((alvo) => cand === alvo || cand.includes(alvo) || alvo.includes(cand)));
}

export function duracaoEsperadaDaDemanda(
  servicoDesejado?: string,
  paraQuemE?: string,
  duracaoExplicita?: number
): number | undefined {
  if (duracaoExplicita === 50 || duracaoExplicita === 90) return duracaoExplicita;
  if (servicoDesejado === 'AVALIACAO') return undefined;
  const publico = normalizarTexto(paraQuemE);
  if (servicoDesejado === 'PSICOTERAPIA_CASAL' || /\b(casal|casais|familia|grupo)\b/.test(publico)) {
    return 90;
  }
  if (
    servicoDesejado === 'PSICOTERAPIA' ||
    servicoDesejado === 'ORIENTACAO_PARENTAL' ||
    servicoDesejado === 'ORIENTACAO_VOCACIONAL' ||
    servicoDesejado === 'ORIENTACAO_PROFISSIONAL' ||
    servicoDesejado === 'ORIENTACAO_VOCACIONAL_PROFISSIONAL'
  ) {
    return 50;
  }
  return undefined;
}

/** Regra pura compartilhada pela vitrine e pela alocação. */
export function psicologoCompativel(
  p: Pick<
    PsicologoPerfil,
    | 'id'
    | 'pausadoNoRodizio'
    | 'pacientesAtivosCount'
    | 'limitePacientesAtivos'
    | 'turnosDisponiveis'
    | 'modalidadesAtendidas'
    | 'modalidadeAtendimento'
    | 'abordagem'
    | 'posGraduacaoViverMais'
    | 'outrasPosGraduacoes'
    | 'temposAtendimento'
    | 'genero'
    | 'servicosHabilitados'
    | 'publicoAlvo'
    | 'necessidadesAtendidas'
  >,
  turnoDesejado: TurnoAtendimento | readonly TurnoAtendimento[],
  modalidadeDesejada: ModalidadeAtendimento,
  criterios: CriteriosSelecao = {}
): boolean {
  const {
    psicologoIgnoradoId,
    servicoDesejado,
    paraQuemE,
    necessidadesDesejadas,
    formatoDesejado,
    abordagemDesejada,
    duracaoDesejadaMinutos,
    ignorarCapacidade,
    preferenciaGeneroPsicologo,
  } = criterios;

  const turnos = typeof turnoDesejado === 'string' ? [turnoDesejado] : turnoDesejado;

  if (psicologoIgnoradoId && p.id === psicologoIgnoradoId) return false;
  // Quem recebe encaminhamento é decidido só por `pausadoNoRodizio`.
  // `exibirNaVitrine` responde a outra pergunta — se o perfil aparece no site
  // público — e deixou de valer aqui: um profissional pode sair da vitrine e
  // seguir atendendo, ou continuar visível para os próprios pacientes
  // enquanto está de férias.
  //
  // A migração 017 carimbou `pausadoNoRodizio` em todos os que estavam com a
  // vitrine desligada, para que a troca de critério não reativasse ninguém.
  if (p.pausadoNoRodizio) return false;
  if (!ignorarCapacidade && p.pacientesAtivosCount >= p.limitePacientesAtivos) return false;
  if (!turnos.some((turno) => p.turnosDisponiveis.includes(turno))) return false;
  if (!p.modalidadesAtendidas.includes(modalidadeDesejada)) return false;
  const formato = normalizarFormatoAtendimento(formatoDesejado);
  if (formato === 'ONLINE' || formato === 'PRESENCIAL') {
    const formatoPsi = normalizarFormatoAtendimento(p.modalidadeAtendimento);
    if (formatoPsi !== 'AMBOS' && formatoPsi !== formato) return false;
  }
  if (!abordagemCompativel(p, abordagemDesejada)) return false;
  const duracaoNecessaria = duracaoEsperadaDaDemanda(servicoDesejado, paraQuemE, duracaoDesejadaMinutos);
  if (duracaoNecessaria !== undefined && p.temposAtendimento && p.temposAtendimento.length > 0) {
    if (!p.temposAtendimento.includes(duracaoNecessaria)) return false;
  }
  // Preferência de gênero corta a fila em vez de só reordená-la: quem pediu
  // uma psicóloga não deve receber um psicólogo porque era a vez dele. Quem
  // não declarou gênero — ou declarou um que não é masculino nem feminino —
  // sai junto enquanto há preferência declarada, porque não há como afirmar
  // que atende ao pedido. Se isso esvaziar a fila, o lead fica pendente de
  // atribuição para a gestão resolver: preferível a uma indicação que
  // contraria o que a pessoa pediu.
  if (
    preferenciaGeneroPsicologo &&
    preferenciaGeneroPsicologo !== 'SEM_PREFERENCIA' &&
    p.genero !== preferenciaGeneroPsicologo
  ) {
    return false;
  }
  if (servicoDesejado && p.servicosHabilitados && p.servicosHabilitados.length > 0) {
    if (servicoDesejado === 'PSICOTERAPIA_CASAL') {
      if (!p.servicosHabilitados.includes('PSICOTERAPIA') && !p.servicosHabilitados.includes('PSICOTERAPIA_CASAL')) return false;
    } else if (!p.servicosHabilitados.includes(servicoDesejado)) {
      return false;
    }
  }
  if (!publicoAlvoCompativel(p.publicoAlvo, paraQuemE)) return false;
  if (necessidadesDesejadas && necessidadesDesejadas.length > 0 && p.necessidadesAtendidas && p.necessidadesAtendidas.length > 0) {
    const normAtendidas = p.necessidadesAtendidas.map((n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const temCorrespondencia = necessidadesDesejadas.some((nec) => {
      const normNec = nec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normAtendidas.some((a) => a === normNec || a.includes(normNec) || normNec.includes(a));
    });
    if (!temCorrespondencia) return false;
  }
  return true;
}

/**
 * Encontra o próximo psicólogo elegível na fila circular (Round-Robin).
 *
 * Os critérios opcionais vêm num objeto, e não como mais uma posição na lista
 * de argumentos: com sete opcionais em sequência, quem chama passa a contar
 * `undefined`s para alcançar o último, e um deslize aí não vira erro de tipo —
 * vira indicação errada, em silêncio.
 */
export function selecionarPsicologoRoundRobin(
  psicologos: PsicologoPerfil[],
  turnoDesejado: TurnoAtendimento | readonly TurnoAtendimento[],
  modalidadeDesejada: ModalidadeAtendimento,
  criterios: CriteriosSelecao = {}
): PsicologoPerfil | null {
  const elegiveis = psicologos.filter((p) =>
    psicologoCompativel(p, turnoDesejado, modalidadeDesejada, criterios)
  );

  const ordem = ordenarPsicologosRoundRobin(elegiveis);
  const primeiro = ordem[0];
  if (!primeiro) return null;
  // Sorteio só no empate absoluto (especificação 5.01): mesmos ativos e mesmo
  // tempo sem receber. Fora disso, a ordem decide sozinha.
  const empatados = ordem.filter((p) => compararOrdemRodizio(p, primeiro) === 0);
  if (empatados.length === 1) return primeiro;
  const sortear = criterios.sortear ?? ((quantidade: number) => Math.floor(Math.random() * quantidade));
  const indice = sortear(empatados.length);
  return empatados[Number.isInteger(indice) && indice >= 0 && indice < empatados.length ? indice : 0];
}

/**
 * Quem está há mais tempo sem receber. Quem nunca recebeu ninguém vale `0`
 * (epoch), anterior a qualquer recebimento real — sem isso, o profissional
 * recém-aprovado nunca entraria na roda. Data ilegível é tratada como ausente:
 * `NaN` no comparador embaralharia a fila inteira, não só a linha com defeito.
 */
function ultimoRecebimentoMs(psicologo: PsicologoPerfil): number {
  if (!psicologo.ultimoLeadRecebidoEm) return 0;
  const ms = new Date(psicologo.ultimoLeadRecebidoEm).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Ordem do rodízio (especificação 5.01): menos pacientes ativos primeiro — o
 * que põe quem tem zero à frente —, e no empate quem está há mais tempo sem
 * receber encaminhamento.
 */
export function compararOrdemRodizio(a: PsicologoPerfil, b: PsicologoPerfil): number {
  return (a.pacientesAtivosCount - b.pacientesAtivosCount)
    || (ultimoRecebimentoMs(a) - ultimoRecebimentoMs(b));
}

/**
 * Ordem geral do rodízio, compartilhada com a consulta da gestão. É
 * determinística (`sort` estável: empate absoluto preserva a ordem de
 * cadastro) para a posição exibida não mudar a cada leitura; o sorteio do
 * empate absoluto acontece só na alocação, em `selecionarPsicologoRoundRobin`.
 */
export function ordenarPsicologosRoundRobin(psicologos: readonly PsicologoPerfil[]): PsicologoPerfil[] {
  return [...psicologos].sort(compararOrdemRodizio);
}

/**
 * Processa um novo lead atribuindo ao psicólogo da vez via Round-Robin.
 */
export function processarTriagemLead(
  lead: LeadTriagem,
  psicologos: PsicologoPerfil[],
  servicoDesejado?: string
): MatchingResult {
  const selecionado = selecionarPsicologoRoundRobin(psicologos, lead.turno, lead.modalidade, {
    servicoDesejado,
    paraQuemE: lead.paraQuemE,
    necessidadesDesejadas: lead.necessidadesPaciente,
    formatoDesejado: lead.formatoAtendimento,
    abordagemDesejada: lead.abordagemDesejada,
    duracaoDesejadaMinutos: lead.duracaoDesejadaMinutos,
    preferenciaGeneroPsicologo: lead.preferenciaGeneroPsicologo,
  });

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

  const novoPsicologo = selecionarPsicologoRoundRobin(candidatos, lead.turno, lead.modalidade, {
    psicologoIgnoradoId: lead.psicologoAlocadoId,
    servicoDesejado: opcoes.servicoDesejado,
    paraQuemE: lead.paraQuemE,
    necessidadesDesejadas: lead.necessidadesPaciente,
    formatoDesejado: lead.formatoAtendimento,
    abordagemDesejada: lead.abordagemDesejada,
    duracaoDesejadaMinutos: lead.duracaoDesejadaMinutos,
    // O transbordo herda a preferência: um pedido que valeu na indicação
    // original não pode se perder só porque o prazo estourou.
    preferenciaGeneroPsicologo: lead.preferenciaGeneroPsicologo,
  });

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
