export const ATTENDANCE_PRICES_CENTS = {
  individual: { social: 7_500, particular: 13_000 },
  casal: { social: 15_000, particular: 26_000 },
  familia: { social: 15_000, particular: 23_000 },
  avaliacao: { social: 10_000, particular: 15_000 },
} as const;

export function resolveAttendancePricing(service: string, modality?: string) {
  const normalizedModality = modality?.trim().toUpperCase() ?? '';
  const normalizedService = service.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const category = normalizedModality.startsWith('FAMILIA_') ? 'familia'
    : normalizedModality.startsWith('CASAL_') || normalizedService.includes('casal') ? 'casal'
      : normalizedService.includes('avaliacao') ? 'avaliacao' : 'individual';
  const particular = ['PARTICULAR', 'CASAL_PARTICULAR', 'FAMILIA_PARTICULAR'].includes(normalizedModality);
  const amountCents = ATTENDANCE_PRICES_CENTS[category][particular ? 'particular' : 'social'];
  return {
    category,
    amountCents,
    modalidadeRotulo: particular ? 'Particular' : 'Acessível',
    valor: `R$ ${(amountCents / 100).toFixed(2).replace('.', ',')}`,
  };
}

export function attendancePriceLabel(service: string, modality: string): string {
  return resolveAttendancePricing(service, modality).valor;
}
