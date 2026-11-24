import 'server-only';

import {
  naListaDeEspera,
  ordenarListaDeEspera,
  ROTULO_MODO_LISTA_ESPERA,
  type EventoListaEspera,
  type ListaEsperaRegistro,
  type ModoListaEspera,
} from '@/lib/listaEspera';
import { LIMITE_PACIENTES_PADRAO } from '@/lib/psychologistCapacity';
import type { CadastroPsicologoRecord, PersistedSnapshot, TriagemPacienteRecord } from './persistence';
import { devolverAoRodizio, recalcularPacientesAtivos, rosterAtivo } from './viverMaisRodizio';

/**
 * Comandos da lista de espera e a oferta automática (especificação final,
 * 5.06 e 5.07). Funções puras sobre o snapshot, como o resto do rodízio: quem
 * grava e quem avisa é o chamador.
 */

export interface AutorAcao {
  usuarioRef: string;
  nome?: string;
}

export type ResultadoListaEspera =
  | { situacao: 'ok'; snapshot: PersistedSnapshot; lead: TriagemPacienteRecord }
  | {
      situacao: 'nao_encontrado' | 'nao_aplicavel' | 'ja_na_lista' | 'fora_da_lista' | 'motivo_obrigatorio' | 'sem_mudanca';
      snapshot: PersistedSnapshot;
      lead?: TriagemPacienteRecord;
    };

function substituir(snapshot: PersistedSnapshot, lead: TriagemPacienteRecord): PersistedSnapshot {
  return {
    ...snapshot,
    triagensPacientes: (snapshot.triagensPacientes ?? []).map((item) => (item.id === lead.id ? lead : item)),
  };
}

function evento(tipo: EventoListaEspera['tipo'], autor: AutorAcao | undefined, agora: Date, detalhe?: string): EventoListaEspera {
  return {
    tipo,
    em: agora.toISOString(),
    ...(autor ? { porUsuarioRef: autor.usuarioRef, ...(autor.nome ? { porNome: autor.nome } : {}) } : {}),
    ...(detalhe ? { detalhe } : {}),
  };
}

function limpar(valor: string | undefined, maximo = 500): string | undefined {
  const limpo = valor?.trim().replace(/\s+/g, ' ').slice(0, maximo);
  return limpo || undefined;
}

/**
 * Coloca na lista um pedido que aguarda a Gestão. Uma nova entrada abre nova
 * permanência com a data de hoje, mas mantém os eventos das anteriores.
 */
export function colocarNaListaDeEspera(
  snapshot: PersistedSnapshot,
  leadId: string,
  opcoes: { modo: ModoListaEspera; prioritario?: boolean; motivoPrioridade?: string },
  autor: AutorAcao,
  agora: Date = new Date()
): ResultadoListaEspera {
  const lead = snapshot.triagensPacientes?.find((item) => item.id === leadId);
  if (!lead) return { situacao: 'nao_encontrado', snapshot };
  if (naListaDeEspera(lead)) return { situacao: 'ja_na_lista', snapshot, lead };
  if (lead.status !== 'PENDENTE_ATRIBUICAO') return { situacao: 'nao_aplicavel', snapshot, lead };
  const motivoPrioridade = limpar(opcoes.motivoPrioridade);
  if (opcoes.prioritario && !motivoPrioridade) return { situacao: 'motivo_obrigatorio', snapshot, lead };

  const registro: ListaEsperaRegistro = {
    modo: opcoes.modo,
    entradaEm: agora.toISOString(),
    ...(opcoes.prioritario ? { prioritario: true, motivoPrioridade } : {}),
    eventos: [
      ...(lead.listaEspera?.eventos ?? []),
      evento('ENTRADA', autor, agora, `Modo ${ROTULO_MODO_LISTA_ESPERA[opcoes.modo].toLowerCase()}${opcoes.prioritario ? `, prioritário: ${motivoPrioridade}` : ''}`),
    ],
  };
  const atualizado = { ...lead, listaEspera: registro };
  return { situacao: 'ok', snapshot: substituir(snapshot, atualizado), lead: atualizado };
}

/** Troca o modo ou a prioridade de quem está na lista, registrando o movimento. */
export function alterarListaDeEspera(
  snapshot: PersistedSnapshot,
  leadId: string,
  opcoes: { modo?: ModoListaEspera; prioritario?: boolean; motivoPrioridade?: string },
  autor: AutorAcao,
  agora: Date = new Date()
): ResultadoListaEspera {
  const lead = snapshot.triagensPacientes?.find((item) => item.id === leadId);
  if (!lead) return { situacao: 'nao_encontrado', snapshot };
  if (!naListaDeEspera(lead) || !lead.listaEspera) return { situacao: 'fora_da_lista', snapshot, lead };

  let registro = lead.listaEspera;
  const eventos = [...registro.eventos];
  if (opcoes.modo && opcoes.modo !== registro.modo) {
    eventos.push(evento('MODO_ALTERADO', autor, agora,
      `${ROTULO_MODO_LISTA_ESPERA[registro.modo]} → ${ROTULO_MODO_LISTA_ESPERA[opcoes.modo]}`));
    registro = { ...registro, modo: opcoes.modo };
  }
  if (opcoes.prioritario !== undefined && opcoes.prioritario !== Boolean(registro.prioritario)) {
    const motivo = limpar(opcoes.motivoPrioridade);
    if (opcoes.prioritario && !motivo) return { situacao: 'motivo_obrigatorio', snapshot, lead };
    eventos.push(evento('PRIORIDADE_ALTERADA', autor, agora,
      opcoes.prioritario ? `Prioridade excepcional: ${motivo}` : `Volta à ordem de entrada${motivo ? `: ${motivo}` : ''}`));
    registro = opcoes.prioritario
      ? { ...registro, prioritario: true, motivoPrioridade: motivo }
      : { ...registro, prioritario: undefined, motivoPrioridade: undefined };
  }
  if (eventos.length === registro.eventos.length) return { situacao: 'sem_mudanca', snapshot, lead };
  const atualizado = { ...lead, listaEspera: { ...registro, eventos } };
  return { situacao: 'ok', snapshot: substituir(snapshot, atualizado), lead: atualizado };
}

/** Retirada pela Gestão. O pedido continua com ela, fora da lista. */
export function retirarDaListaDeEspera(
  snapshot: PersistedSnapshot,
  leadId: string,
  motivo: string | undefined,
  autor: AutorAcao,
  agora: Date = new Date()
): ResultadoListaEspera {
  const lead = snapshot.triagensPacientes?.find((item) => item.id === leadId);
  if (!lead) return { situacao: 'nao_encontrado', snapshot };
  if (!naListaDeEspera(lead) || !lead.listaEspera) return { situacao: 'fora_da_lista', snapshot, lead };
  const atualizado: TriagemPacienteRecord = {
    ...lead,
    listaEspera: {
      ...lead.listaEspera,
      saidaEm: agora.toISOString(),
      motivoSaida: 'RETIRADA_GESTAO',
      eventos: [...lead.listaEspera.eventos, evento('SAIDA', autor, agora, limpar(motivo) ?? 'Retirado pela Gestão.')],
    },
  };
  return { situacao: 'ok', snapshot: substituir(snapshot, atualizado), lead: atualizado };
}

/**
 * Profissionais sem vaga livre quando se contam as ofertas pendentes.
 *
 * A oferta não ocupa vaga (5.02), e para o rodízio das solicitações novas isso
 * continua valendo. Na lista de espera, porém, uma vaga liberada não pode virar
 * três ofertas simultâneas ao mesmo psicólogo: cada oferta pendente reserva,
 * só para esta conta, uma das vagas livres.
 */
function semVagaParaLista(snapshot: PersistedSnapshot): string[] {
  const pendentes = new Map<string, number>();
  for (const lead of snapshot.triagensPacientes ?? []) {
    if (lead.status !== 'AGUARDANDO_CONTATO' || lead.aceitoEm || lead.projetoAcolhe || !lead.psicologoAlocadoId) continue;
    pendentes.set(lead.psicologoAlocadoId, (pendentes.get(lead.psicologoAlocadoId) ?? 0) + 1);
  }
  return rosterAtivo(snapshot)
    .filter((psi) => (psi.pacientesAtivosCount ?? 0) + (pendentes.get(psi.id) ?? 0)
      >= (psi.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO))
    .map((psi) => psi.id);
}

export interface OfertaDaLista {
  lead: TriagemPacienteRecord;
  psicologo: CadastroPsicologoRecord;
}

/**
 * Oferece as vagas compatíveis a quem está na lista automática, na ordem da
 * lista. Cada oferta segue o caminho do "Devolver ao rodízio" — mesmas regras,
 * mesmo prazo, sem repetir quem já recusou ou deixou vencer este pedido.
 * Idempotente: sem vaga nova, não muda nada.
 */
export function processarListaDeEspera(
  snapshot: PersistedSnapshot,
  agora: Date = new Date()
): { snapshot: PersistedSnapshot; ofertas: OfertaDaLista[]; alterado: boolean } {
  let atual = recalcularPacientesAtivos(snapshot);
  const ofertas: OfertaDaLista[] = [];
  const fila = ordenarListaDeEspera(atual.triagensPacientes ?? [])
    .filter((lead) => lead.status === 'PENDENTE_ATRIBUICAO' && lead.listaEspera?.modo === 'AUTOMATICO');

  for (const lead of fila) {
    const resultado = devolverAoRodizio(atual, lead.id, agora, { excluirPsicologos: semVagaParaLista(atual) });
    if (resultado.situacao !== 'alocado' || !resultado.lead.listaEspera) continue;
    const ofertado: TriagemPacienteRecord = {
      ...resultado.lead,
      listaEspera: {
        ...resultado.lead.listaEspera,
        eventos: [
          ...resultado.lead.listaEspera.eventos,
          evento('OFERTA', undefined, agora, `Vaga compatível oferecida a ${resultado.psicologo.nomeSocial?.trim() || resultado.psicologo.nomeCompleto}.`),
        ],
      },
    };
    atual = substituir(resultado.snapshot, ofertado);
    ofertas.push({ lead: ofertado, psicologo: resultado.psicologo });
  }

  return { snapshot: atual, ofertas, alterado: ofertas.length > 0 };
}
