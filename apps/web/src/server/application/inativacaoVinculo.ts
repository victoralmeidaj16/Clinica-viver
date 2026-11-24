import { inativacaoVigente, type InativacaoVinculo, type PerfilAutorInativacao } from '@/lib/inativacaoVinculo';
import { LIMITE_PACIENTES_PADRAO } from '@/lib/psychologistCapacity';
import type { PersistedSnapshot, TriagemPacienteRecord } from './persistence';
import { recalcularPacientesAtivos } from './viverMaisRodizio';

/**
 * Inativar e reativar o vínculo (especificação final, 6.05 e 13.01). Puro
 * sobre o snapshot da captação: quem grava e quem altera o cadastro clínico é
 * o serviço.
 */

export interface AutorInativacao {
  usuarioRef: string;
  nome?: string;
  perfil: PerfilAutorInativacao;
}

export type ResultadoInativacao =
  | { situacao: 'inativado' | 'reativado'; snapshot: PersistedSnapshot; lead: TriagemPacienteRecord }
  | { situacao: 'limite_atingido'; snapshot: PersistedSnapshot; ativos: number; limite: number }
  | { situacao: 'nao_encontrado' | 'nao_ativo' | 'nao_inativo' | 'psicologo_indisponivel' | 'justificativa_obrigatoria'; snapshot: PersistedSnapshot };

/** Vínculo que ocupa vaga hoje: aceito ou confirmado, com psicólogo. */
export function vinculoAtivo(lead: TriagemPacienteRecord): boolean {
  if (!lead.psicologoAlocadoId) return false;
  return lead.status === 'CONTATO_CONFIRMADO' || (lead.status === 'AGUARDANDO_CONTATO' && Boolean(lead.aceitoEm));
}

function substituir(snapshot: PersistedSnapshot, lead: TriagemPacienteRecord): PersistedSnapshot {
  return {
    ...snapshot,
    triagensPacientes: (snapshot.triagensPacientes ?? []).map((item) => (item.id === lead.id ? lead : item)),
  };
}

/**
 * Inativa o vínculo ativo. A vaga volta no mesmo instante, porque o contador é
 * derivado do status; a pausa do psicólogo no rodízio por lotação também se
 * desfaz sozinha na próxima leitura.
 */
export function inativarVinculo(
  snapshot: PersistedSnapshot,
  leadId: string,
  motivo: string,
  autor: AutorInativacao,
  agora: Date = new Date()
): ResultadoInativacao {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = atual.triagensPacientes?.find((item) => item.id === leadId);
  if (!lead) return { situacao: 'nao_encontrado', snapshot: atual };
  if (!vinculoAtivo(lead)) return { situacao: 'nao_ativo', snapshot: atual };

  const registro: InativacaoVinculo = {
    motivo,
    inativadoEm: agora.toISOString(),
    porUsuarioRef: autor.usuarioRef,
    ...(autor.nome ? { porNome: autor.nome } : {}),
    perfil: autor.perfil,
    psicologoId: lead.psicologoAlocadoId,
    ...(lead.psicologoNome ? { psicologoNome: lead.psicologoNome } : {}),
  };
  const inativado: TriagemPacienteRecord = {
    ...lead,
    status: 'INATIVO',
    inativacoes: [...(lead.inativacoes ?? []), registro],
  };
  const next = recalcularPacientesAtivos(substituir(atual, inativado));
  return {
    situacao: 'inativado',
    snapshot: next,
    lead: next.triagensPacientes?.find((item) => item.id === leadId) ?? inativado,
  };
}

/**
 * Reativação pela Gestão: o vínculo volta com o mesmo psicólogo e volta a
 * ocupar vaga. Com o limite cheio, vale a regra do 6.08 — confirmação expressa
 * e justificativa, e o contador passa a mostrar a quantidade real.
 */
export function reativarVinculo(
  snapshot: PersistedSnapshot,
  leadId: string,
  opcoes: { justificativa?: string; excederLimite?: boolean },
  autor: AutorInativacao,
  agora: Date = new Date()
): ResultadoInativacao {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = atual.triagensPacientes?.find((item) => item.id === leadId);
  if (!lead) return { situacao: 'nao_encontrado', snapshot: atual };
  const vigente = inativacaoVigente(lead);
  if (lead.status !== 'INATIVO' || !vigente) return { situacao: 'nao_inativo', snapshot: atual };

  const psicologo = atual.cadastrosPsicologos?.find((item) => item.id === lead.psicologoAlocadoId);
  if (!psicologo || psicologo.status !== 'APROVADO') return { situacao: 'psicologo_indisponivel', snapshot: atual };

  const ativos = psicologo.pacientesAtivosCount ?? 0;
  const limite = psicologo.limitePacientesAtivos ?? LIMITE_PACIENTES_PADRAO;
  const justificativa = opcoes.justificativa?.trim().replace(/\s+/g, ' ').slice(0, 500) || undefined;
  if (!lead.projetoAcolhe && ativos >= limite) {
    if (!opcoes.excederLimite) return { situacao: 'limite_atingido', snapshot: atual, ativos, limite };
    if (!justificativa) return { situacao: 'justificativa_obrigatoria', snapshot: atual };
  }

  const reativadoEm = agora.toISOString();
  const inativacoes = (lead.inativacoes ?? []).map((item) => item === vigente
    ? {
        ...item,
        reativadoEm,
        reativadoPorUsuarioRef: autor.usuarioRef,
        ...(autor.nome ? { reativadoPorNome: autor.nome } : {}),
        ...(justificativa ? { justificativaReativacao: justificativa } : {}),
      }
    : item);
  const reativado: TriagemPacienteRecord = {
    ...lead,
    // Quem já tinha contato confirmado volta confirmado; quem só tinha aceito
    // volta aceito — o aceite é o que ocupa a vaga (5.03).
    status: lead.confirmadoEm ? 'CONTATO_CONFIRMADO' : 'AGUARDANDO_CONTATO',
    aceitoEm: lead.aceitoEm ?? reativadoEm,
    inativacoes,
  };
  const next = recalcularPacientesAtivos(substituir(atual, reativado));
  return {
    situacao: 'reativado',
    snapshot: next,
    lead: next.triagensPacientes?.find((item) => item.id === leadId) ?? reativado,
  };
}
