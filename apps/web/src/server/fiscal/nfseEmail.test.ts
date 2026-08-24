import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./danfsePdf', () => ({
  gerarDanfsePdf: vi.fn().mockResolvedValue(Buffer.from('pdf de teste')),
}));

import { enviarNfsePorEmail, normalizarEmailPaciente } from './nfseEmail';
import type { EmissaoNfse } from './nfseRepository';

const emissao: EmissaoNfse = {
  id: 'emissao-1', chargeId: 'cobranca-1', patientId: 'paciente-1',
  cnpjPrestador: '41325295000140', serie: '00001', numeroDps: '7',
  dpsId: 'DPS123', ambiente: 'producao', valorCents: 18_000,
  competencia: '2026-08-21', status: 'issued', idempotencyKey: 'idem-1',
  nfseXml: '<NFSe><infNFSe Id="NFS123" /></NFSe>', chaveAcesso: '1'.repeat(50),
  numeroNfse: '42', emailTentativas: 1,
};

describe('envio da NFS-e por e-mail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_teste';
    process.env.NFSE_EMAIL_FROM = 'Viver Mais <notas@example.com>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.NFSE_EMAIL_FROM;
    delete process.env.NFSE_EMAIL_REPLY_TO;
  });

  it('normaliza o destinatário e recusa endereço inválido', () => {
    expect(normalizarEmailPaciente(' PACIENTE@EXAMPLE.COM ')).toBe('paciente@example.com');
    expect(normalizarEmailPaciente('paciente@')).toBeUndefined();
  });

  it('envia PDF e XML com chave idempotente por emissão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'email-123' }), { status: 200 }
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(enviarNfsePorEmail({
      emissao,
      paciente: { nome: 'Ana & Família', email: 'ANA@EXAMPLE.COM' },
    })).resolves.toEqual({ providerId: 'email-123' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('nfse-email-emissao-1');
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(['ana@example.com']);
    expect(body.html).toContain('Ana &amp; Família');
    expect(body.attachments.map((item: { filename: string }) => item.filename)).toEqual([
      'danfse-00001-42.pdf', 'nfse-00001-42.xml',
    ]);
  });

  it('propaga a mensagem segura retornada pelo provedor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'domínio remetente não verificado' }), { status: 422 }
    )));

    await expect(enviarNfsePorEmail({
      emissao,
      paciente: { nome: 'Ana', email: 'ana@example.com' },
    })).rejects.toThrow('domínio remetente não verificado');
  });
});
