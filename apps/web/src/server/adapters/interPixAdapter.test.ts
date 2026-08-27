import { afterEach, describe, expect, it, vi } from 'vitest';
import { dynamicPixPayload, interTxid, isInterPixSettled } from './interPixAdapter';

vi.mock('server-only', () => ({}));

const originalEnv = { ...process.env };

afterEach(() => { process.env = { ...originalEnv }; });

describe('adaptador Pix do Banco Inter', () => {
  it('gera um txid determinístico aceito pela API Pix', () => {
    const first = interTxid('VM-checkout-123');
    expect(first).toBe(interTxid('VM-checkout-123'));
    expect(first).toMatch(/^[A-Za-z0-9]{26,35}$/);
    expect(interTxid('VM-checkout-456')).not.toBe(first);
  });

  it('monta BR Code dinâmico com location, identificação e CRC', () => {
    process.env.INTER_PIX_RECEIVER_NAME = 'Clínica Viver Mais';
    process.env.INTER_PIX_RECEIVER_CITY = 'São Paulo';
    const payload = dynamicPixPayload('https://spi-qrcode-h.bancointer.com.br/pix/abc123');
    expect(payload).toContain('BR.GOV.BCB.PIX');
    expect(payload).toContain('spi-qrcode-h.bancointer.com.br/pix/abc123');
    expect(payload).toContain('CLINICA VIVER MAIS');
    expect(payload).toContain('SAO PAULO');
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('considera liquidada apenas a cobrança concluída', () => {
    expect(isInterPixSettled('CONCLUIDA')).toBe(true);
    expect(isInterPixSettled('ATIVA')).toBe(false);
    expect(isInterPixSettled('REMOVIDA_PELO_USUARIO_RECEBEDOR')).toBe(false);
  });
});
