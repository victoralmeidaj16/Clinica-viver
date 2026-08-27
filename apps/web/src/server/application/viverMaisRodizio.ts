import 'server-only';

import {
  checarEExecutarTransbordoSla,
  processarTriagemLead,
  type LeadTriagem,
  type ModalidadeAtendimento,
  type PsicologoPerfil,
  type TurnoAtendimento,
} from '@thats-life/core';
import type {
  AusenciaAgenda,
  CadastroPsicologoRecord,
  PersistedSnapshot,
  TriagemPacienteRecord,
} from './persistence';
import { normalizarTurnoPreferencia } from '@/lib/turnos';
import {
  LIMITE_PACIENTES_MAXIMO,
  LIMITE_PACIENTES_MINIMO,
  LIMITE_PACIENTES_PADRAO,
} from '@/lib/psychologistCapacity';

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

/** Limite do SLA de primeiro contato, em horas. */
export const SLA_CONTATO_HORAS = 24;

/** A partir daqui a linha fica amarela no cockpit: ainda dá tempo, mas aperta. */
const SLA_ATENCAO_HORAS = 12;

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

/**
 * Traduz a modalidade (faixa de valor) da vitrine para o vocabulário do motor.
 *
 * Atenção ao homônimo: no cadastro do psicólogo, "modalidade de atendimento"
 * quer dizer online/presencial — outro eixo, que não entra aqui.
 */
export function normalizarModalidade(valor: string | undefined): ModalidadeAtendimento | null {
  switch (valor?.trim().toUpperCase()) {
    case 'SOCIAL':
    case 'CASAL_SOCIAL':
    case 'ACESSIVEL_SOCIAL':
      return 'ACESSIVEL_SOCIAL';
    case 'PARTICULAR':
    case 'CASAL_PARTICULAR':
      return 'PARTICULAR';
    case 'AVALIACAO_PSICOLOGICA':
      return 'AVALIACAO_PSICOLOGICA';
    default:
      return null;
  }
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
    turnosDisponiveis: normalizarLista(record.turnosDisponiveis, normalizarTurno),
    modalidadesAtendidas: normalizarLista(record.modalidadesAtendidas, normalizarModalidade),
    servicosHabilitados: [...(record.servicosHabilitados ?? [])],
    publicoAlvo: record.publicoAlvo ? [...record.publicoAlvo] : undefined,
    especificarNecessidades: record.especificarNecessidades,
    necessidadesAtendidas: record.necessidadesAtendidas ? [...record.necessidadesAtendidas] : undefined,
    necessidadesOutro: record.necessidadesOutro,
    limitePacientesAtivos: record.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO,
    pacientesAtivosCount: record.pacientesAtivosCount ?? 0,
    exibirNaVitrine: record.exibirNaVitrine ?? true,
    motivoDesativacao: record.motivoDesativacao,
    // Férias na agenda pausam sem apagar a pausa manual: as duas somam, e
    // quando as férias acabam continua valendo o que a gestão decidiu.
    pausadoNoRodizio: (record.pausadoNoRodizio ?? false) || Boolean(ausenciaVigente(record, agora)),
    posicaoFilaRoundRobin: 0,
    ultimoLeadRecebidoEm: record.ultimoLeadRecebidoEm,
    saldoCreditoAbatimento: 0,
    turmaViverMais: record.turmaViverMais,
    posGraduacaoViverMais: record.posGraduacaoViverMais,
  };
}

/** Profissionais aprovados — os únicos que o rodízio enxerga. */
export function rosterAtivo(snapshot: PersistedSnapshot): CadastroPsicologoRecord[] {
  return (snapshot.cadastrosPsicologos ?? []).filter((psi) => psi.status === 'APROVADO');
}

/** Monta o lead no formato do motor. Só os campos que a indicação usa importam. */
function paraLeadTriagem(record: TriagemPacienteRecord): LeadTriagem | null {
  const turno = normalizarTurno(record.turno);
  const modalidade = normalizarModalidade(record.modalidade);
  if (!turno || !modalidade) return null;

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
export function recalcularPacientesAtivos(snapshot: PersistedSnapshot): PersistedSnapshot {
  const contagem = new Map<string, number>();
  for (const lead of snapshot.triagensPacientes ?? []) {
    if (lead.status !== 'CONTATO_CONFIRMADO' || !lead.psicologoAlocadoId) continue;
    contagem.set(lead.psicologoAlocadoId, (contagem.get(lead.psicologoAlocadoId) ?? 0) + 1);
  }
  return {
    ...snapshot,
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
    alocadoEm,
    slaExpirado: false,
    transbordos: leadRecord.transbordos ?? 0,
    psicologosJaTentados: [...(leadRecord.psicologosJaTentados ?? []), escolhido.id],
  };

  return {
    snapshot: registrarRecebimento(substituirLead(snapshot, atualizado), escolhido.id, alocadoEm),
    lead: atualizado,
    psicologo: escolhido,
  };
}

/**
 * Respeita a escolha explícita feita no catálogo público.
 *
 * A pessoa escolhida ainda passa pelas mesmas regras do rodízio (aprovação,
 * pausa, capacidade, serviço, modalidade e turno). A diferença é só que não
 * procuramos um substituto silenciosamente: se ela deixou de estar elegível
 * entre a abertura do catálogo e o envio, o chamador pede uma nova escolha.
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
  if (!escolhido) return { snapshot: atual, lead: leadRecord };

  const alocadoEm = agora.toISOString();
  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: escolhido.id,
    psicologoNome: nomeDeExibicao(escolhido),
    alocadoEm,
    slaExpirado: false,
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
 */
export function listarPsicologosCompativeis(
  snapshot: PersistedSnapshot,
  leadRecord: TriagemPacienteRecord,
  agora: Date = new Date()
): CadastroPsicologoRecord[] {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = paraLeadTriagem(leadRecord);
  if (!lead) return [];

  return rosterAtivo(atual).filter((psicologo) =>
    processarTriagemLead(
      lead,
      [paraPsicologoPerfil(psicologo, agora)],
      leadRecord.servicoKey
    ).sucesso
  );
}

/** Alocação manual validada, usada pela gestão após uma desistência. */
export function alocarLeadParaPsicologo(
  snapshot: PersistedSnapshot,
  leadRecord: TriagemPacienteRecord,
  psicologoId: string,
  confirmadoEm = new Date().toISOString()
): ResultadoAlocacao {
  const atual = recalcularPacientesAtivos(snapshot);
  const psicologo = listarPsicologosCompativeis(atual, leadRecord)
    .find((item) => item.id === psicologoId);
  if (!psicologo) return { snapshot: atual, lead: leadRecord };

  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: 'CONTATO_CONFIRMADO',
    psicologoAlocadoId: psicologo.id,
    psicologoNome: nomeDeExibicao(psicologo),
    alocadoEm: confirmadoEm,
    confirmadoEm,
    slaExpirado: false,
    psicologosJaTentados: [...new Set([...(leadRecord.psicologosJaTentados ?? []), psicologo.id])],
  };
  const next = registrarRecebimento(substituirLead(atual, atualizado), psicologo.id, confirmadoEm);
  return { snapshot: recalcularPacientesAtivos(next), lead: atualizado, psicologo };
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
export function classificarSla(alocadoEm: string | undefined, agora = new Date()): SlaStatus {
  const horas = horasDesdeAlocacao(alocadoEm, agora);
  if (horas === null) return 'VERMELHO';
  if (horas >= SLA_CONTATO_HORAS) return 'VERMELHO';
  if (horas >= SLA_ATENCAO_HORAS) return 'AMARELO';
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

  const pendentes = (atual.triagensPacientes ?? []).filter(
    (lead) =>
      lead.status === 'AGUARDANDO_CONTATO' &&
      Boolean(lead.alocadoEm) &&
      (!apenasLeadId || lead.id === apenasLeadId)
  );

  for (const leadRecord of pendentes) {
    const lead = paraLeadTriagem(leadRecord);
    if (!lead) continue;

    // O roster é relido a cada iteração: um transbordo anterior nesta mesma
    // varredura já mudou a vez de quem recebe.
    const roster = rosterAtivo(atual);

    const resultado = checarEExecutarTransbordoSla(
      lead,
      roster.map((psi) => paraPsicologoPerfil(psi, agora)),
      SLA_CONTATO_HORAS,
      {
        servicoDesejado: leadRecord.servicoKey,
        psicologosJaTentados: leadRecord.psicologosJaTentados,
      }
    );

    if (!resultado.sucesso) {
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
      alocadoEm,
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

  return { snapshot: atual, transbordos, alterado };
}

/**
 * Confirmação de primeiro contato.
 *
 * Vive aqui, e não na rota, porque agora tem dois chamadores: o link assinado
 * do WhatsApp e a resposta `CONTATO` que o profissional manda no próprio chat.
 * Duas cópias divergiriam justamente na parte delicada — o que fazer quando a
 * confirmação estoura o limite de pacientes ativos.
 */
export type ConfirmacaoResult =
  | { kind: 'not_found' }
  | { kind: 'conflict' }
  | { kind: 'capacity_reallocated'; lead: TriagemPacienteRecord; psicologo: CadastroPsicologoRecord }
  | { kind: 'capacity_pending'; lead: TriagemPacienteRecord; psicologo?: undefined }
  | { kind: 'already_confirmed'; data: { nomePaciente: string; telefone: string; confirmadoEm: string } }
  | { kind: 'confirmed'; data: { nomePaciente: string; telefone: string; confirmadoEm: string } };

export function confirmarContato(
  snapshot: PersistedSnapshot,
  id: string,
  psicologoId: string
): { next: PersistedSnapshot; result: ConfirmacaoResult } {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = atual.triagensPacientes?.find((item) => item.id === id);
  if (!lead) return { next: atual, result: { kind: 'not_found' } };
  if (lead.psicologoAlocadoId !== psicologoId) return { next: atual, result: { kind: 'conflict' } };

  if (lead.confirmadoEm) {
    return {
      next: atual,
      result: {
        kind: 'already_confirmed',
        data: { nomePaciente: lead.nomePaciente, telefone: lead.telefone, confirmadoEm: lead.confirmadoEm },
      },
    };
  }

  const psicologo = atual.cadastrosPsicologos?.find((item) => item.id === psicologoId);
  if (psicologo && (psicologo.pacientesAtivosCount ?? 0) >= (psicologo.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO)) {
    const paraRealocar: TriagemPacienteRecord = {
      ...lead,
      status: 'PENDENTE_ATRIBUICAO',
      psicologoAlocadoId: undefined,
      psicologoNome: undefined,
      alocadoEm: undefined,
      confirmadoEm: undefined,
      slaExpirado: false,
    };
    const base = {
      ...atual,
      triagensPacientes: (atual.triagensPacientes ?? []).map((item) => (item.id === id ? paraRealocar : item)),
    };
    const realocado = alocarLead(base, paraRealocar);
    return realocado.psicologo
      ? {
          next: realocado.snapshot,
          result: { kind: 'capacity_reallocated', lead: realocado.lead, psicologo: realocado.psicologo },
        }
      : { next: realocado.snapshot, result: { kind: 'capacity_pending', lead: realocado.lead } };
  }

  const confirmadoEm = new Date().toISOString();
  const confirmado: TriagemPacienteRecord = { ...lead, status: 'CONTATO_CONFIRMADO', confirmadoEm };
  const next = recalcularPacientesAtivos({
    ...atual,
    triagensPacientes: (atual.triagensPacientes ?? []).map((item) => (item.id === id ? confirmado : item)),
  });
  return {
    next,
    result: {
      kind: 'confirmed',
      data: { nomePaciente: confirmado.nomePaciente, telefone: confirmado.telefone, confirmadoEm },
    },
  };
}

export interface ResultadoEncaminhamento {
  snapshot: PersistedSnapshot;
  situacao: 'encaminhado' | 'sem_candidato' | 'nao_encontrado' | 'nao_aplicavel';
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
  agora: Date = new Date()
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

  const lead = paraLeadTriagem(leadRecord);
  const jaTentados = [...(leadRecord.psicologosJaTentados ?? []), psicologoAtualId];
  const candidatos = rosterAtivo(atual).filter((psi) => !jaTentados.includes(psi.id));

  if (!lead || candidatos.length === 0) {
    return { snapshot: atual, situacao: 'sem_candidato', lead: leadRecord };
  }

  const resultado = processarTriagemLead(
    lead,
    candidatos.map((psi) => paraPsicologoPerfil(psi, agora)),
    leadRecord.servicoKey
  );
  if (!resultado.sucesso || !resultado.psicologoAlocado) {
    return { snapshot: atual, situacao: 'sem_candidato', lead: leadRecord };
  }

  const novo = candidatos.find((psi) => psi.id === resultado.psicologoAlocado!.id)!;
  const alocadoEm = resultado.leadAtualizado.dataAlocacao ?? new Date().toISOString();

  const atualizado: TriagemPacienteRecord = {
    ...leadRecord,
    status: 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: novo.id,
    psicologoNome: nomeDeExibicao(novo),
    alocadoEm,
    // O relógio recomeça para quem acabou de receber: o prazo é de quem tem o
    // lead agora, não a sobra do prazo de quem devolveu.
    slaExpirado: false,
    transbordos: (leadRecord.transbordos ?? 0) + 1,
    psicologosJaTentados: [...jaTentados, novo.id],
  };

  return {
    snapshot: registrarRecebimento(substituirLead(atual, atualizado), novo.id, alocadoEm),
    situacao: 'encaminhado',
    lead: atualizado,
    psicologoNovo: novo,
    psicologoAnteriorNome: leadRecord.psicologoNome,
  };
}
