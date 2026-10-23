import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isWhatsAppRecipientAllowed } from './whatsappAllowlist';

// Números de mentira, só zeros — nenhum pertence a alguém.
const QUALQUER = '(21) 90000-0000';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('destinatários do WhatsApp', () => {
  it('qualquer número válido recebe, sem depender de configuração', () => {
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    vi.stubEnv('WHATSAPP_ALLOW_ALL_RECIPIENTS', '');
    expect(isWhatsAppRecipientAllowed(QUALQUER)).toBe(true);
    expect(isWhatsAppRecipientAllowed('+55 21 0000-0000')).toBe(true);
    expect(isWhatsAppRecipientAllowed('5511900000000')).toBe(true);
  });

  it('a antiga lista do piloto não restringe mais o envio', () => {
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '5511900000000');
    expect(isWhatsAppRecipientAllowed(QUALQUER)).toBe(true);
  });

  it('não aceita telefone vazio ou truncado', () => {
    expect(isWhatsAppRecipientAllowed('')).toBe(false);
    expect(isWhatsAppRecipientAllowed('9000')).toBe(false);
    expect(isWhatsAppRecipientAllowed('(01) 90000-0000')).toBe(false);
  });
});
