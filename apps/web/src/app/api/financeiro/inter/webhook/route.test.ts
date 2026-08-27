import { describe, expect, it, vi } from 'vitest';
import { parseInterPixEvents } from './route';

vi.mock('server-only', () => ({}));

describe('webhook Pix do Banco Inter', () => {
  it('aceita o contrato Pix e preserva as chaves de conciliação', () => {
    expect(parseInterPixEvents({ pix: [{
      endToEndId: 'E1234567890123456789012345678901',
      txid: 'VM123456789012345678901234567890',
      valor: '75.00',
      horario: '2026-08-27T12:00:00Z',
    }] })).toEqual([{
      endToEndId: 'E1234567890123456789012345678901',
      txid: 'VM123456789012345678901234567890',
      valor: '75.00',
      horario: '2026-08-27T12:00:00Z',
    }]);
  });

  it('descarta itens sem txid válido ou endToEndId', () => {
    expect(parseInterPixEvents({ pix: [
      { txid: 'curto', endToEndId: 'E1', valor: '75.00' },
      { txid: 'VM123456789012345678901234567890', valor: '75.00' },
    ] })).toEqual([]);
  });
});
