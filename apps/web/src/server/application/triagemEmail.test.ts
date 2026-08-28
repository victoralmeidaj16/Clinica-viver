import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import {
  avisarTriagemRecebidaPorEmail,
  conteudoTriagemRecebida,
} from './triagemEmail';

const lead: TriagemPacienteRecord = {
  id: 'triagem-123',
  protocolo: 'VM-123456',
  nomePaciente: 'João & Maria',
  telefone: '5548988887777',
  email: ' JOAO@EXAMPLE.COM ',
  servico: 'Psicoterapia Individual',
  status: 'PENDENTE_ATRIBUICAO',
  criadoEm: '2026-08-28T12:00:00.000Z',
};

const psicologo: CadastroPsicologoRecord = {
  id: 'psi-1',
  nomeCompleto: 'Dra. Beatriz Santos',
  crp: '12/98765',
  whatsapp: '5548999991111',
  email: 'beatriz@example.com',
  status: 'APROVADO',
  criadoEm: '2026-08-20T10:00:00.000Z',
};

describe('e-mails de confirmação de agendamento/triagem', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_teste';
    process.env.NFSE_EMAIL_FROM = 'Viver Mais <atendimento@example.com>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.NFSE_EMAIL_FROM;
    delete process.env.PSYCHOLOGIST_EMAIL_FROM;
    delete process.env.PSYCHOLOGIST_EMAIL_REPLY_TO;
  });

  it('inclui protocolo, prazo de 24h e alerta do CVV 188 no texto e HTML', () => {
    const conteudo = conteudoTriagemRecebida(lead, psicologo);
    expect(conteudo.text).toContain('Protocolo de Acompanhamento: VM-123456');
    expect(conteudo.text).toContain('Dra. Beatriz Santos');
    expect(conteudo.text).toContain('24 horas');
    expect(conteudo.text).toContain('188');
    expect(conteudo.text).toContain('CVV');
    expect(conteudo.html).toContain('João &amp; Maria');
    expect(conteudo.html).toContain('VM-123456');
    expect(conteudo.html).toContain('188');
  });

  it('envia e-mail com chave de idempotência e destinatário normalizado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(avisarTriagemRecebidaPorEmail(lead, psicologo)).resolves.toEqual({ situacao: 'enviada' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('triagem-received-triagem-123');
    expect(JSON.parse(String(init.body)).to).toEqual(['joao@example.com']);
  });

  it('identifica e-mail inválido ou ausente sem quebrar a operação', async () => {
    const semEmail = { ...lead, email: undefined };
    await expect(avisarTriagemRecebidaPorEmail(semEmail)).resolves.toEqual({
      situacao: 'destinatario_invalido',
    });
  });

  it('trata provedor desconfigurado graciosamente', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(avisarTriagemRecebidaPorEmail(lead)).resolves.toEqual({
      situacao: 'provedor_desconfigurado',
    });
  });
});
