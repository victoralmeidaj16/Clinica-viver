/** Formatação compartilhada; os valores reais vêm do perfil no MySQL. */

export type ModalidadePagamentoSlug = 'social' | 'particular';

export function reaisDeCentavos(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}
