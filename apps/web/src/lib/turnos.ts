export type TurnoPreferencia = 'MANHA' | 'TARDE' | 'NOITE';

export const TURNOS_ATENDIMENTO: ReadonlyArray<{
  value: TurnoPreferencia;
  label: string;
  descricao: string;
}> = [
  { value: 'MANHA', label: 'Manhã', descricao: 'Antes das 12h' },
  { value: 'TARDE', label: 'Tarde', descricao: 'Das 12h às 18h' },
  { value: 'NOITE', label: 'Noite', descricao: 'Após as 18h' },
];

/**
 * Converte grafias históricas no único vocabulário usado pelo matching.
 * Valores desconhecidos não recebem palpite: sem uma preferência válida, o
 * encaminhamento não deve escolher um profissional pelo turno errado.
 */
export function normalizarTurnoPreferencia(value: unknown): TurnoPreferencia | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toLocaleUpperCase('pt-BR')) {
    case 'MANHA':
    case 'MANHÃ':
    case 'MATUTINO':
      return 'MANHA';
    case 'TARDE':
    case 'VESPERTINO':
      return 'TARDE';
    case 'NOITE':
    case 'NOTURNO':
      return 'NOITE';
    default:
      return null;
  }
}

/** Aceita o valor legado, a seleção do formulário e a lista persistida em VARCHAR(32). */
export function normalizarTurnosPreferencia(value: unknown): TurnoPreferencia[] {
  const valores = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const turnos = valores.map(normalizarTurnoPreferencia);
  if (turnos.some((turno) => turno === null)) return [];
  return TURNOS_ATENDIMENTO.map((turno) => turno.value).filter((turno) => turnos.includes(turno));
}

export function rotuloTurnoPreferencia(value: string | undefined): string {
  const turnos = normalizarTurnosPreferencia(value);
  return TURNOS_ATENDIMENTO.filter((turno) => turnos.includes(turno.value))
    .map((turno) => turno.label).join(', ') || 'Não informado';
}
