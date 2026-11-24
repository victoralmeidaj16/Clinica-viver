import 'server-only';
import { normalizarModalidade } from '@/lib/modalidade';
export { normalizarModalidade } from '@/lib/modalidade';

import {
  checarEExecutarTransbordoSla,
  normalizarFormatoAtendimento,
  processarTriagemLead,
  psicologoCompativel,
  type LeadTriagem,
  type PsicologoPerfil,
  type TurnoAtendimento,
} from '@thats-life/core';
import type {
  AusenciaAgenda,
  CadastroPsicologoRecord,
  PersistedSnapshot,
  RecusaEncaminhamento,
  TriagemPacienteRecord,
} from './persistence';
import { generoProfissional } from '@/lib/gender';
import { normalizarTurnoPreferencia, normalizarTurnosPreferencia } from '@/lib/turnos';
import { foraPorVinculoAcademico } from '@/lib/turmaEncerrada';
import { PUBLICO_ALVO } from '@/components/forms/opcoesPsicologo';
import { derivarServicosHabilitados } from './psychologistRegistration';
import {
  LIMITE_PACIENTES_MAXIMO,
  LIMITE_PACIENTES_MINIMO,
  LIMITE_PACIENTES_PADRAO,
} from '@/lib/psychologistCapacity';
import { normalizarPrazoOferta, prazoDaOferta, PRAZO_OFERTA_PADRAO_HORAS } from '@/lib/prazoOferta';
import { devolverParaEspera, encerrarEsperaSeAtendido } from './listaEsperaSaida';

/**
 * Ponte entre o motor de rodízio (`@thats-life/core`) e o estado persistido.
 *
 * O motor decide; este módulo traduz e guarda. A separação existe porque as
 * duas pontas falam vocabulários diferentes: a vitrine coleta "VESPERTINO" e
 * "SOCIAL", o motor raciocina em "TARDE" e "ACESSIVEL_SOCIAL". Sem a tradução,
 * o filtro de turno e modalidade nunca casa e o rodízio devolve fila vazia para
 * todo mundo — falhando do jeito mais silencioso possível.
 *
 * Tudo aqui é função pura sobre o snapshot: recebe estado, devolve estado novo.
 * Quem grava e quem dispara mensagem é o chamador, porque alocar e avisar não
 * podem ficar presos um ao outro — uma falha de WhatsApp não pode desfazer uma
 * alocação já decidida.
 */

/**
 * Prazo padrão da oferta, em horas. O valor em uso vem da configuração da
 * Gestão (`prazoOfertaHoras` no snapshot) e fica gravado em cada oferta.
 */
export const SLA_CONTATO_HORAS = PRAZO_OFERTA_PADRAO_HORAS;

/** Prazo que as novas ofertas recebem agora. */
export function prazoConfigurado(snapshot: Pick<PersistedSnapshot, 'prazoOfertaHoras'>): number {
  return normalizarPrazoOferta(snapshot.prazoOfertaHoras);
}

export type SlaStatus = 'VERDE' | 'AMARELO' | 'VERMELHO';

export interface TransbordoOcorrido {
  lead: TriagemPacienteRecord;
  psicologoAnteriorId?: string;
  psicologoAnteriorNome?: string;
  psicologoNovo: CadastroPsicologoRecord;
}

export interface ResultadoAlocacao {
  snapshot: PersistedSnapshot;
  lead: TriagemPacienteRecord;
  psicologo?: CadastroPsicologoRecord;
}

export type ModoAlocacaoGestao = 'PEDIR_ACEITE' | 'VINCULAR_DIRETO';

export interface OpcoesAlocacaoGestao {
  modo?: ModoAlocacaoGestao;
  excederLimite?: boolean;
  justificativaExcesso?: string;
}

export type ResultadoReatribuicaoGestao =
  | {
      situacao: 'reatribuido';
      snapshot: PersistedSnapshot;
      lead: TriagemPacienteRecord;
      psicologo: CadastroPsicologoRecord;
      primeiraAlocacao: boolean;
      psicologoAnteriorNome?: string;
      modo: ModoAlocacaoGestao;
      excedeuLimite: boolean;
      ocupacaoResultante: { ativos: number; limite: number };
    }
  | {
      situacao: 'limite_atingido' | 'justificativa_obrigatoria';
      snapshot: PersistedSnapshot;
      ativos: number;
      limite: number;
      psicologo: CadastroPsicologoRecord;
    }
  | { situacao: 'lead_nao_encontrado' | 'psicologo_indisponivel' | 'lead_ja_confirmado'; snapshot: PersistedSnapshot };

/**
 * Traduz o turno como a vitrine o coleta para o vocabulário do motor.
 *
 * Aceita as duas grafias porque o formulário público usa uma e o cadastro
 * interno usa a outra. Valor desconhecido devolve `null` em vez de um palpite:
 * indicar alguém pelo turno errado é pior do que não indicar.
 */
export function normalizarTurno(valor: string | undefined): TurnoAtendimento | null {
  return normalizarTurnoPreferencia(valor);
}

function normalizarLista<T>(
  valores: readonly string[] | undefined,
  normalizar: (valor: string) => T | null
): T[] {
  return (valores ?? []).map(normalizar).filter((valor): valor is T => valor !== null);
}

/** Nome pelo qual a pessoa deve ser chamada em qualquer tela ou mensagem. */
export function nomeDeExibicao(record: CadastroPsicologoRecord): string {
  return record.nomeSocial?.trim() || record.nomeCompleto;
}

/**
 * A ausência que cobre este instante, se houver.
 *
 * Quem está de férias não recebe paciente novo — e volta a receber no dia
 * seguinte ao fim, sem ninguém precisar desmarcar nada.
 */
export function ausenciaVigente(
  record: CadastroPsicologoRecord,
  agora: Date = new Date()
): AusenciaAgenda | undefined {
  const instante = agora.getTime();
  return record.ausenciasAgenda?.find(
    (ausencia) =>
      Date.parse(ausencia.inicio) <= instante && Date.parse(ausencia.fim) > instante
  );
}

const SERVICOS_CONHECIDOS = new Set(derivarServicosHabilitados([
  'Atendimento Psicológico', 'Avaliação Psicológica', 'Orientação Vocacional', 'Orientação Profissional', 'Orientação Parental',
]));

/**
 * Serviços que o cadastro pode receber agora: os homologados, limitados ao
 * que os vínculos acadêmicos válidos permitem no catálogo atual (2.01–2.02 e
 * 1.04). Um curso que deixa de permitir um serviço, ou um vínculo que perde a
 * validade, tira o serviço daqui sem apagar a homologação gravada.
 */
export function servicosEfetivos(record: CadastroPsicologoRecord): string[] {
  const homologados = [...(record.servicosHabilitados ?? [])];
  if (!record.permissoesEfetivas) return homologados;
  const permitidos = new Set(derivarServicosHabilitados(record.permissoesEfetivas.servicos));
  return homologados.filter((servico) => !SERVICOS_CONHECIDOS.has(servico) || permitidos.has(servico));
}

/** Públicos escolhidos, limitados aos que os vínculos válidos permitem. Valores antigos fora do vocabulário ficam. */
export function publicoEfetivo(record: CadastroPsicologoRecord): string[] | undefined {
  if (!record.publicoAlvo) return undefined;
  if (!record.permissoesEfetivas) return [...record.publicoAlvo];
  const permitidos = record.permissoesEfetivas.publico;
  return record.publicoAlvo.filter((publico) => !PUBLICO_ALVO.includes(publico) || permitidos.includes(publico));
}

/** Formato do cadastro dentro do que os cursos válidos permitem; `null` quando não sobra nenhum. */
function formatoEfetivo(record: CadastroPsicologoRecord): string | undefined | null {
  const permitidos = record.formatosPermitidos ?? [];
  const atual = record.modalidadeAtendimento;
  if (permitidos.length !== 1) return atual;
  const unico = permitidos[0];
  if (!atual || atual === 'AMBOS' || atual === unico) return unico;
  return null;
}

/**
 * Converte o cadastro do credenciamento no perfil que o motor entende.
 *
 * Campos ausentes viram ausência de habilitação, não permissão: quem não
 * declarou turno não atende turno nenhum e simplesmente não é indicado. O único
 * padrão generoso é `exibirNaVitrine`, porque um cadastro aprovado sem a chave
 * gravada foi aprovado para atender.
 */
export function paraPsicologoPerfil(
  record: CadastroPsicologoRecord,
  agora: Date = new Date()
): PsicologoPerfil {
  return {
    id: record.id,
    // Nome social tem prioridade de exibição — é o nome que a pessoa usa, e é
    // por ele que a mensagem ao paciente e a vitrine devem chamá-la.
    nome: nomeDeExibicao(record),
    nomeSocial: record.nomeSocial,
    crp: record.crp,
    telefoneWhatsApp: record.whatsapp,
    email: record.email ?? '',
    // Só masculino/feminino atravessam: é o que a preferência do paciente
    // distingue. Qualquer outra declaração fica sem valor aqui e o perfil passa
    // a entrar apenas em indicações sem preferência.
    genero: generoProfissional(record.genero),
    turnosDisponiveis: normalizarLista(record.turnosDisponiveis, normalizarTurno),
    modalidadesAtendidas: normalizarLista(record.modalidadesAtendidas, normalizarModalidade),
    modalidadeAtendimento: formatoEfetivo(record) ?? record.modalidadeAtendimento,
    abordagem: record.especialidade,
    servicosHabilitados: servicosEfetivos(record),
    temposAtendimento: record.temposAtendimento
      ? record.permissoesEfetivas?.tempos.length
        ? record.temposAtendimento.filter((tempo) => record.permissoesEfetivas!.tempos.includes(tempo))
        : [...record.temposAtendimento]
      : undefined,
    publicoAlvo: publicoEfetivo(record),
    especificarNecessidades: record.especificarNecessidades,
    necessidadesAtendidas: record.necessidadesAtendidas ? [...record.necessidadesAtendidas] : undefined,
    necessidadesOutro: record.necessidadesOutro,
    limitePacientesAtivos: record.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO,
    pacientesAtivosCount: record.pacientesAtivosCount ?? 0,
    exibirNaVitrine: record.exibirNaVitrine ?? true,
    motivoDesativacao: record.motivoDesativacao,
    // Férias na agenda pausam sem apagar a pausa manual: as duas somam, e
    // quando as férias acabam continua valendo o que a gestão decidiu.
    // Turma encerrada também tira da fila, pelo mesmo mecanismo: derivado,
    // sem tocar na pausa manual.
    pausadoNoRodizio:
      (record.pausadoNoRodizio ?? false) ||
      Boolean(record.reconfiguracaoAtendimentoPendente) ||
      Boolean(ausenciaVigente(record, agora)) ||
      // Sai só quando nenhum vínculo acadêmico aprovado continua válido (1.04),
      // ou quando o formato do cadastro não cabe em nenhum curso válido.
      foraPorVinculoAcademico(record) ||
      formatoEfetivo(record) === null,
    posicaoFilaRoundRobin: 0,
    ultimoLeadRecebidoEm: record.ultimoLeadRecebidoEm,
    saldoCreditoAbatimento: 0,
    turmaViverMais: record.turmaViverMais,
    posGraduacaoViverMais: record.posGraduacaoViverMais,
    outrasPosGraduacoes: record.segundaPosGraduacao ? [record.segundaPosGraduacao] : undefined,
  };
}

/** Profissionais aprovados — os únicos que o rodízio enxerga. */
export function rosterAtivo(snapshot: PersistedSnapshot): CadastroPsicologoRecord[] {
  return (snapshot.cadastrosPsicologos ?? []).filter((psi) => psi.status === 'APROVADO');
}

/**
 * Monta o lead no formato do motor. Só os campos que a indicação usa importam.
 *
 * `ignorarPreferenciaGenero` existe porque a preferência responde a uma
 * pergunta só: "quem o rodízio deve escolher por conta própria?". Quando o
 * paciente já apontou um nome no catálogo, ou quando a gestão está reatribuindo
 * à mão, a decisão é de quem escolheu — filtrar a lista ali esconderia opções
 * de quem tem autoridade para decidir, sem explicar por quê.
 */
function paraLeadTriagem(
  record: TriagemPacienteRecord,
  opcoes: { ignorarPreferenciaGenero?: boolean } = {}
): LeadTriagem | null {
  const turno = normalizarTurnosPreferencia(record.turno);
  const modalidade = normalizarModalidade(record.modalidade);
  if (!turno.length || !modalidade) return null;
  const formato = normalizarFormatoAtendimento(record.formatoAtendimento);

  return {
    id: record.id,
    nomePaciente: record.nomePaciente,
    telefoneWhatsApp: record.telefone,
    email: record.email,
    cpf: record.cpf,
    modalidade,
    turno,
    origemLead: record.origem,
    criadoEm: record.criadoEm,
    psicologoAlocadoId: record.psicologoAlocadoId,
    dataAlocacao: record.alocadoEm,
    status: record.status === 'CONTATO_CONFIRMADO' ? 'CONTATO_CONFIRMADO' : 'AGUARDANDO_CONTATO',
    nomeSocial: undefined,
    confirmadoPeloPsicologoEm: record.confirmadoEm,
    slaExpirado: record.slaExpirado ?? false,
    paraQuemE: record.paraQuemE,
    especificarNecessidades: record.especificarNecessidades,
    necessidadesPaciente: record.necessidadesPaciente ? [...record.necessidadesPaciente] : undefined,
    necessidadesOutro: record.necessidadesOutro,
    opcaoAvaliacaoPsicologica: record.opcaoAvaliacaoPsicologica,
    preferenciaGeneroPsicologo: opcoes.ignorarPreferenciaGenero
      ? undefined
      : record.preferenciaGeneroPsicologo,
    formatoAtendimento: formato && formato !== 'AMBOS' ? formato : undefined,
    abordagemDesejada: record.abordagemDesejada,
    duracaoDesejadaMinutos: record.duracaoSessaoMinutos,
  };
}

function substituirLead(
  snapshot: PersistedSnapshot,
  lead: TriagemPacienteRecord
): PersistedSnapshot {
  return {
    ...snapshot,
    triagensPacientes: (snapshot.triagensPacientes ?? []).map((item) =>
      item.id === lead.id ? lead : item
    ),
  };
}

/** Campos de toda oferta nova: relógio zerado e prazo vigente gravado nela. */
function novaOferta(snapshot: PersistedSnapshot, alocadoEm: string) {
  return { alocadoEm, aceitoEm: undefined, slaExpirado: false, prazoRespostaHoras: prazoConfigurado(snapshot) };
}

/**
 * Marca no roster que o profissional acabou de receber alguém.
 *
 * É esta gravação que faz o rodízio girar. O motor já devolve o profissional
 * atualizado, mas quem não persiste `ultimoLeadRecebidoEm` tem uma fila que
 * esquece de quem era a vez e entrega tudo para o primeiro da lista.
 */
function registrarRecebimento(
  snapshot: PersistedSnapshot,
  psicologoId: string,
  quandoIso: string
): PersistedSnapshot {
  return {
    ...snapshot,
    cadastrosPsicologos: (snapshot.cadastrosPsicologos ?? []).map((psi) =>
      psi.id === psicologoId
        ? {
            ...psi,
            ultimoLeadRecebidoEm: quandoIso,
          }
        : psi
    ),
  };
}

/**
 * A capacidade é derivada dos contatos confirmados, nunca de um acumulador.
 * Assim transbordo e tentativas sem confirmação não consomem vaga.
 */
/**
 * Vínculo ativo ocupa vaga desde o aceite ou o cadastro manual (especificação
 * final, 3.11 e 6.02). Desistência e alta liberam na hora (6.05 e 6.06), e o
 * paciente do Projeto Acolhe fica fora do limite (seção 15).
 */
function ocupaVaga(lead: TriagemPacienteRecord): boolean {
  if (!lead.psicologoAlocadoId || lead.projetoAcolhe) return false;
  if (lead.status === 'CONTATO_CONFIRMADO') return true;
  return lead.status === 'AGUARDANDO_CONTATO' && Boolean(lead.aceitoEm);
}

export function recalcularPacientesAtivos(snapshot: PersistedSnapshot): PersistedSnapshot {
  const contagem = new Map<string, number>();
  // Quem foi aceito, vinculado, inativado ou desistiu deixa a lista de espera
  // aqui, no ponto por onde toda mutação da fila passa (5.07).
  const triagens = snapshot.triagensPacientes?.map(encerrarEsperaSeAtendido);
  for (const lead of triagens ?? []) {
    if (!ocupaVaga(lead) || !lead.psicologoAlocadoId) continue;
    contagem.set(lead.psicologoAlocadoId, (contagem.get(lead.psicologoAlocadoId) ?? 0) + 1);
  }
  return {
    ...snapshot,
    ...(triagens ? { triagensPacientes: triagens } : {}),
    cadastrosPsicologos: (snapshot.cadastrosPsicologos ?? []).map((psi) => ({
      ...psi,
      limitePacientesAtivos: Math.min(
        LIMITE_PACIENTES_MAXIMO,
        Math.max(LIMITE_PACIENTES_MINIMO, psi.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO)
      ),
      pacientesAtivosCount: contagem.get(psi.id) ?? 0,
    })),
  };
}

export type ResultadoLotacao =
  | { kind: 'capacity_reallocated'; lead: TriagemPacienteRecord; psicologo: CadastroPsicologoRecord; anteriorNome?: string }
  | { kind: 'capacity_pending'; lead: TriagemPacienteRecord };

/** A oferta pendente não reserva vaga. Revalidamos dentro da mutação que grava o vínculo. */
function redirecionarSeLotado(
  atual: PersistedSnapshot,
  lead: TriagemPacienteRecord,
  psicologoId: string,
  agora: Date
): { next: PersistedSnapshot; result: ResultadoLotacao } | undefined {
  if (lead.projetoAcolhe || lead.aceitoEm || lead.status === 'CONTATO_CONFIRMADO') return;
  const psicologo = atual.cadastrosPsicologos?.find((item) => item.id === psicologoId);
  if (psicologo && (psicologo.pacientesAtivosCount ?? 0) < (psicologo.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO)) return;

  const pendente: TriagemPacienteRecord = {
    ...lead,
    status: 'PENDENTE_ATRIBUICAO',
    psicologoAlocadoId: undefined,
    psicologoNome: undefined,
    alocadoEm: undefined,
    slaExpirado: false,
    psicologosJaTentados: [...new Set([...(lead.psicologosJaTentados ?? []), psicologoId])],
  };
  const fila = substituirLead(atual, pendente);
  if (pendente.tipoAlocacao !== 'ESCOLHA_DIRETA') {
    const proximaOferta = devolverAoRodizio(fila, lead.id, agora);
    if (proximaOferta.situacao === 'alocado') {
      const realocado = { ...proximaOferta.lead, transbordos: (lead.transbordos ?? 0) + 1 };
      return { next: substituirLead(proximaOferta.snapshot, realocado), result: {
        kind: 'capacity_reallocated', lead: realocado, psicologo: proximaOferta.psicologo, anteriorNome: lead.psicologoNome,
      } };
    }
  }
  return { next: fila, result: { kind: 'capacity_pending', lead: pendente } };
}

export type AceitePacienteResult =
  | ResultadoLotacao
  | { kind: 'not_found' }
  | { kind: 'conflict' }
  | { kind: 'already_confirmed'; lead: TriagemPacienteRecord }
  | { kind: 'already_accepted'; lead: TriagemPacienteRecord }
  | { kind: 'expired'; lead: TriagemPacienteRecord }
  | { kind: 'accepted'; lead: TriagemPacienteRecord };

/**
 * Oferta não respondida no prazo expira e não pode mais ser aceita
 * (especificação final, 5.05). O `sla-sweeper` move o caso, mas roda em
 * intervalos: sem esta checagem, um clique entre o vencimento e a próxima
 * varredura ainda prenderia o paciente a quem não respondeu a tempo.
 */
export function ofertaExpirada(lead: TriagemPacienteRecord, agora: Date = new Date()): boolean {
  if (lead.aceitoEm || lead.confirmadoEm || lead.status !== 'AGUARDANDO_CONTATO') return false;
  const horas = horasDesdeAlocacao(lead.alocadoEm, agora);
  return horas !== null && horas >= prazoDaOferta(lead);
}

/** Registra o aceite sem confundi-lo com a confirmação do primeiro contato. */
export function aceitarPaciente(
  snapshot: PersistedSnapshot,
  id: string,
  psicologoId: string,
  agora: Date = new Date()
): { next: PersistedSnapshot; result: AceitePacienteResult } {
  const lead = snapshot.triagensPacientes?.find((item) => item.id === id);
  if (!lead) return { next: snapshot, result: { kind: 'not_found' } };
  if (lead.psicologoAlocadoId !== psicologoId || (lead.status !== 'AGUARDANDO_CONTATO' && lead.status !== 'CONTATO_CONFIRMADO')) {
    return { next: snapshot, result: { kind: 'conflict' } };
  }
  if (lead.confirmadoEm || lead.status === 'CONTATO_CONFIRMADO') {
    return { next: snapshot, result: { kind: 'already_confirmed', lead } };
  }
  if (lead.aceitoEm) return { next: snapshot, result: { kind: 'already_accepted', lead } };
  if (ofertaExpirada(lead, agora)) return { next: snapshot, result: { kind: 'expired', lead } };

  const lotacao = redirecionarSeLotado(recalcularPacientesAtivos(snapshot), lead, psicologoId, agora);
  if (lotacao) return lotacao;
  const aceito: TriagemPacienteRecord = { ...lead, aceitoEm: agora.toISOString() };
  const next = recalcularPacientesAtivos({
    ...snapshot,
    triagensPacientes: (snapshot.triagensPacientes ?? []).map((item) => (item.id === id ? aceito : item)),
  });
  return { next, result: { kind: 'accepted', lead: aceito } };
}

/**
 * Aloca um lead ao próximo profissional elegível.
 *
 * Quando ninguém atende aos critérios, o lead fica em `PENDENTE_ATRIBUICAO`
 * para a gestão resolver — o rodízio não inventa compatibilidade nem empurra
 * para qualquer um só para esvaziar a fila.
 */
export function alocarLead(
  snapshot: PersistedSnapshot,
  leadRecord: TriagemPacienteRecord,
  agora: Date = new Date()
): ResultadoAlocacao {
  snapshot = recalcularPacientesAtivos(snapshot);
  const lead = paraLeadTriagem(leadRecord);
  const roster = rosterAtivo(snapshot);

  if (!lead || roster.length === 0) {
    const pendente: TriagemPacienteRecord = { ...leadRecord, status: 'PENDENTE_ATRIBUICAO' };
    return { snapshot: substituirLead(snapshot, pendente), lead: pendente };
  }

  const resultado = processarTriagemLead(
    lead,
    roster.map((psi) => paraPsicologoPerfil(psi, agora)),
    leadRecord.servicoKey
  );

  if (!resultado.sucesso || !resultado.psicologoAlocado) {
    const pendente: TriagemPacienteRecord = { ...leadRecord, status: 'PENDENTE_ATRIBUICAO' };
    return { snapshot: substituirLead(snapshot, pendente), lead: pendente };
  }

  const escolhido = roster.find((psi) => psi.id === resultado.psicologoAlocado!.id)!;
  const alocadoEm = resultado.leadAtualizado.dataAlocacao ?? new Date().toISOString();

  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: escolhido.id,
    psicologoNome: nomeDeExibicao(escolhido),
    ...novaOferta(snapshot, alocadoEm),
    tipoAlocacao: 'RODIZIO',
    transbordos: leadRecord.transbordos ?? 0,
    psicologosJaTentados: [...(leadRecord.psicologosJaTentados ?? []), escolhido.id],
  };

  return {
    snapshot: registrarRecebimento(substituirLead(snapshot, atualizado), escolhido.id, alocadoEm),
    lead: atualizado,
    psicologo: escolhido,
  };
}

/** Por que um pedido direcionado a um psicólogo específico aguarda a Gestão. */
export type MotivoEscolhaDiretaPendente = 'INDISPONIVEL' | 'RECUSOU' | 'SEM_RESPOSTA';

/**
 * Pedido para um psicólogo específico que não pode seguir com ele vai para a
 * Gestão decidir (especificação final, 4.05, 5.04, 5.05 e seção 15) — nunca
 * para o rodízio automático. O indicado fica em `psicologosJaTentados`, e o
 * motivo é derivado do próprio registro em `motivoEscolhaDiretaPendente`:
 * sem `alocadoEm`, ele não estava apto na entrada; com `slaExpirado`, não
 * respondeu no prazo; do contrário, recusou.
 */
function devolverEscolhaDiretaAGestao(
  lead: TriagemPacienteRecord,
  psicologoIndicadoId: string,
  slaExpirado: boolean
): TriagemPacienteRecord {
  return {
    ...lead,
    status: 'PENDENTE_ATRIBUICAO',
    psicologoAlocadoId: undefined,
    psicologoNome: undefined,
    aceitoEm: undefined,
    tipoAlocacao: 'ESCOLHA_DIRETA',
    slaExpirado,
    psicologosJaTentados: [...new Set([...(lead.psicologosJaTentados ?? []), psicologoIndicadoId])],
  };
}

export function motivoEscolhaDiretaPendente(
  lead: Pick<TriagemPacienteRecord, 'status' | 'tipoAlocacao' | 'alocadoEm' | 'slaExpirado'>
): MotivoEscolhaDiretaPendente | undefined {
  if (lead.status !== 'PENDENTE_ATRIBUICAO' || lead.tipoAlocacao !== 'ESCOLHA_DIRETA') return undefined;
  if (!lead.alocadoEm) return 'INDISPONIVEL';
  return lead.slaExpirado ? 'SEM_RESPOSTA' : 'RECUSOU';
}

/**
 * Respeita a escolha explícita feita no catálogo público.
 *
 * A pessoa escolhida ainda passa pelas mesmas regras do rodízio (aprovação,
 * pausa, capacidade, serviço, modalidade e turno). A diferença é só que não
 * procuramos um substituto silenciosamente: se ela deixou de estar elegível
 * entre a abertura do catálogo e o envio, a solicitação fica registrada para a
 * Gestão decidir o destino.
 */
export function alocarLeadEscolhido(
  snapshot: PersistedSnapshot,
  leadRecord: TriagemPacienteRecord,
  psicologoId: string,
  agora: Date = new Date()
): ResultadoAlocacao {
  const atual = recalcularPacientesAtivos(snapshot);
  const escolhido = listarPsicologosCompativeis(atual, leadRecord, agora)
    .find((item) => item.id === psicologoId);
  if (!escolhido) {
    const pendente = devolverEscolhaDiretaAGestao(leadRecord, psicologoId, false);
    return { snapshot: substituirLead(atual, pendente), lead: pendente };
  }

  const alocadoEm = agora.toISOString();
  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: escolhido.id,
    psicologoNome: nomeDeExibicao(escolhido),
    ...novaOferta(atual, alocadoEm),
    tipoAlocacao: 'ESCOLHA_DIRETA',
    transbordos: leadRecord.transbordos ?? 0,
    psicologosJaTentados: [...new Set([...(leadRecord.psicologosJaTentados ?? []), escolhido.id])],
  };

  return {
    snapshot: registrarRecebimento(substituirLead(atual, atualizado), escolhido.id, alocadoEm),
    lead: atualizado,
    psicologo: escolhido,
  };
}

/**
 * Lista somente quem poderia receber este paciente pelas mesmas regras do
 * rodízio: aprovação, pausa, capacidade, turno, modalidade, serviço e perfil
 * da demanda. Rodar o motor com um candidato por vez evita uma segunda versão
 * das regras para a seleção manual da gestão.
 *
 * A preferência de gênero fica **fora** desta lista. Quem chega aqui é uma
 * escolha humana — o paciente apontando um nome no catálogo, ou a gestão
 * reatribuindo — e essas duas já são a decisão. O filtro de gênero serve para
 * o rodízio escolher sozinho; aplicá-lo aqui sumiria com nomes da tela de quem
 * está decidindo, sem dizer por quê.
 */
export function listarPsicologosCompativeis(
  snapshot: PersistedSnapshot,
  leadRecord: TriagemPacienteRecord,
  agora: Date = new Date(),
  opcoes: { ignorarCapacidade?: boolean } = {}
): CadastroPsicologoRecord[] {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = paraLeadTriagem(leadRecord, { ignorarPreferenciaGenero: true });
  if (!lead) return [];

  return rosterAtivo(atual).filter((psicologo) =>
    psicologoCompativel(paraPsicologoPerfil(psicologo, agora), lead.turno, lead.modalidade, {
      servicoDesejado: leadRecord.servicoKey,
      paraQuemE: lead.paraQuemE,
      necessidadesDesejadas: lead.necessidadesPaciente,
      formatoDesejado: lead.formatoAtendimento,
      abordagemDesejada: lead.abordagemDesejada,
      duracaoDesejadaMinutos: lead.duracaoDesejadaMinutos,
      ignorarCapacidade: opcoes.ignorarCapacidade,
    })
  );
}

export type ResultadoDevolucaoRodizio =
  | { situacao: 'alocado'; snapshot: PersistedSnapshot; lead: TriagemPacienteRecord; psicologo: CadastroPsicologoRecord }
  | { situacao: 'sem_candidato' | 'nao_aplicavel' | 'nao_encontrado'; snapshot: PersistedSnapshot; lead?: TriagemPacienteRecord; psicologo?: undefined };

/**
 * "Devolver à fila" da Gestão (especificação final, 4.05 e 6.07): um caso que
 * aguarda decisão volta ao rodízio automático pelas mesmas regras da entrada,
 * sem ser oferecido de novo a quem já teve a chance neste pedido (5.04). Sem
 * outro compatível, continua com a Gestão.
 */
export function devolverAoRodizio(
  snapshot: PersistedSnapshot,
  leadId: string,
  agora: Date = new Date(),
  opcoes: { excluirPsicologos?: readonly string[] } = {}
): ResultadoDevolucaoRodizio {
  const atual = recalcularPacientesAtivos(snapshot);
  const leadRecord = atual.triagensPacientes?.find((item) => item.id === leadId);
  if (!leadRecord) return { situacao: 'nao_encontrado', snapshot: atual };
  if (leadRecord.status !== 'PENDENTE_ATRIBUICAO') {
    return { situacao: 'nao_aplicavel', snapshot: atual, lead: leadRecord };
  }

  const lead = paraLeadTriagem(leadRecord);
  const jaTentados = leadRecord.psicologosJaTentados ?? [];
  const excluidos = new Set([...jaTentados, ...(opcoes.excluirPsicologos ?? [])]);
  const candidatos = rosterAtivo(atual).filter((psi) => !excluidos.has(psi.id));
  const resultado = lead && candidatos.length
    ? processarTriagemLead(lead, candidatos.map((psi) => paraPsicologoPerfil(psi, agora)), leadRecord.servicoKey)
    : null;
  const escolhido = resultado?.sucesso
    ? candidatos.find((psi) => psi.id === resultado.psicologoAlocado?.id)
    : undefined;
  if (!escolhido) return { situacao: 'sem_candidato', snapshot: atual, lead: leadRecord };

  const alocadoEm = agora.toISOString();
  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: escolhido.id,
    psicologoNome: nomeDeExibicao(escolhido),
    ...novaOferta(atual, alocadoEm),
    tipoAlocacao: 'RODIZIO',
    psicologosJaTentados: [...jaTentados, escolhido.id],
  };
  return {
    situacao: 'alocado',
    snapshot: recalcularPacientesAtivos(registrarRecebimento(substituirLead(atual, atualizado), escolhido.id, alocadoEm)),
    lead: atualizado,
    psicologo: escolhido,
  };
}

/** Alocação manual validada pela gestão após uma desistência. */
export function alocarLeadParaPsicologo(
  snapshot: PersistedSnapshot,
  leadRecord: TriagemPacienteRecord,
  psicologoId: string,
  confirmadoEm = new Date().toISOString(),
  opcoes: OpcoesAlocacaoGestao = {}
): ResultadoAlocacao {
  const modo: ModoAlocacaoGestao = opcoes.modo === 'PEDIR_ACEITE' ? 'PEDIR_ACEITE' : 'VINCULAR_DIRETO';
  const atual = recalcularPacientesAtivos(snapshot);
  if (opcoes.excederLimite && !opcoes.justificativaExcesso?.trim()) {
    return { snapshot: atual, lead: leadRecord };
  }
  const referencia = new Date(confirmadoEm);
  const agora = Number.isNaN(referencia.getTime()) ? new Date() : referencia;
  const psicologo = listarPsicologosCompativeis(atual, leadRecord, agora, {
    ignorarCapacidade: Boolean(opcoes.excederLimite),
  }).find((item) => item.id === psicologoId);
  if (!psicologo) return { snapshot: atual, lead: leadRecord };

  const vinculadoDireto = modo === 'VINCULAR_DIRETO';
  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: vinculadoDireto ? 'CONTATO_CONFIRMADO' : 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: psicologo.id,
    psicologoNome: nomeDeExibicao(psicologo),
    ...novaOferta(atual, confirmadoEm),
    aceitoEm: vinculadoDireto ? confirmadoEm : undefined,
    confirmadoEm: vinculadoDireto ? confirmadoEm : undefined,
    psicologosJaTentados: [...new Set([...(leadRecord.psicologosJaTentados ?? []), psicologo.id])],
  };
  const next = recalcularPacientesAtivos(
    registrarRecebimento(substituirLead(atual, atualizado), psicologo.id, confirmadoEm)
  );
  const psicologoAtualizado = next.cadastrosPsicologos?.find((item) => item.id === psicologo.id) ?? psicologo;
  return { snapshot: next, lead: atualizado, psicologo: psicologoAtualizado };
}

/**
 * Encaminhamento ou vínculo direto pela Gestão (§§ 6.07–6.08). Permite pedir
 * aceite (24h) ou vincular diretamente e autorizar excesso de capacidade com
 * justificativa obrigatória.
 */
export function reatribuirLeadPelaGestao(
  snapshot: PersistedSnapshot,
  leadId: string,
  profissionalRef: string,
  agora: Date = new Date(),
  opcoes: OpcoesAlocacaoGestao = {}
): ResultadoReatribuicaoGestao {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = (atual.triagensPacientes ?? []).find((item) => item.id === leadId);
  if (!lead) return { situacao: 'lead_nao_encontrado', snapshot: atual };
  if (lead.pacienteRef || lead.status === 'CONTATO_CONFIRMADO') {
    return { situacao: 'lead_ja_confirmado', snapshot: atual };
  }

  const psicologo = (atual.cadastrosPsicologos ?? []).find(
    (item) => item.profissionalRef === profissionalRef && item.status === 'APROVADO'
  );
  if (!psicologo) return { situacao: 'psicologo_indisponivel', snapshot: atual };

  const modo: ModoAlocacaoGestao = opcoes.modo === 'VINCULAR_DIRETO' ? 'VINCULAR_DIRETO' : 'PEDIR_ACEITE';
  const ativos = psicologo.pacientesAtivosCount ?? 0;
  const limite = psicologo.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO;
  const jaOcupavaVagaAqui = lead.psicologoAlocadoId === psicologo.id && Boolean(lead.aceitoEm);
  const excedeuLimite = !lead.projetoAcolhe && !jaOcupavaVagaAqui && ativos >= limite;

  if (excedeuLimite && !opcoes.excederLimite) {
    return { situacao: 'limite_atingido', snapshot: atual, ativos, limite, psicologo };
  }
  if (excedeuLimite && !opcoes.justificativaExcesso?.trim()) {
    return { situacao: 'justificativa_obrigatoria', snapshot: atual, ativos, limite, psicologo };
  }

  const alocadoEm = agora.toISOString();
  const primeiraAlocacao = !lead.psicologoAlocadoId;
  const mudouResponsavel = lead.psicologoAlocadoId !== psicologo.id;
  const vinculadoDireto = modo === 'VINCULAR_DIRETO';
  const atualizado: TriagemPacienteRecord = {
    ...lead,
    status: vinculadoDireto ? 'CONTATO_CONFIRMADO' : 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: psicologo.id,
    psicologoNome: nomeDeExibicao(psicologo),
    ...novaOferta(atual, alocadoEm),
    aceitoEm: vinculadoDireto ? alocadoEm : undefined,
    confirmadoEm: vinculadoDireto ? alocadoEm : undefined,
    tipoAlocacao: 'RODIZIO',
    transbordos: (lead.transbordos ?? 0) + (mudouResponsavel && lead.psicologoAlocadoId ? 1 : 0),
    psicologosJaTentados: [...new Set([...(lead.psicologosJaTentados ?? []), psicologo.id])],
  };
  const next = recalcularPacientesAtivos(
    registrarRecebimento(substituirLead(atual, atualizado), psicologo.id, alocadoEm)
  );
  const psicologoAtualizado = next.cadastrosPsicologos?.find((item) => item.id === psicologo.id) ?? psicologo;
  return {
    situacao: 'reatribuido',
    snapshot: next,
    lead: atualizado,
    psicologo: psicologoAtualizado,
    primeiraAlocacao,
    psicologoAnteriorNome: lead.psicologoNome,
    modo,
    excedeuLimite,
    ocupacaoResultante: {
      ativos: psicologoAtualizado.pacientesAtivosCount ?? ativos,
      limite: psicologoAtualizado.limitePacientesAtivos ?? limite,
    },
  };
}

/** Horas decorridas desde a alocação. `null` quando o lead nunca foi alocado. */
export function horasDesdeAlocacao(alocadoEm: string | undefined, agora = new Date()): number | null {
  if (!alocadoEm) return null;
  const inicio = new Date(alocadoEm).getTime();
  if (!Number.isFinite(inicio)) return null;
  return (agora.getTime() - inicio) / (1000 * 60 * 60);
}

/**
 * Cor do SLA. É cálculo, não campo: o que se guarda é a hora da alocação, e a
 * cor se deriva dela a cada leitura. Persistir a cor seria guardar uma verdade
 * que envelhece sozinha.
 */
export function classificarSla(
  alocadoEm: string | undefined,
  agora = new Date(),
  prazoHoras: number = SLA_CONTATO_HORAS
): SlaStatus {
  const horas = horasDesdeAlocacao(alocadoEm, agora);
  if (horas === null) return 'VERMELHO';
  if (horas >= prazoHoras) return 'VERMELHO';
  // Amarelo na metade do prazo: com 24 horas, a partir de 12 — como sempre foi.
  if (horas >= prazoHoras / 2) return 'AMARELO';
  return 'VERDE';
}

/**
 * Varre a fila e transborda quem estourou as 24h sem confirmação.
 *
 * Idempotente por construção: só mexe em lead `AGUARDANDO_CONTATO` com
 * alocação vencida, e cada transbordo reinicia o relógio. Rodar duas vezes
 * seguidas não move nada na segunda — é o que permite chamá-la tanto de um
 * agendador quanto na abertura do cockpit, sem coordenar as duas.
 *
 * Devolve os transbordos ocorridos em vez de avisar por conta própria: quem
 * chamou decide o que fazer com a lista, e uma falha de envio não desfaz uma
 * realocação já gravada.
 *
 * O prazo é medido pelo relógio real, dentro do motor. Para exercitar um
 * estouro, o que se move é a hora em `alocadoEm` — não um relógio injetado.
 *
 * `apenasLeadId` restringe a varredura a um lead: é o "forçar transbordo" da
 * gestão, que usa exatamente o mesmo caminho do automático em vez de uma rota
 * paralela que poderia divergir dele.
 */
export function varrerSla(
  snapshot: PersistedSnapshot,
  apenasLeadId?: string,
  agora: Date = new Date()
): { snapshot: PersistedSnapshot; transbordos: TransbordoOcorrido[]; alterado: boolean } {
  const transbordos: TransbordoOcorrido[] = [];
  let atual = recalcularPacientesAtivos(snapshot);
  // Nem toda alteração é um transbordo: marcar um lead como estourado quando
  // não há para quem passá-lo também muda o estado, e precisa ser gravado.
  let alterado = false;

  // O prazo vale para a oferta, não para o vínculo: depois do aceite o
  // paciente já é do profissional (especificação 5.03) e a falta de primeiro
  // agendamento vira aviso à Gestão em 48h, nunca redistribuição (7.03).
  const pendentes = (atual.triagensPacientes ?? []).filter(
    (lead) =>
      lead.status === 'AGUARDANDO_CONTATO' &&
      !lead.aceitoEm &&
      Boolean(lead.alocadoEm) &&
      (!apenasLeadId || lead.id === apenasLeadId)
  );

  for (const leadRecord of pendentes) {
    // Pedido direcionado sem resposta no prazo expira e vai para a Gestão: a
    // regra validada para ele não inclui seguir pelo rodízio.
    if (leadRecord.tipoAlocacao === 'ESCOLHA_DIRETA' && leadRecord.psicologoAlocadoId) {
      const horas = horasDesdeAlocacao(leadRecord.alocadoEm, agora);
      if (horas !== null && horas >= prazoDaOferta(leadRecord)) {
        atual = substituirLead(atual, devolverEscolhaDiretaAGestao(leadRecord, leadRecord.psicologoAlocadoId, true));
        alterado = true;
      }
      continue;
    }

    const lead = paraLeadTriagem(leadRecord);
    if (!lead) continue;

    // O roster é relido a cada iteração: um transbordo anterior nesta mesma
    // varredura já mudou a vez de quem recebe.
    const roster = rosterAtivo(atual);

    const resultado = checarEExecutarTransbordoSla(
      lead,
      roster.map((psi) => paraPsicologoPerfil(psi, agora)),
      prazoDaOferta(leadRecord),
      {
        servicoDesejado: leadRecord.servicoKey,
        psicologosJaTentados: leadRecord.psicologosJaTentados,
      }
    );

    if (!resultado.sucesso) {
      // Oferta vinda da lista de espera volta a esperar em vez de ficar presa
      // a quem não respondeu (5.07).
      if (resultado.leadAtualizado.slaExpirado && leadRecord.listaEspera && !leadRecord.listaEspera.saidaEm) {
        atual = substituirLead(atual, devolverParaEspera(leadRecord, agora, 'Prazo da oferta encerrado sem resposta.'));
        alterado = true;
        continue;
      }
      // Estourou o prazo e não havia para quem passar: registra o estouro para
      // a gestão ver, sem tirar o lead da fila.
      if (resultado.leadAtualizado.slaExpirado && !leadRecord.slaExpirado) {
        const marcado: TriagemPacienteRecord = { ...leadRecord, slaExpirado: true };
        atual = substituirLead(atual, marcado);
        alterado = true;
      }
      continue;
    }

    const novo = roster.find((psi) => psi.id === resultado.psicologoAlocado!.id)!;
    const alocadoEm = resultado.leadAtualizado.dataAlocacao ?? new Date().toISOString();

    const atualizado: TriagemPacienteRecord = {
      ...leadRecord,
      status: 'AGUARDANDO_CONTATO',
      psicologoAlocadoId: novo.id,
      psicologoNome: nomeDeExibicao(novo),
      ...novaOferta(atual, alocadoEm),
      tipoAlocacao: 'RODIZIO',
      slaExpirado: true,
      transbordos: (leadRecord.transbordos ?? 0) + 1,
      psicologosJaTentados: [...(leadRecord.psicologosJaTentados ?? []), novo.id],
    };

    atual = registrarRecebimento(substituirLead(atual, atualizado), novo.id, alocadoEm);
    alterado = true;
    transbordos.push({
      lead: atualizado,
      psicologoAnteriorId: leadRecord.psicologoAlocadoId,
      psicologoAnteriorNome: leadRecord.psicologoNome,
      psicologoNovo: novo,
    });
  }

  return { snapshot: recalcularPacientesAtivos(atual), transbordos, alterado };
}

/**
 * Confirmação de primeiro contato.
 *
 * Vive aqui, e não na rota, porque agora tem dois chamadores: o link assinado
 * do WhatsApp e a resposta `CONFIRMAR` que o profissional manda no próprio chat.
 * Duas cópias divergiriam justamente na parte delicada — o que fazer quando a
 * confirmação estoura o limite de pacientes ativos.
 */
export type ConfirmacaoResult =
  | ResultadoLotacao
  | { kind: 'not_found' }
  | { kind: 'conflict' }
  | { kind: 'expired'; lead: TriagemPacienteRecord }
  | { kind: 'already_confirmed'; data: { nomePaciente: string; telefone: string; confirmadoEm: string } }
  | { kind: 'confirmed'; lead: TriagemPacienteRecord; data: { nomePaciente: string; telefone: string; confirmadoEm: string } };

export function confirmarContato(
  snapshot: PersistedSnapshot,
  id: string,
  psicologoId: string,
  agora: Date = new Date()
): { next: PersistedSnapshot; result: ConfirmacaoResult } {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = atual.triagensPacientes?.find((item) => item.id === id);
  if (!lead) return { next: atual, result: { kind: 'not_found' } };
  if (lead.psicologoAlocadoId !== psicologoId || (lead.status !== 'AGUARDANDO_CONTATO' && lead.status !== 'CONTATO_CONFIRMADO')) {
    return { next: atual, result: { kind: 'conflict' } };
  }

  if (lead.confirmadoEm) {
    return {
      next: atual,
      result: {
        kind: 'already_confirmed',
        data: { nomePaciente: lead.nomePaciente, telefone: lead.telefone, confirmadoEm: lead.confirmadoEm },
      },
    };
  }

  if (ofertaExpirada(lead, agora)) return { next: atual, result: { kind: 'expired', lead } };

  const lotacao = redirecionarSeLotado(atual, lead, psicologoId, agora);
  if (lotacao) return lotacao;

  const confirmadoEm = agora.toISOString();
  const confirmado: TriagemPacienteRecord = { ...lead, status: 'CONTATO_CONFIRMADO', confirmadoEm };
  const next = recalcularPacientesAtivos({
    ...atual,
    triagensPacientes: (atual.triagensPacientes ?? []).map((item) => (item.id === id ? confirmado : item)),
  });
  return {
    next,
    result: {
      kind: 'confirmed',
      lead: confirmado,
      data: { nomePaciente: confirmado.nomePaciente, telefone: confirmado.telefone, confirmadoEm },
    },
  };
}

export interface ResultadoEncaminhamento {
  snapshot: PersistedSnapshot;
  situacao: 'encaminhado' | 'devolvido_gestao' | 'sem_candidato' | 'nao_encontrado' | 'nao_aplicavel' | 'ja_aceito';
  lead?: TriagemPacienteRecord;
  psicologoNovo?: CadastroPsicologoRecord;
  psicologoAnteriorNome?: string;
}

/**
 * Devolve o lead à fila por iniciativa do próprio profissional.
 *
 * É o caminho do "ENCAMINHAR" respondido no WhatsApp, e a diferença para o
 * transbordo de SLA é só o gatilho: aqui a pessoa avisa na hora que não vai
 * conseguir atender, em vez de o prazo vencer em silêncio. O critério de quem
 * recebe em seguida é o mesmo — round-robin sobre quem atende turno,
 * modalidade e serviço, pulando todos os que já tiveram a chance neste lead,
 * para o paciente não voltar para quem acabou de recusar.
 *
 * Quem recusa não é penalizado no rodízio: `ultimoLeadRecebidoEm` já foi
 * carimbado na alocação, então ele volta para o fim da fila normalmente.
 */
export function encaminharParaProximo(
  snapshot: PersistedSnapshot,
  leadId: string,
  psicologoAtualId: string,
  agora: Date = new Date(),
  motivo?: string
): ResultadoEncaminhamento {
  const atual = recalcularPacientesAtivos(snapshot);
  const leadRecord = atual.triagensPacientes?.find((item) => item.id === leadId);
  if (!leadRecord) return { snapshot: atual, situacao: 'nao_encontrado' };

  // Recusar algo já confirmado, ou que nem é mais seu, não é encaminhamento:
  // é uma mensagem atrasada chegando depois que a fila já andou.
  if (
    leadRecord.psicologoAlocadoId !== psicologoAtualId ||
    leadRecord.status !== 'AGUARDANDO_CONTATO' ||
    leadRecord.confirmadoEm
  ) {
    return { snapshot: atual, situacao: 'nao_aplicavel', lead: leadRecord };
  }

  // Depois do "Quero o paciente" ele já é paciente desse profissional. O link e
  // o WhatsApp deixam de encaminhar: a troca passa a ser decisão da clínica.
  if (leadRecord.aceitoEm) {
    return { snapshot: atual, situacao: 'ja_aceito', lead: leadRecord };
  }

  const motivoLimpo = typeof motivo === 'string' ? motivo.trim().slice(0, 300) || undefined : undefined;
  const registroRecusa: RecusaEncaminhamento = {
    psicologoId: psicologoAtualId,
    psicologoNome: leadRecord.psicologoNome,
    recusadoEm: agora.toISOString(),
    ...(motivoLimpo ? { motivo: motivoLimpo } : {}),
  };
  const recusasAtualizadas = [...(leadRecord.recusas ?? []), registroRecusa];

  // O paciente escolheu esta pessoa: a recusa leva o caso à Gestão.
  if (leadRecord.tipoAlocacao === 'ESCOLHA_DIRETA') {
    const pendente: TriagemPacienteRecord = {
      ...devolverEscolhaDiretaAGestao(leadRecord, psicologoAtualId, false),
      recusas: recusasAtualizadas,
    };
    return {
      snapshot: recalcularPacientesAtivos(substituirLead(atual, pendente)),
      situacao: 'devolvido_gestao',
      lead: pendente,
      psicologoAnteriorNome: leadRecord.psicologoNome,
    };
  }

  const lead = paraLeadTriagem(leadRecord);
  const jaTentados = [...(leadRecord.psicologosJaTentados ?? []), psicologoAtualId];
  const candidatos = rosterAtivo(atual).filter((psi) => !jaTentados.includes(psi.id));

  if (!lead || candidatos.length === 0) {
    const semDestino: TriagemPacienteRecord = devolverParaEspera(
      { ...leadRecord, recusas: recusasAtualizadas, psicologosJaTentados: [...new Set(jaTentados)] },
      agora,
      'Oferta recusada sem outro profissional compatível.'
    );
    return {
      snapshot: recalcularPacientesAtivos(substituirLead(atual, semDestino)),
      situacao: 'sem_candidato',
      lead: semDestino,
    };
  }

  const resultado = processarTriagemLead(
    lead,
    candidatos.map((psi) => paraPsicologoPerfil(psi, agora)),
    leadRecord.servicoKey
  );
  if (!resultado.sucesso || !resultado.psicologoAlocado) {
    const semDestino: TriagemPacienteRecord = devolverParaEspera(
      { ...leadRecord, recusas: recusasAtualizadas, psicologosJaTentados: [...new Set(jaTentados)] },
      agora,
      'Oferta recusada sem outro profissional compatível.'
    );
    return {
      snapshot: recalcularPacientesAtivos(substituirLead(atual, semDestino)),
      situacao: 'sem_candidato',
      lead: semDestino,
    };
  }

  const novo = candidatos.find((psi) => psi.id === resultado.psicologoAlocado!.id)!;
  const alocadoEm = resultado.leadAtualizado.dataAlocacao ?? new Date().toISOString();

  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: novo.id,
    psicologoNome: nomeDeExibicao(novo),
    // O relógio recomeça para quem acabou de receber: o prazo é de quem tem o
    // lead agora, não a sobra do prazo de quem devolveu.
    ...novaOferta(atual, alocadoEm),
    tipoAlocacao: 'RODIZIO',
    transbordos: (leadRecord.transbordos ?? 0) + 1,
    psicologosJaTentados: [...jaTentados, novo.id],
    recusas: recusasAtualizadas,
  };

  return {
    snapshot: recalcularPacientesAtivos(
      registrarRecebimento(substituirLead(atual, atualizado), novo.id, alocadoEm)
    ),
    situacao: 'encaminhado',
    lead: atualizado,
    psicologoNovo: novo,
    psicologoAnteriorNome: leadRecord.psicologoNome,
  };
}
