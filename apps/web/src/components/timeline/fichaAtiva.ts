import type { ClinicalTimelineEntry } from '@thats-life/core';

/**
 * Ficha clínica ativa na linha do tempo.
 *
 * Tudo o que a tela carrega vem acompanhado do paciente a que pertence. Assim,
 * ao trocar de ficha, o cabeçalho e a lista nunca mostram pessoas diferentes:
 * enquanto a nova consulta não chega — ou se ela falhar —, a tela fica sem
 * registros, e não com os da ficha anterior (especificação final, § 8.04).
 */
export interface DaFicha<T> {
  patientId: string;
  valor: T;
}

export function daFichaAtiva<T>(dados: DaFicha<T> | null, patientId: string): T | undefined {
  return dados && dados.patientId === patientId ? dados.valor : undefined;
}

/** Rascunho de prontuário manual, preso ao paciente em que foi aberto. */
export interface RascunhoProntuario {
  patientId: string;
  titulo: string;
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
}

export function novoRascunho(patientId: string): RascunhoProntuario {
  return { patientId, titulo: '', subjetivo: '', objetivo: '', avaliacao: '', plano: '' };
}

export function rascunhoTemConteudo(rascunho: RascunhoProntuario | null): boolean {
  if (!rascunho) return false;
  return [rascunho.titulo, rascunho.subjetivo, rascunho.objetivo, rascunho.avaliacao, rascunho.plano]
    .some((campo) => campo.trim().length > 0);
}

/**
 * Corpo da gravação. O paciente vem do próprio rascunho, e não da ficha
 * selecionada na hora de salvar: um texto começado para uma pessoa não pode
 * terminar no prontuário de outra.
 */
export function corpoDoRascunho(rascunho: RascunhoProntuario) {
  return {
    patientId: rascunho.patientId,
    title: rascunho.titulo,
    subjective: rascunho.subjetivo,
    objective: rascunho.objetivo,
    assessment: rascunho.avaliacao,
    plan: rascunho.plano,
  };
}

/**
 * Junta o registro recém-salvo à lista da ficha de origem. Se a ficha mudou
 * enquanto a gravação acontecia, a lista exibida é de outro paciente e fica
 * intacta.
 */
export function incorporarRegistrosSalvos(
  atual: DaFicha<ClinicalTimelineEntry[]> | null,
  origem: string,
  salvos: readonly ClinicalTimelineEntry[]
): DaFicha<ClinicalTimelineEntry[]> | null {
  if (!atual || atual.patientId !== origem) return atual;
  return {
    patientId: origem,
    valor: [...salvos, ...atual.valor.filter((entry) => !salvos.some((salvo) => salvo.id === entry.id))],
  };
}
