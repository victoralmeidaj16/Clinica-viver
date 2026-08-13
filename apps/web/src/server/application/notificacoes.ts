import 'server-only';

import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import type { CaptureState } from '@/server/persistence/captureRepository';
import {
  classificarSla,
  horasDesdeAlocacao,
  nomeDeExibicao,
  normalizarTurno,
  SLA_CONTATO_HORAS,
} from './viverMaisRodizio';

/**
 * As notificações do sino, derivadas do estado real da operação.
 *
 * Nenhuma delas é gravada quando o evento acontece: elas são calculadas da fila
 * de triagem e do credenciamento a cada leitura. A escolha é deliberada. Um
 * aviso persistido envelhece sozinho — continuaria dizendo "paciente aguardando
 * contato" depois de o contato ter sido confirmado, e "SLA em risco" depois de o
 * prazo ter estourado —, e corrigir isso exigiria pendurar uma escrita de aviso
 * em cada um dos caminhos que mexem na fila (vitrine, varredura de SLA, resposta
 * no WhatsApp, reatribuição da gestão). Derivar custa uma leitura e não pode
 * divergir do que o cockpit mostra ao lado.
 *
 * O que se persiste é só a marca de leitura, por `chave` — ver
 * `persistence/notificacoesLeituras.ts`.
 *
 * A `chave` carrega o instante do evento que originou o aviso. É o que faz um
 * novo repasse do mesmo paciente voltar a aparecer como não lido, em vez de ser
 * silenciado pela leitura do repasse anterior.
 */

export type SeveridadeNotificacao = 'INFO' | 'ATENCAO' | 'CRITICO';

export interface NotificacaoDerivada {
  chave: string;
  tipo: string;
  titulo: string;
  descricao: string;
  /** ISO do evento que originou o aviso. Ordena a lista. */
  ocorridoEm: string;
  severidade: SeveridadeNotificacao;
  /** Para onde o clique leva. */
  href: string;
  /**
   * Situação ainda aberta (paciente sem contato, credenciamento na fila).
   * Escapa da janela de retenção: o que continua exigindo ação não some da
   * lista só por ser antigo.
   */
  pendente: boolean;
}

export interface NotificacaoVisivel extends NotificacaoDerivada {
  lida: boolean;
}

/** Eventos encerrados mais antigos do que isto saem da lista. */
const JANELA_RETENCAO_DIAS = 30;

/** Teto de itens devolvidos, do mais recente para o mais antigo. */
const LIMITE_ITENS = 40;

const DIA_MS = 24 * 60 * 60 * 1000;

/** O turno como a pessoa fala, não como o formulário grava. */
function rotuloTurno(turno: string | undefined): string {
  switch (normalizarTurno(turno)) {
    case 'MANHA':
      return 'manhã';
    case 'TARDE':
      return 'tarde';
    case 'NOITE':
      return 'noite';
    default:
      return turno?.toLocaleLowerCase('pt-BR') || 'turno não informado';
  }
}

/** Quanto ainda resta do prazo de primeiro contato, em texto curto. */
function prazoRestante(alocadoEm: string | undefined, agora: Date): string {
  const horas = horasDesdeAlocacao(alocadoEm, agora);
  if (horas === null) return 'sem prazo registrado';
  const restantes = SLA_CONTATO_HORAS - horas;
  if (restantes <= -1) return `prazo vencido há ${Math.floor(-restantes)} h`;
  if (restantes <= 0) return 'prazo vencido';
  if (restantes < 1) return `restam ${Math.max(1, Math.round(restantes * 60))} min`;
  return `restam ${Math.floor(restantes)} h`;
}

function severidadePorSla(alocadoEm: string | undefined, agora: Date): SeveridadeNotificacao {
  switch (classificarSla(alocadoEm, agora)) {
    case 'VERMELHO':
      return 'CRITICO';
    case 'AMARELO':
      return 'ATENCAO';
    default:
      return 'INFO';
  }
}

function resumoDoLead(lead: TriagemPacienteRecord): string {
  const partes = [lead.servico?.trim(), `turno da ${rotuloTurno(lead.turno)}`].filter(Boolean);
  return partes.join(' · ');
}

/**
 * Quem tinha o paciente imediatamente antes do profissional atual.
 *
 * `psicologosJaTentados` é gravado na ordem das tentativas e termina em quem
 * está com o lead agora, então o penúltimo é quem acabou de perdê-lo. Ler a
 * lista inteira avisaria todo mundo que já passou pelo caso — inclusive quem
 * saiu dele há três repasses.
 */
function psicologoAnterior(lead: TriagemPacienteRecord): string | undefined {
  const tentados = lead.psicologosJaTentados ?? [];
  if (tentados.length < 2) return undefined;
  const ultimo = tentados[tentados.length - 1];
  if (ultimo !== lead.psicologoAlocadoId) return undefined;
  return tentados[tentados.length - 2];
}

// ---------------------------------------------------------------------------
// Psicólogo
// ---------------------------------------------------------------------------

/**
 * O que o profissional precisa saber ao abrir o sistema.
 *
 * Só o que é dele: os pacientes na sua fila, os que saíram dela e o estado do
 * próprio credenciamento. Nada da fila geral da clínica — o sino não é uma
 * segunda porta para dados de pacientes de outras pessoas.
 */
export function notificacoesDoPsicologo(
  state: CaptureState,
  cadastro: CadastroPsicologoRecord,
  agora: Date = new Date()
): NotificacaoDerivada[] {
  const itens: NotificacaoDerivada[] = [];

  for (const lead of state.triagensPacientes) {
    const meu = lead.psicologoAlocadoId === cadastro.id;

    if (meu && lead.status === 'AGUARDANDO_CONTATO' && lead.alocadoEm) {
      const repassado = (lead.transbordos ?? 0) > 0;
      itens.push({
        chave: `paciente-atribuido:${lead.id}:${lead.alocadoEm}`,
        tipo: 'paciente-atribuido',
        titulo: repassado ? 'Paciente repassado para você' : 'Novo paciente para contatar',
        descricao: `${lead.nomePaciente} — ${resumoDoLead(lead)}. Primeiro contato em até ${SLA_CONTATO_HORAS} h (${prazoRestante(lead.alocadoEm, agora)}).`,
        ocorridoEm: lead.alocadoEm,
        severidade: severidadePorSla(lead.alocadoEm, agora),
        href: '/cockpit',
        pendente: true,
      });
      continue;
    }

    if (meu && lead.status === 'CONTATO_CONFIRMADO' && lead.confirmadoEm) {
      itens.push({
        chave: `contato-confirmado:${lead.id}:${lead.confirmadoEm}`,
        tipo: 'contato-confirmado',
        titulo: 'Primeiro contato confirmado',
        descricao: `${lead.nomePaciente} entrou na sua lista de pacientes ativos.`,
        ocorridoEm: lead.confirmadoEm,
        severidade: 'INFO',
        href: '/pacientes',
        pendente: false,
      });
      continue;
    }

    if (!meu && psicologoAnterior(lead) === cadastro.id && lead.alocadoEm) {
      itens.push({
        chave: `paciente-repassado:${lead.id}:${lead.alocadoEm}`,
        tipo: 'paciente-repassado',
        titulo: 'Paciente saiu da sua fila',
        descricao: lead.slaExpirado
          ? `${lead.nomePaciente} foi repassado a ${lead.psicologoNome ?? 'outro profissional'} porque o prazo de ${SLA_CONTATO_HORAS} h venceu sem confirmação.`
          : `${lead.nomePaciente} foi encaminhado a ${lead.psicologoNome ?? 'outro profissional'}.`,
        ocorridoEm: lead.alocadoEm,
        severidade: lead.slaExpirado ? 'ATENCAO' : 'INFO',
        href: '/cockpit',
        pendente: false,
      });
    }
  }

  itens.push(...notificacoesDoCadastro(cadastro));
  return itens;
}

/** Avisos sobre o próprio credenciamento e sobre a participação no rodízio. */
function notificacoesDoCadastro(cadastro: CadastroPsicologoRecord): NotificacaoDerivada[] {
  const itens: NotificacaoDerivada[] = [];
  // Não existe carimbo de mudança de status no cadastro. `acessoCriadoEm` é
  // gravado na aprovação e é o instante mais próximo do evento que temos; a
  // recusa recai na criação. Datar por aproximação é preferível a esconder do
  // profissional a decisão sobre a candidatura dele.
  const quando = cadastro.acessoCriadoEm ?? cadastro.criadoEm;

  if (cadastro.status === 'APROVADO') {
    itens.push({
      chave: `credenciamento-aprovado:${cadastro.id}:${quando}`,
      tipo: 'credenciamento-aprovado',
      titulo: 'Credenciamento aprovado',
      descricao: 'Você está no rodízio de encaminhamentos da clínica.',
      ocorridoEm: quando,
      severidade: 'INFO',
      href: '/meu-cadastro',
      pendente: false,
    });

    const semCriterios =
      (cadastro.modalidadesAtendidas ?? []).length === 0 ||
      (cadastro.turnosDisponiveis ?? []).length === 0;
    if (semCriterios) {
      itens.push({
        chave: `cadastro-incompleto:${cadastro.id}`,
        tipo: 'cadastro-incompleto',
        titulo: 'Complete seu cadastro para receber pacientes',
        descricao:
          'Sem turnos e faixa de valor declarados, o rodízio não consegue indicar ninguém para você.',
        ocorridoEm: quando,
        severidade: 'ATENCAO',
        href: '/meu-cadastro',
        pendente: true,
      });
    }

    const limite = cadastro.limitePacientesAtivos ?? 5;
    const ativos = cadastro.pacientesAtivosCount ?? 0;
    if (ativos >= limite) {
      itens.push({
        chave: `limite-atingido:${cadastro.id}:${ativos}`,
        tipo: 'limite-atingido',
        titulo: 'Limite de pacientes ativos atingido',
        descricao: `Você está com ${ativos} de ${limite} pacientes ativos e não receberá novos encaminhamentos até liberar uma vaga.`,
        ocorridoEm: quando,
        severidade: 'ATENCAO',
        href: '/pacientes',
        pendente: true,
      });
    }
  }

  if (cadastro.status === 'RECUSADO') {
    itens.push({
      chave: `credenciamento-recusado:${cadastro.id}`,
      tipo: 'credenciamento-recusado',
      titulo: 'Credenciamento não aprovado',
      descricao: cadastro.motivoDesativacao?.trim()
        ? `Motivo registrado pela gestão: ${cadastro.motivoDesativacao.trim()}`
        : 'Procure a coordenação da clínica para entender os próximos passos.',
      ocorridoEm: quando,
      severidade: 'ATENCAO',
      href: '/meu-cadastro',
      pendente: true,
    });
  }

  if (cadastro.pausadoNoRodizio) {
    itens.push({
      chave: `rodizio-pausado:${cadastro.id}`,
      tipo: 'rodizio-pausado',
      titulo: 'Você está pausado no rodízio',
      descricao: cadastro.motivoPausaRodizio?.trim()
        ? `Motivo: ${cadastro.motivoPausaRodizio.trim()}. Novos pacientes não serão encaminhados a você.`
        : 'Novos pacientes não serão encaminhados a você enquanto a pausa durar.',
      ocorridoEm: quando,
      severidade: 'ATENCAO',
      href: '/meu-cadastro',
      pendente: true,
    });
  }

  return itens;
}

// ---------------------------------------------------------------------------
// Gestão
// ---------------------------------------------------------------------------

/** O que a coordenação precisa ver: a fila inteira e o credenciamento. */
export function notificacoesDaGestao(
  state: CaptureState,
  agora: Date = new Date()
): NotificacaoDerivada[] {
  const itens: NotificacaoDerivada[] = [];

  for (const lead of state.triagensPacientes) {
    if (lead.status === 'PENDENTE_ATRIBUICAO') {
      itens.push({
        chave: `lead-sem-profissional:${lead.id}`,
        tipo: 'lead-sem-profissional',
        titulo: 'Paciente sem profissional elegível',
        descricao: `${lead.nomePaciente} (${lead.protocolo}) — ${resumoDoLead(lead)}. Ninguém no rodízio atende a esses critérios.`,
        ocorridoEm: lead.criadoEm,
        severidade: 'CRITICO',
        href: '/gestao/cockpit',
        pendente: true,
      });
      continue;
    }

    if (lead.status === 'AGUARDANDO_CONTATO' && lead.alocadoEm) {
      const sla = classificarSla(lead.alocadoEm, agora);

      if (sla === 'VERMELHO') {
        itens.push({
          chave: `sla-estourado:${lead.id}:${lead.alocadoEm}`,
          tipo: 'sla-estourado',
          titulo: 'Prazo de primeiro contato vencido',
          descricao: `${lead.nomePaciente} (${lead.protocolo}) está com ${lead.psicologoNome ?? 'profissional não identificado'} e ${prazoRestante(lead.alocadoEm, agora)}.`,
          ocorridoEm: lead.alocadoEm,
          severidade: 'CRITICO',
          href: '/gestao/cockpit',
          pendente: true,
        });
      } else if (sla === 'AMARELO') {
        itens.push({
          chave: `sla-em-risco:${lead.id}:${lead.alocadoEm}`,
          tipo: 'sla-em-risco',
          titulo: 'Primeiro contato perto do prazo',
          descricao: `${lead.nomePaciente} (${lead.protocolo}) com ${lead.psicologoNome ?? 'profissional não identificado'} — ${prazoRestante(lead.alocadoEm, agora)}.`,
          ocorridoEm: lead.alocadoEm,
          severidade: 'ATENCAO',
          href: '/gestao/cockpit',
          pendente: true,
        });
      }

      if ((lead.transbordos ?? 0) > 0) {
        itens.push({
          chave: `transbordo:${lead.id}:${lead.alocadoEm}`,
          tipo: 'transbordo',
          titulo: `Paciente repassado (${lead.transbordos}ª vez)`,
          descricao: `${lead.nomePaciente} (${lead.protocolo}) passou para ${lead.psicologoNome ?? 'outro profissional'}.`,
          ocorridoEm: lead.alocadoEm,
          severidade: (lead.transbordos ?? 0) > 1 ? 'ATENCAO' : 'INFO',
          href: '/gestao/cockpit',
          pendente: false,
        });
      }
      continue;
    }

    if (lead.status === 'CONTATO_CONFIRMADO' && lead.confirmadoEm) {
      itens.push({
        chave: `contato-confirmado:${lead.id}:${lead.confirmadoEm}`,
        tipo: 'contato-confirmado',
        titulo: 'Primeiro contato confirmado',
        descricao: `${lead.psicologoNome ?? 'O profissional'} confirmou contato com ${lead.nomePaciente} (${lead.protocolo}).`,
        ocorridoEm: lead.confirmadoEm,
        severidade: 'INFO',
        href: '/gestao/cockpit',
        pendente: false,
      });
    }
  }

  for (const cadastro of state.cadastrosPsicologos) {
    if (cadastro.status === 'EM_ANALISE') {
      itens.push({
        chave: `credenciamento-em-analise:${cadastro.id}`,
        tipo: 'credenciamento-em-analise',
        titulo: 'Credenciamento aguardando análise',
        descricao: `${nomeDeExibicao(cadastro)} (CRP ${cadastro.crp}) se candidatou pela vitrine.`,
        ocorridoEm: cadastro.criadoEm,
        severidade: 'ATENCAO',
        href: '/gestao/cockpit',
        pendente: true,
      });
      continue;
    }

    const semCriterios =
      cadastro.status === 'APROVADO' &&
      ((cadastro.modalidadesAtendidas ?? []).length === 0 ||
        (cadastro.turnosDisponiveis ?? []).length === 0);
    if (semCriterios) {
      itens.push({
        chave: `aprovado-sem-criterios:${cadastro.id}`,
        tipo: 'aprovado-sem-criterios',
        titulo: 'Profissional aprovado fora do rodízio',
        descricao: `${nomeDeExibicao(cadastro)} está aprovado, mas sem turno ou faixa de valor definidos — não recebe encaminhamento.`,
        ocorridoEm: cadastro.acessoCriadoEm ?? cadastro.criadoEm,
        severidade: 'ATENCAO',
        href: '/gestao/psicologos',
        pendente: true,
      });
    }
  }

  return itens;
}

// ---------------------------------------------------------------------------
// Montagem da lista visível
// ---------------------------------------------------------------------------

/**
 * Aplica leitura, retenção e ordem.
 *
 * O que já foi resolvido some depois de 30 dias; o que continua aberto fica,
 * por mais velho que seja — uma fila parada há dois meses é exatamente o que
 * não pode desaparecer do sino.
 *
 * O teto de itens também respeita essa separação: o corte descarta primeiro o
 * que já está resolvido. Ordenar tudo por data e cortar no quadragésimo faria
 * um dia movimentado de confirmações empurrar para fora da lista o paciente
 * que ninguém contatou na semana passada.
 */
export function montarLista(
  derivadas: readonly NotificacaoDerivada[],
  lidas: ReadonlySet<string>,
  agora: Date = new Date()
): { itens: NotificacaoVisivel[]; naoLidas: number } {
  const limite = agora.getTime() - JANELA_RETENCAO_DIAS * DIA_MS;
  const maisRecentePrimeiro = (a: NotificacaoDerivada, b: NotificacaoDerivada) =>
    new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime();

  const pendentes = derivadas.filter((item) => item.pendente).sort(maisRecentePrimeiro);
  const resolvidas = derivadas
    .filter((item) => {
      if (item.pendente) return false;
      const instante = new Date(item.ocorridoEm).getTime();
      return Number.isFinite(instante) && instante >= limite;
    })
    .sort(maisRecentePrimeiro);

  const selecionadas = [
    ...pendentes.slice(0, LIMITE_ITENS),
    ...resolvidas.slice(0, Math.max(0, LIMITE_ITENS - pendentes.length)),
  ].sort(maisRecentePrimeiro);

  const itens = selecionadas.map((item) => ({
    ...item,
    lida: lidas.has(item.chave),
  }));

  // A contagem é do que está na lista: um ponto vermelho apontando para avisos
  // que a lista não mostra não tem como ser zerado por quem o vê.
  return { itens, naoLidas: itens.filter((item) => !item.lida).length };
}
