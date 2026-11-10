/** Converte horas fracionárias do SLA em leitura direta (minutos, horas ou dias). */
export function formatarTempoDecorrido(horas: number | null | undefined): string {
  if (horas === null || horas === undefined || !Number.isFinite(horas)) return '—';

  const totalMinutos = Math.max(0, Math.round(horas * 60));
  if (totalMinutos < 1) return '< 1 min';
  if (totalMinutos < 60) return `${totalMinutos} min`;

  const totalHoras = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (totalHoras < 24) {
    return minutos > 0 ? `${totalHoras}h ${minutos}min` : `${totalHoras}h`;
  }

  const dias = Math.floor(totalHoras / 24);
  const horasRestantes = totalHoras % 24;
  const rotuloDias = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return horasRestantes > 0 ? `${rotuloDias} e ${horasRestantes}h` : rotuloDias;
}
