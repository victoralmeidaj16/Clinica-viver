export type PublicBookingFrequency = 'once' | 'weekly' | 'biweekly' | 'custom';

function civilDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function recurringAvailableDates(
  anchor: string,
  availableDates: readonly string[],
  frequency: PublicBookingFrequency
): string[] {
  if (frequency === 'once') return [anchor];
  if (frequency === 'custom') return [anchor];
  const interval = frequency === 'weekly' ? 7 : 14;
  const month = anchor.slice(0, 7);
  const anchorDay = civilDay(anchor);
  return availableDates.filter((date) =>
    date.startsWith(month) && civilDay(date) >= anchorDay && (civilDay(date) - anchorDay) % interval === 0
  );
}

export function commonBookingTimes(
  dates: readonly string[],
  days: readonly { dia: string; horarios: readonly { inicio: string; hora: string; modalidade: string }[] }[]
): Array<{ hora: string; modalidade: string; inicios: string[] }> {
  if (dates.length === 0) return [];
  const byDate = new Map(days.map((day) => [day.dia, day.horarios]));
  const first = byDate.get(dates[0]) ?? [];
  return first.flatMap((slot) => {
    const matches = dates.map((date) =>
      (byDate.get(date) ?? []).find((candidate) => candidate.hora === slot.hora && candidate.modalidade === slot.modalidade)
    );
    return matches.every(Boolean)
      ? [{ hora: slot.hora, modalidade: slot.modalidade, inicios: matches.map((item) => item!.inicio) }]
      : [];
  });
}
