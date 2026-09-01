import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord } from './persistence';
import {
  avisarCadastroAprovadoPorEmail,
  avisarCadastroRecebidoPorEmail,
  conteudoCadastroAprovado,
  conteudoCadastroRecebido,
} from './psychologistRegistrationEmail';

const cadastro: CadastroPsicologoRecord = {
  id: 'psi-cad-1',
  nomeCompleto: 'Ana & Silva',
  crp: '12/34567',
  whatsapp: '5548999999999',
  email: ' ANA@EXAMPLE.COM ',
  status: 'EM_ANALISE',
  criadoEm: '2026-08-25T12:00:00.000Z',
};

describe('e-mails do credenciamento de psicólogo', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_teste';
    process.env.NFSE_EMAIL_FROM = 'Viver Mais <contato@example.com>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.NFSE_EMAIL_FROM;
    delete process.env.PSYCHOLOGIST_EMAIL_FROM;
    delete process.env.PSYCHOLOGIST_EMAIL_REPLY_TO;
  });

  it('explica a análise de até 24 horas no primeiro e-mail', () => {
    const conteudo = conteudoCadastroRecebido('Ana & Silva');
    expect(conteudo.text).toContain('Em até 24 horas');
    expect(conteudo.text).toContain('link seguro para cadastrar sua senha');
    expect(conteudo.html).toContain('Ana &amp; Silva');
    expect(conteudo.html).toContain('logo-viver-mais.png');
    expect(conteudo.html).toContain('Seu cadastro chegou até nós');
  });

  it('inclui portal, criação de senha e validade no e-mail de aprovação', () => {
    const conteudo = conteudoCadastroAprovado(
      'Ana',
      'https://clinicavivermais.cloud/login',
      'https://clinicavivermais.cloud/ativar-conta?token=seguro'
    );
    expect(conteudo.text).toContain('Portal: https://clinicavivermais.cloud/login');
    expect(conteudo.text).toContain('expira em 72 horas');
    expect(conteudo.html).toContain('Cadastrar minha senha');
    expect(conteudo.html).toContain('Boas-vindas à Viver Mais');
    expect(conteudo.html).toContain('background:#43265e');
  });

  it('orienta acesso ao portal sem inventar nova senha para conta já existente', () => {
    const conteudo = conteudoCadastroAprovado(
      'Ana',
      'https://clinicavivermais.cloud/login'
    );
    expect(conteudo.text).toContain('Portal: https://clinicavivermais.cloud/login');
    expect(conteudo.text).not.toContain('Cadastre sua senha');
  });

  it('envia a confirmação imediata com destinatário e chave idempotente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(avisarCadastroRecebidoPorEmail(cadastro)).resolves.toEqual({ situacao: 'enviada' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(
      'psychologist-registration-received-psi-cad-1'
    );
    expect(JSON.parse(String(init.body)).to).toEqual(['ana@example.com']);
  });

  it('envia o link de acesso no e-mail posterior à aprovação', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const activationUrl = 'https://clinicavivermais.cloud/ativar-conta?token=seguro';

    await expect(avisarCadastroAprovadoPorEmail(
      cadastro,
      'https://clinicavivermais.cloud/login',
      activationUrl
    )).resolves.toEqual({ situacao: 'enviada' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).text).toContain(activationUrl);
  });

  it('preserva o cadastro quando o provedor não está configurado', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(avisarCadastroRecebidoPorEmail(cadastro)).resolves.toEqual({
      situacao: 'provedor_desconfigurado',
    });
  });
});
