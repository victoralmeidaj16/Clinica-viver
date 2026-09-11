import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isWhatsAppRecipientAllowed } from './whatsappAllowlist';

// Números de mentira, só zeros — nenhum pertence a alguém.
const LIBERADO = '5511900000000';
const OUTRO = '(21) 90000-0000';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('trava de destinatários do WhatsApp', () => {
  it('falha fechada: sem configuração ninguém recebe', () => {
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    vi.stubEnv('WHATSAPP_ALLOW_ALL_RECIPIENTS', '');
    expect(isWhatsAppRecipientAllowed(LIBERADO)).toBe(false);
  });

  it('no piloto, só os números da lista recebem', () => {
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', LIBERADO);
    expect(isWhatsAppRecipientAllowed('(11) 90000-0000')).toBe(true);
    expect(isWhatsAppRecipientAllowed(OUTRO)).toBe(false);
  });

  it('com o envio liberado, qualquer número válido recebe', () => {
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    vi.stubEnv('WHATSAPP_ALLOW_ALL_RECIPIENTS', 'true');
    expect(isWhatsAppRecipientAllowed(OUTRO)).toBe(true);
    expect(isWhatsAppRecipientAllowed('+55 21 0000-0000')).toBe(true);
  });

  it('liberar todos não aceita telefone vazio ou truncado', () => {
    vi.stubEnv('WHATSAPP_ALLOW_ALL_RECIPIENTS', 'true');
    expect(isWhatsAppRecipientAllowed('')).toBe(false);
    expect(isWhatsAppRecipientAllowed('9000')).toBe(false);
    expect(isWhatsAppRecipientAllowed('(01) 90000-0000')).toBe(false);
  });

  it('só o valor exato "true" libera', () => {
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    vi.stubEnv('WHATSAPP_ALLOW_ALL_RECIPIENTS', 'sim');
    expect(isWhatsAppRecipientAllowed(OUTRO)).toBe(false);
  });
});
