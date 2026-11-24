/**
 * Lista de espera da Gestão (especificação final, 5.06 e 5.07).
 *
 * A entrada é sempre uma decisão da Gestão sobre um pedido que não encontrou
 * profissional. No modo automático, a vaga compatível que surgir é oferecida a
 * quem espera há mais tempo — salvo prioridade definida expressamente pela
 * Gestão. No manual, o pedido continua parado até a Gestão decidir. Nada disso
 * bloqueia o rodízio das solicitações novas do site.
 *
 * O registro mora no próprio pedido e nunca é apagado: a saída fecha a
 * permanência (`saidaEm`) e cada movimento entra em `eventos`, que é o que a
 * Gestão consulta como histórico.
 */

export type ModoListaEspera = 'AUTOMATICO' | 'MANUAL';

export type MotivoSaidaListaEspera =
  | 'ACEITE'
  | 'VINCULO_DIRETO'
  | 'RETIRADA_GESTAO'
  | 'DESISTENCIA'
  | 'INATIVACAO'
  | 'ENCERRADO';

export type TipoEventoListaEspera =
  | 'ENTRADA'
  | 'MODO_ALTERADO'
  | 'PRIORIDADE_ALTERADA'
  | 'OFERTA'
  | 'RETORNO'
  | 'SAIDA';

export interface EventoListaEspera {
  tipo: TipoEventoListaEspera;
  em: string;
  porUsuarioRef?: string;
  porNome?: string;
  detalhe?: string;
}

export interface ListaEsperaRegistro {
  modo: ModoListaEspera;
  entradaEm: string;
  /** Prioridade excepcional definida pela Gestão: passa à frente de quem entrou antes. */
  prioritario?: boolean;
  motivoPrioridade?: string;
  saidaEm?: string;
  motivoSaida?: MotivoSaidaListaEspera;
  eventos: readonly EventoListaEspera[];
}

export const ROTULO_MODO_LISTA_ESPERA: Record<ModoListaEspera, string> = {
  AUTOMATICO: 'Automático',
  MANUAL: 'Manual',
};

export const ROTULO_SAIDA_LISTA_ESPERA: Record<MotivoSaidaListaEspera, string> = {
  ACEITE: 'Aceito por um psicólogo',
  VINCULO_DIRETO: 'Vinculado diretamente pela Gestão',
  RETIRADA_GESTAO: 'Retirado da lista pela Gestão',
  DESISTENCIA: 'Desistência registrada',
  INATIVACAO: 'Vínculo inativado',
  ENCERRADO: 'Pedido encerrado',
};

export const ROTULO_EVENTO_LISTA_ESPERA: Record<TipoEventoListaEspera, string> = {
  ENTRADA: 'Entrou na lista',
  MODO_ALTERADO: 'Modo alterado',
  PRIORIDADE_ALTERADA: 'Prioridade alterada',
  OFERTA: 'Oferta enviada',
  RETORNO: 'Voltou a aguardar',
  SAIDA: 'Saiu da lista',
};

export function modoListaEsperaValido(valor: unknown): valor is ModoListaEspera {
  return valor === 'AUTOMATICO' || valor === 'MANUAL';
}

/** Permanência aberta na lista, com ou sem oferta em andamento. */
export function naListaDeEspera(lead: { listaEspera?: ListaEsperaRegistro | null }): boolean {
  return Boolean(lead.listaEspera && !lead.listaEspera.saidaEm);
}

function instante(valor: string | undefined): number {
  const momento = valor ? Date.parse(valor) : Number.NaN;
  return Number.isFinite(momento) ? momento : Number.MAX_SAFE_INTEGER;
}

/**
 * Ordem de atendimento da lista: prioridade excepcional primeiro e, dentro de
 * cada grupo, a data de entrada. O protocolo desempata para a ordem não mudar
 * entre duas leituras do mesmo estado.
 */
export function compararListaDeEspera(
  a: { protocolo?: string; listaEspera?: ListaEsperaRegistro | null },
  b: { protocolo?: string; listaEspera?: ListaEsperaRegistro | null },
): number {
  const prioridade = Number(Boolean(b.listaEspera?.prioritario)) - Number(Boolean(a.listaEspera?.prioritario));
  if (prioridade) return prioridade;
  const entrada = instante(a.listaEspera?.entradaEm) - instante(b.listaEspera?.entradaEm);
  if (entrada) return entrada;
  return (a.protocolo ?? '').localeCompare(b.protocolo ?? '');
}

export function ordenarListaDeEspera<T extends { protocolo?: string; listaEspera?: ListaEsperaRegistro | null }>(
  leads: readonly T[],
): T[] {
  return leads.filter(naListaDeEspera).sort(compararListaDeEspera);
}

/** Posição (1 = próximo) entre quem continua na lista, ou `undefined` fora dela. */
export function posicaoNaListaDeEspera<T extends { id: string; protocolo?: string; listaEspera?: ListaEsperaRegistro | null }>(
  leads: readonly T[],
  leadId: string,
): number | undefined {
  const indice = ordenarListaDeEspera(leads).findIndex((lead) => lead.id === leadId);
  return indice === -1 ? undefined : indice + 1;
}

/** Lê o JSON gravado, descartando o que não tiver a forma mínima. */
export function lerListaEspera(valor: unknown): ListaEsperaRegistro | undefined {
  let bruto = valor;
  if (typeof valor === 'string') {
    try {
      bruto = JSON.parse(valor) as unknown;
    } catch {
      return undefined;
    }
  }
  if (!bruto || typeof bruto !== 'object') return undefined;
  const registro = bruto as Record<string, unknown>;
  if (!modoListaEsperaValido(registro.modo) || typeof registro.entradaEm !== 'string') return undefined;
  const eventos = Array.isArray(registro.eventos)
    ? registro.eventos.filter((item): item is EventoListaEspera =>
        Boolean(item) && typeof (item as EventoListaEspera).tipo === 'string' && typeof (item as EventoListaEspera).em === 'string')
    : [];
  return {
    modo: registro.modo,
    entradaEm: registro.entradaEm,
    ...(registro.prioritario === true ? { prioritario: true } : {}),
    ...(typeof registro.motivoPrioridade === 'string' && registro.motivoPrioridade ? { motivoPrioridade: registro.motivoPrioridade } : {}),
    ...(typeof registro.saidaEm === 'string' ? { saidaEm: registro.saidaEm } : {}),
    ...(typeof registro.motivoSaida === 'string' && registro.motivoSaida in ROTULO_SAIDA_LISTA_ESPERA
      ? { motivoSaida: registro.motivoSaida as MotivoSaidaListaEspera }
      : {}),
    eventos,
  };
}
