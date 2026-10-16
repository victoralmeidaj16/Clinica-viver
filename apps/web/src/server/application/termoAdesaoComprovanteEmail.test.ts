import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord } from './persistence';
import type { ComprovanteGerado } from './termoAdesaoComprovante';
import { conteudoComprovanteTermo, enviarComprovanteTermoAdesao } from './termoAdesaoComprovanteEmail';

const cadastro = {
  id: 'psi-cad-teste',
  nomeCompleto: 'Profissional <teste>',
  crp: '00/00000',
  whatsapp: '',
  email: ' Profissional@Example.com ',
  status: 'EM_ANALISE',
  criadoEm: '2026-10-15T17:32:10.000Z',
  aceiteTermoAdesao: {
    versao: '2026.2',
    aceitoEm: '2026-10-15T17:32:10.000Z',
    ip: '203.0.113.7',
    hashAlgoritmo: 'SHA-256',
    hashTexto: 'a'.repeat(64),
  },
} as CadastroPsicologoRecord;

const comprovante: ComprovanteGerado = {
  pdf: Buffer.from('%PDF-teste'),
  arquivo: 'termo-de-adesao-2026.2-psi-cad-teste.pdf',
  sha256: 'b'.repeat(64),
  codigoVerificacao: 'c'.repeat(64),
};

const agora = new Date('2026-10-15T17:32:11.000Z');

function provedor(status = 200, corpo: unknown = { id: 'msg-1' }) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return () => JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
}

describe('envio do comprovante do Termo de Adesão', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_teste';
    process.env.PSYCHOLOGIST_EMAIL_FROM = 'Viver Mais <atendimento@example.com>';
    process.env.PSYCHOLOGIST_EMAIL_REPLY_TO = 'clinica@example.com';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.PSYCHOLOGIST_EMAIL_FROM;
    delete process.env.PSYCHOLOGIST_EMAIL_REPLY_TO;
    delete process.env.TERMO_ADESAO_EMAIL_CLINICA;
  });

  it('manda o mesmo PDF ao profissional e, em cópia, à clínica', async () => {
    const corpoEnviado = provedor();
    const envio = await enviarComprovanteTermoAdesao(cadastro, comprovante, agora);

    expect(envio).toEqual({
      situacao: 'enviada',
      tentadoEm: agora.toISOString(),
      paraProfissional: true,
      paraClinica: true,
      idMensagem: 'msg-1',
    });
    const corpo = corpoEnviado();
    expect(corpo.to).toEqual(['profissional@example.com']);
    expect(corpo.cc).toEqual(['clinica@example.com']);
    expect(corpo.attachments).toEqual([
      { filename: comprovante.arquivo, content: comprovante.pdf.toString('base64') },
    ]);
    expect(corpo.text).toContain(comprovante.sha256);
    expect(corpo.text).toContain(comprovante.codigoVerificacao);
  });

  it('usa a caixa própria da clínica quando configurada', async () => {
    process.env.TERMO_ADESAO_EMAIL_CLINICA = 'termos@example.com';
    const corpoEnviado = provedor();
    await enviarComprovanteTermoAdesao(cadastro, comprovante, agora);
    expect(corpoEnviado().cc).toEqual(['termos@example.com']);
  });

  it('entrega a via da clínica mesmo sem e-mail válido do profissional', async () => {
    const corpoEnviado = provedor();
    const envio = await enviarComprovanteTermoAdesao({ ...cadastro, email: 'invalido' }, comprovante, agora);
    expect(envio).toMatchObject({ situacao: 'enviada', paraProfissional: false, paraClinica: true });
    expect(corpoEnviado().to).toEqual(['clinica@example.com']);
    expect(corpoEnviado().cc).toBeUndefined();
  });

  it('registra a recusa do provedor sem vazar endereços', async () => {
    provedor(422, { message: 'Invalid to: profissional@example.com' });
    const envio = await enviarComprovanteTermoAdesao(cadastro, comprovante, agora);
    expect(envio.situacao).toBe('falha');
    expect(envio.detalhe).toBe('HTTP 422 — Invalid to: [email oculto]');
  });

  it('escapa o nome no HTML', () => {
    expect(conteudoComprovanteTermo(cadastro, comprovante).html).toContain('Profissional &lt;teste&gt;');
  });
});
