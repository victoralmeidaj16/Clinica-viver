import 'server-only';

import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import type { CaptureState } from '@/server/persistence/captureRepository';
import type { PagamentoRecebido } from '@/server/payments/paymentLinkRepository';
import type { AgendamentoResumo } from '@/server/scheduling/agendaRepository';
import type { AlteracaoPerfil } from '@/server/persistence/perfilAlteracoes';
import { descreverMudancas } from '@/lib/perfilPsicologoDiff';
import {
  comFoco,
  FOCO_SECAO,
  focoCredenciamento,
  focoLead,
  focoPaciente,
  focoPagamento,
  focoPsicologo,
  focoSessao,
  PARAM_ABA,
} from '@/lib/focoNotificacao';
import { diasDeAusencia, periodoAusencia } from '@/lib/ausenciaAgenda';
import { dataHoraSessao } from '@/lib/sessionReference';
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
  /**
   * Para onde o clique leva — página **e** item.
   *
   * O `foco` do endereço é o mesmo texto que a tela de destino escreve em
   * `data-foco`, e é o que faz o clique cair na linha do paciente citado em
   * vez do topo da lista. Ver `lib/focoNotificacao.ts`.
   */
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

/**
 * A fila da gestão é a aba inicial do cockpit, mas pedi-la explicitamente faz o
 * endereço continuar valendo se a aba padrão mudar — e faz o clique voltar para
 * a fila quando quem clica já estava numa das outras abas.
 */
function naFilaDaGestao(leadId: string): string {
  return comFoco('/gestao/cockpit', focoLead(leadId), { [PARAM_ABA]: 'fila' });
}

/**
 * Competência (`AAAA-MM`) do extrato em que o pagamento aparece.
 *
 * O mês é o da clínica, não o do servidor: um Pix recebido às 22h de 31/08 em
 * São Paulo é agosto, e abrir setembro mostraria uma tabela sem ele.
 */
function competenciaDoExtrato(recebidoEm: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(recebidoEm));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((item) => item.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}`;
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
        // Sem `foco`: o painel do profissional não tem uma fila de leads para
        // apontar. O primeiro contato é feito pelo link que chega no WhatsApp,
        // e inventar aqui uma âncora para uma seção que não existe daria um
        // clique que rola até lugar nenhum. Enquanto essa tela não existir, o
        // destino honesto é o painel.
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
        // A promoção do lead em paciente pode ainda não ter acontecido; sem a
        // referência, a lista inteira é o destino honesto.
        href: lead.pacienteRef
          ? comFoco('/pacientes', focoPaciente(lead.pacienteRef))
          : comFoco('/pacientes', FOCO_SECAO.listaPacientes),
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
        // Sem `foco`, pela mesma razão do aviso de atribuição — e aqui o lead
        // saiu da fila deste profissional, então não haveria o que ele
        // resolvesse na tela de destino.
        href: '/cockpit',
        pendente: false,
      });
    }
  }

  itens.push(...notificacoesDoCadastro(cadastro));
  return itens;
}

/**
 * "Seu paciente pagou."
 *
 * Sai de `financeiro_pagamentos`, não do webhook: o aviso e a linha do
 * financeiro passam a contar a mesma história, e um estorno que apague a
 * conciliação apaga junto o aviso — o que uma notificação gravada no momento
 * do webhook não faria.
 *
 * A chave carrega a referência do pagamento, então um segundo pagamento do
 * mesmo paciente volta a aparecer como não lido em vez de ser silenciado pela
 * leitura do anterior.
 */
export function notificacoesDePagamento(
  pagamentos: readonly PagamentoRecebido[]
): NotificacaoDerivada[] {
  const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  return pagamentos.map((pagamento) => ({
    chave: `pagamento-recebido:${pagamento.ref}`,
    tipo: 'pagamento-recebido',
    titulo: 'Pagamento recebido',
    descricao: `${pagamento.patientName} pagou ${dinheiro.format(pagamento.amountCents / 100)} via ${rotuloForma(pagamento.method)}.`,
    ocorridoEm: pagamento.receivedAt,
    severidade: 'INFO',
    // O extrato é lido por competência: sem o mês do pagamento, um recebimento
    // do mês passado abriria uma tabela que não o contém.
    href: comFoco('/meu-financeiro', focoPagamento(pagamento.ref), {
      mes: competenciaDoExtrato(pagamento.receivedAt),
    }),
    pendente: false,
  }));
}

/** Marcações e confirmações pendentes da agenda do próprio profissional. */
export function notificacoesDeAgendamentos(
  agendamentos: readonly AgendamentoResumo[],
  agora: Date = new Date()
): NotificacaoDerivada[] {
  const itens: NotificacaoDerivada[] = [];
  for (const agendamento of agendamentos) {
    if (agendamento.status === 'cancelado') continue;

    itens.push({
      chave: `sessao-agendada:${agendamento.id}:${agendamento.criadoEm}`,
      tipo: 'sessao-agendada',
      titulo: agendamento.origem === 'portal'
        ? 'Nova sessão marcada pelo paciente'
        : 'Sessão adicionada à sua agenda',
      descricao: `${agendamento.pacienteNome} — ${dataHoraSessao(agendamento.inicio)}.`,
      ocorridoEm: agendamento.criadoEm,
      severidade: 'INFO',
      href: comFoco('/agenda', focoSessao(agendamento.id)),
      pendente: false,
    });

    const aguardaConfirmacao =
      ['agendado', 'confirmado'].includes(agendamento.status) &&
      Date.parse(agendamento.fim) <= agora.getTime();
    if (aguardaConfirmacao) {
      itens.push({
        chave: `confirmar-sessao:${agendamento.id}:${agendamento.fim}`,
        tipo: 'confirmar-sessao',
        titulo: 'Confirme se a sessão ocorreu',
        descricao: `${agendamento.pacienteNome} — atendimento previsto para ${dataHoraSessao(agendamento.inicio)}.`,
        ocorridoEm: agendamento.fim,
        severidade: 'ATENCAO',
        href: comFoco('/agenda', focoSessao(agendamento.id)),
        pendente: true,
      });
    }
  }
  return itens;
}

function rotuloForma(forma: string): string {
  switch (forma) {
    case 'pix':
      return 'Pix';
    case 'card':
      return 'cartão';
    case 'cash':
      return 'dinheiro';
    case 'bank_transfer':
      return 'transferência';
    default:
      return 'pagamento online';
  }
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
      href: comFoco('/meu-cadastro', FOCO_SECAO.statusCredenciamento),
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
        // O que falta preencher vive no card da prática, não no aviso de status.
        href: comFoco('/meu-cadastro', FOCO_SECAO.minhaPratica),
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
        href: comFoco('/pacientes', FOCO_SECAO.listaPacientes),
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
      href: comFoco('/meu-cadastro', FOCO_SECAO.statusCredenciamento),
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
      href: comFoco('/meu-cadastro', FOCO_SECAO.statusCredenciamento),
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
        href: naFilaDaGestao(lead.id),
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
          href: naFilaDaGestao(lead.id),
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
          href: naFilaDaGestao(lead.id),
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
          href: naFilaDaGestao(lead.id),
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
        href: naFilaDaGestao(lead.id),
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
        // A candidatura mora na aba de credenciamentos, que não é a que o
        // cockpit abre por padrão: o endereço precisa pedir a aba certa.
        href: comFoco('/gestao/cockpit', focoCredenciamento(cadastro.id), {
          [PARAM_ABA]: 'credenciamentos',
        }),
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
        href: comFoco('/gestao/psicologos', focoPsicologo(cadastro.id)),
        pendente: true,
      });
    }

    for (const ausencia of cadastro.ausenciasAgenda ?? []) {
      const vigente = Date.parse(ausencia.inicio) <= agora.getTime();
      itens.push({
        // O instante de criação na chave faz cada novo período marcado voltar
        // como não lido, em vez de ser silenciado pela leitura do anterior.
        chave: `psicologo-ausente:${cadastro.id}:${ausencia.criadoEm}`,
        tipo: 'psicologo-ausente',
        titulo: vigente
          ? 'Profissional ausente — fora do rodízio'
          : 'Profissional marcou férias ou folga',
        descricao: `${nomeDeExibicao(cadastro)} ${vigente ? 'está' : 'ficará'} indisponível ${periodoAusencia(ausencia)}${ausencia.motivo ? ` — ${ausencia.motivo}` : ''}. Não recebe encaminhamento nesse intervalo.`,
        ocorridoEm: ausencia.criadoEm,
        severidade: diasDeAusencia(ausencia) >= 2 ? 'ATENCAO' : 'INFO',
        href: comFoco('/gestao/psicologos', focoPsicologo(cadastro.id)),
        // A gestão é informada, não convocada: marcar a própria folga é
        // decisão do profissional, e o rodízio já se ajustou sozinho. O que
        // exigiria ação — paciente sem quem atenda — tem aviso próprio.
        pendente: false,
      });
    }
  }

  return itens;
}

/**
 * "Fulano mudou o próprio perfil, e mudou isto."
 *
 * Único aviso do sino que nasce de um fato gravado, e não de um estado
 * recalculado — porque é o único que descreve uma **diferença**. Depois que o
 * cadastro foi sobrescrito, o valor anterior não existe mais em lugar nenhum:
 * "manhã, tarde → manhã, tarde, noite" é impossível de derivar do banco. O
 * porquê está por extenso em `031_perfil_alteracoes.sql`.
 *
 * A chave carrega o instante da edição, então **cada** alteração volta a
 * aparecer como não lida, em vez de ser silenciada pela leitura da anterior —
 * que é o comportamento pedido pela coordenação.
 */
export function notificacoesDePerfilAlterado(
  alteracoes: readonly AlteracaoPerfil[]
): NotificacaoDerivada[] {
  return alteracoes
    .filter((alteracao) => alteracao.mudancas.length > 0)
    .map((alteracao) => ({
      chave: `perfil-alterado:${alteracao.cadastroRef}:${alteracao.alteradoEm}`,
      tipo: 'perfil-alterado',
      titulo: `${alteracao.psicologoNome} alterou o próprio perfil`,
      descricao: descreverMudancas(alteracao.mudancas),
      ocorridoEm: alteracao.alteradoEm,
      severidade: 'INFO',
      href: comFoco('/gestao/psicologos', focoPsicologo(alteracao.cadastroRef)),
      // A gestão é informada, não convocada: o profissional já mudou o que era
      // dele por direito. Marcar como pendente manteria no sino, para sempre,
      // um aviso que ninguém tem o que resolver.
      pendente: false,
    }));
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
