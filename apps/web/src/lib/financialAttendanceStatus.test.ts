import { describe, expect, it } from 'vitest';
import { financialAttendanceStatus } from './financialAttendanceStatus';

describe('financialAttendanceStatus', () => {
  it.each(['realizado', 'completed'])('considera %s como realizado', (status) => {
    expect(financialAttendanceStatus(status)).toBe('realizado');
  });

  it.each(['cancelado', 'cancelled'])('considera %s como cancelado', (status) => {
    expect(financialAttendanceStatus(status)).toBe('cancelado');
  });

  it.each(['faltou', 'no_show'])('considera %s como falta', (status) => {
    expect(financialAttendanceStatus(status)).toBe('falta');
  });

  it.each(['agendado', 'confirmado', 'scheduled', 'confirmed', undefined])(
    'mantém %s a confirmar até a conclusão explícita',
    (status) => {
      expect(financialAttendanceStatus(status)).toBe('a_confirmar');
    }
  );
});
