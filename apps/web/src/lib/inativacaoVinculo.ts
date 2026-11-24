/**
 * Inativação do vínculo (especificação final, 6.05).
 *
 * É distinta da desistência (6.06): a desistência entrega o caso à Gestão para
 * decidir um novo destino; a inativação só encerra a participação ativa do
 * paciente naquele vínculo, com motivo obrigatório, data e autor. Nas duas, a
 * vaga do psicólogo volta na hora.
 *
 * Cada inativação fica guardada para sempre no pedido. A reativação pela
 * Gestão fecha a inativação vigente sem apagá-la.
 */

export type PerfilAutorInativacao = 'PSICOLOGO' | 'GESTAO';

export interface InativacaoVinculo {
  motivo: string;
  inativadoEm: string;
  porUsuarioRef: string;
  porNome?: string;
  perfil: PerfilAutorInativacao;
  /** Psicólogo do vínculo no momento da inativação (cadastro do rodízio). */
  psicologoId?: string;
  psicologoNome?: string;
  reativadoEm?: string;
  reativadoPorUsuarioRef?: string;
  reativadoPorNome?: string;
  justificativaReativacao?: string;
}

export const MOTIVO_INATIVACAO_MINIMO = 5;
export const MOTIVO_INATIVACAO_MAXIMO = 500;

export const ROTULO_PERFIL_INATIVACAO: Record<PerfilAutorInativacao, string> = {
  PSICOLOGO: 'Psicólogo responsável',
  GESTAO: 'Gestão',
};

/** Motivo limpo ou `null` quando ausente/curto demais. */
export function motivoInativacaoValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim().replace(/\s+/g, ' ').slice(0, MOTIVO_INATIVACAO_MAXIMO);
  return limpo.length >= MOTIVO_INATIVACAO_MINIMO ? limpo : null;
}

/** A inativação que ainda vale (não reativada), se houver. */
export function inativacaoVigente(
  lead: { inativacoes?: readonly InativacaoVinculo[] | null },
): InativacaoVinculo | undefined {
  const lista = lead.inativacoes ?? [];
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    if (!lista[i].reativadoEm) return lista[i];
  }
  return undefined;
}

export function lerInativacoes(valor: unknown): InativacaoVinculo[] {
  let bruto = valor;
  if (typeof valor === 'string') {
    try {
      bruto = JSON.parse(valor) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(bruto)) return [];
  return bruto.filter((item): item is InativacaoVinculo => {
    if (!item || typeof item !== 'object') return false;
    const registro = item as Record<string, unknown>;
    return typeof registro.motivo === 'string'
      && typeof registro.inativadoEm === 'string'
      && typeof registro.porUsuarioRef === 'string'
      && (registro.perfil === 'PSICOLOGO' || registro.perfil === 'GESTAO');
  });
}
