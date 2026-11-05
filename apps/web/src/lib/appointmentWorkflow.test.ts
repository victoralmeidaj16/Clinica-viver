import { describe, expect, it } from 'vitest';
import { faltaCobrada, podeConfirmarRealizacao, podeRegistrarFalta, possuiPagamento } from './appointmentWorkflow';

const agora = new Date('2026-08-21T18:00:00.000Z');

describe('registro de falta', () => {
  it.each(['agendado', 'confirmado'])('libera %s a partir do início', (status) => {
    expect(podeRegistrarFalta(status, '2026-08-21T18:00:00.000Z', agora.getTime())).toBe(true);
    expect(podeRegistrarFalta(status, '2026-08-21T18:00:00.001Z', agora.getTime())).toBe(false);
  });

  it.each(['realizado', 'cancelado', 'faltou'])('não libera para o status %s', (status) => {
    expect(podeRegistrarFalta(status, '2026-08-20T18:00:00.000Z', agora.getTime())).toBe(false);
  });

  it('considera isenta a falta sem cobrança ativa', () => {
    expect(faltaCobrada(undefined)).toBe(false);
    expect(faltaCobrada('cancelled')).toBe(false);
    expect(faltaCobrada('pending')).toBe(true);
    expect(faltaCobrada('paid')).toBe(true);
  });

  it('reconhece cobrança com pagamento registrado', () => {
    expect(possuiPagamento('partially_paid')).toBe(true);
    expect(possuiPagamento('overdue')).toBe(false);
    expect(possuiPagamento(undefined)).toBe(false);
  });
});

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

