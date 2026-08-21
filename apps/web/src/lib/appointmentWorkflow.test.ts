import { describe, expect, it } from 'vitest';
import { podeConfirmarRealizacao } from './appointmentWorkflow';

const agora = new Date('2026-08-21T18:00:00.000Z');

describe('confirmação de realização da sessão', () => {
  it('não libera antes do fim previsto', () => {
    expect(podeConfirmarRealizacao('agendado', '2026-08-21T18:00:00.001Z', agora)).toBe(false);
  });

  it('libera exatamente no fim e depois dele', () => {
    expect(podeConfirmarRealizacao('agendado', '2026-08-21T18:00:00.000Z', agora)).toBe(true);
    expect(podeConfirmarRealizacao('confirmado', '2026-08-20T18:00:00.000Z', agora)).toBe(true);
  });

  it.each(['realizado', 'cancelado', 'faltou'])('não libera para o status %s', (status) => {
    expect(podeConfirmarRealizacao(status, '2026-08-20T18:00:00.000Z', agora)).toBe(false);
  });
});

