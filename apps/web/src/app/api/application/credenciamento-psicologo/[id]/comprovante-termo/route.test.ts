import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  cadastroDaSessao: vi.fn(),
  readCapture: vi.fn(),
  montarPdf: vi.fn(),
  enviarComprovante: vi.fn(),
}));

vi.mock('@/server/auth', () => ({ readSession: mocks.readSession }));
vi.mock('@/server/application/psychologistSelf', async () => {
  const actual = await vi.importActual<typeof import('@/server/application/psychologistSelf')>(
    '@/server/application/psychologistSelf'
  );
  return {
    SemAcessoError: actual.SemAcessoError,
    cadastroDaSessao: mocks.cadastroDaSessao,
  };
});
vi.mock('@/server/persistence/captureRepository', () => ({
  getCaptureRepository: () => ({ read: mocks.readCapture }),
}));
vi.mock('@/server/application/termoAdesaoComprovantePdf', () => ({
  montarComprovanteTermoAdesao: mocks.montarPdf,
}));
vi.mock('@/server/application/termoAdesaoComprovanteEmail', () => ({
  enviarComprovanteTermoAdesao: mocks.enviarComprovante,
}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => false }));
vi.mock('@/server/persistence/mysql/captureRepository', () => ({ MysqlCaptureRepository: class {} }));

import { GET, POST } from './route';

const cadastroBase = {
  id: 'psi-1',
  nomeCompleto: 'Dra. Teste',
  status: 'APROVADO',
  aceiteTermoAdesao: {
    versao: '1.0',
    aceitoEm: '2026-10-01T12:00:00Z',
    comprovante: { arquivo: 'termo-psi-1.pdf', sha256: 'abc123', codigoVerificacao: 'COD123' },
  },
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readCapture.mockResolvedValue({ cadastrosPsicologos: [cadastroBase] });
  mocks.montarPdf.mockResolvedValue({
    pdf: Buffer.from('%PDF-1.4\n'),
    arquivo: 'termo-psi-1.pdf',
    sha256: 'abc123',
    codigoVerificacao: 'COD123',
  });
});

describe('GET /api/application/credenciamento-psicologo/[id]/comprovante-termo', () => {
  it('recusa visitante sem sessão com 401', async () => {
    mocks.readSession.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), params('psi-1'));
    expect(res.status).toBe(401);
    expect(mocks.montarPdf).not.toHaveBeenCalled();
  });

  it('permite download à gestão (admin)', async () => {
    mocks.readSession.mockResolvedValue({ userId: 'u-admin', role: 'admin', organizationId: 'org-1' });
    const res = await GET(new Request('http://localhost'), params('psi-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('X-Comprovante-Sha256')).toBe('abc123');
    expect(res.headers.get('X-Comprovante-Confere')).toBe('sim');
  });

  it('permite ao psicólogo baixar o PDF do próprio termo aceito (§§ 3.7 e 12.05)', async () => {
    mocks.readSession.mockResolvedValue({ userId: 'u-psi', role: 'professional', organizationId: 'org-1' });
    mocks.cadastroDaSessao.mockResolvedValue(cadastroBase);
    const res = await GET(new Request('http://localhost'), params('psi-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('termo-psi-1.pdf');
    expect(mocks.montarPdf).toHaveBeenCalledWith(cadastroBase);
  });

  it('bloqueia psicólogo tentando baixar o termo de outro profissional', async () => {
    mocks.readSession.mockResolvedValue({ userId: 'u-psi', role: 'professional', organizationId: 'org-1' });
    mocks.cadastroDaSessao.mockResolvedValue({ id: 'psi-2' });
    const res = await GET(new Request('http://localhost'), params('psi-1'));
    expect(res.status).toBe(403);
    expect(mocks.montarPdf).not.toHaveBeenCalled();
  });

  it('retorna 409 quando o cadastro não possui prova de aceite', async () => {
    mocks.readSession.mockResolvedValue({ userId: 'u-psi', role: 'professional', organizationId: 'org-1' });
    mocks.cadastroDaSessao.mockResolvedValue({ id: 'psi-sem-termo' });
    mocks.readCapture.mockResolvedValue({ cadastrosPsicologos: [{ id: 'psi-sem-termo' }] });
    const res = await GET(new Request('http://localhost'), params('psi-sem-termo'));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/application/credenciamento-psicologo/[id]/comprovante-termo', () => {
  it('mantém o reenvio por e-mail restrito à gestão', async () => {
    mocks.readSession.mockResolvedValue({ userId: 'u-psi', role: 'professional', organizationId: 'org-1' });
    const res = await POST(new Request('http://localhost', { method: 'POST' }), params('psi-1'));
    expect(res.status).toBe(403);
    expect(mocks.enviarComprovante).not.toHaveBeenCalled();
  });

  it('recusa o envio definitivo por e-mail enquanto o cadastro aguarda aprovação', async () => {
    mocks.readSession.mockResolvedValue({ userId: 'u-admin', role: 'admin', organizationId: 'org-1' });
    mocks.readCapture.mockResolvedValue({
      cadastrosPsicologos: [{ ...cadastroBase, status: 'EM_ANALISE' }],
    });
    const res = await POST(new Request('http://localhost', { method: 'POST' }), params('psi-1'));
    expect(res.status).toBe(409);
    expect(mocks.enviarComprovante).not.toHaveBeenCalled();
  });

  it('envia o comprovante definitivo quando o cadastro está aprovado', async () => {
    mocks.readSession.mockResolvedValue({ userId: 'u-admin', role: 'admin', organizationId: 'org-1' });
    mocks.enviarComprovante.mockResolvedValue({ situacao: 'enviada', paraProfissional: true, paraClinica: true });
    const res = await POST(new Request('http://localhost', { method: 'POST' }), params('psi-1'));
    expect(res.status).toBe(200);
    expect(mocks.enviarComprovante).toHaveBeenCalledTimes(1);
  });
});
