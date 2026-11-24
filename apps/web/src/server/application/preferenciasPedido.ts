import { modalitiesForService } from '@/lib/patientCareOptions';
import {
  CAMPOS_PREFERENCIA_EDITAVEIS,
  diferencasPreferencias,
  extrairPreferencias,
  type AlteracaoPreferencias,
  type CampoPreferenciaEditavel,
  type ValorPreferencia,
} from '@/lib/preferenciasSolicitacao';
import type { PersistedSnapshot, TriagemPacienteRecord } from './persistence';

/**
 * Alteração das preferências de um pedido pela Gestão (especificação final,
 * 4.04 e 13.02). Muda os campos vivos — os que o rodízio lê — e acrescenta ao
 * histórico o antes e o depois. A fotografia original nunca é reescrita; um
 * pedido antigo, de antes de ela existir, é fotografado aqui mesmo, antes da
 * primeira mudança.
 */

export type ResultadoPreferencias =
  | { situacao: 'alterado'; snapshot: PersistedSnapshot; lead: TriagemPacienteRecord; alteracao: AlteracaoPreferencias }
  | { situacao: 'nao_encontrado' | 'sem_mudanca'; snapshot: PersistedSnapshot }
  | { situacao: 'invalido'; snapshot: PersistedSnapshot; erro: string };

export function alterarPreferenciasDoPedido(
  snapshot: PersistedSnapshot,
  leadId: string,
  valores: Partial<Record<CampoPreferenciaEditavel, ValorPreferencia>>,
  autor: { usuarioRef: string; nome?: string },
  motivo: string | undefined,
  agora: Date = new Date()
): ResultadoPreferencias {
  const lead = snapshot.triagensPacientes?.find((item) => item.id === leadId);
  if (!lead) return { situacao: 'nao_encontrado', snapshot };

  if (valores.modalidade !== undefined && lead.servicoKey) {
    const permitidas: readonly string[] = modalitiesForService(lead.servicoKey).map(([valor]) => valor);
    if (permitidas.length && !permitidas.includes(String(valores.modalidade))) {
      return { situacao: 'invalido', snapshot, erro: 'Esta faixa de valor não existe para o serviço do pedido.' };
    }
  }

  const proximo = { ...lead } as Record<string, unknown>;
  for (const campo of CAMPOS_PREFERENCIA_EDITAVEIS) {
    if (!(campo in valores)) continue;
    const valor = valores[campo];
    if (valor === undefined) delete proximo[campo];
    else proximo[campo] = valor;
  }
  if ('necessidadesPaciente' in valores || 'necessidadesOutro' in valores) {
    proximo.especificarNecessidades = Boolean(
      (proximo.necessidadesPaciente as readonly string[] | undefined)?.length || proximo.necessidadesOutro
    );
  }

  const campos = diferencasPreferencias(lead, proximo, [...CAMPOS_PREFERENCIA_EDITAVEIS, 'especificarNecessidades']);
  if (!campos.length) return { situacao: 'sem_mudanca', snapshot };

  const alteracao: AlteracaoPreferencias = {
    em: agora.toISOString(),
    porUsuarioRef: autor.usuarioRef,
    ...(autor.nome ? { porNome: autor.nome } : {}),
    ...(motivo ? { motivo } : {}),
    campos,
  };
  const atualizado: TriagemPacienteRecord = {
    ...(proximo as unknown as TriagemPacienteRecord),
    preferenciasOriginais: lead.preferenciasOriginais ?? extrairPreferencias(lead, 'RECONSTRUIDA', agora.toISOString()),
    alteracoesPreferencias: [...(lead.alteracoesPreferencias ?? []), alteracao],
  };
  return {
    situacao: 'alterado',
    snapshot: {
      ...snapshot,
      triagensPacientes: (snapshot.triagensPacientes ?? []).map((item) => (item.id === leadId ? atualizado : item)),
    },
    lead: atualizado,
    alteracao,
  };
}
