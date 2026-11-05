import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./psychologistAccess', () => ({
  provisionPsychologistAccess: vi.fn(),
  markWelcomeSent: vi.fn(),
}));
vi.mock('./psychologistRegistrationEmail', () => ({
  avisarCadastroAprovadoPorEmail: vi.fn(),
  normalizarEmail: (email: string | undefined) => email,
}));
vi.mock('./viverMaisWhatsApp', () => ({
  avisarBoasVindasPsicologo: vi.fn(),
}));
vi.mock('./termoAdesaoComprovantePdf', () => ({ montarComprovanteTermoAdesao: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
vi.mock('@/server/persistence/mysql/captureRepository', () => ({
  MysqlCaptureRepository: class { async registrarEnvioComprovanteTermo() {} },
}));

import type { CadastroPsicologoRecord } from './persistence';
import { enviarConvitePsicologo } from './psychologistInvitation';
import { markWelcomeSent, provisionPsychologistAccess } from './psychologistAccess';
import { avisarCadastroAprovadoPorEmail } from './psychologistRegistrationEmail';
import { avisarBoasVindasPsicologo } from './viverMaisWhatsApp';
import { montarComprovanteTermoAdesao } from './termoAdesaoComprovantePdf';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';

const cadastro: CadastroPsicologoRecord = {
  id: 'psi-1', nomeCompleto: 'Ana', crp: '12/34567', whatsapp: '5548999999999',
  email: 'ana@example.com', status: 'APROVADO', criadoEm: '2026-10-08T12:00:00.000Z',
};

describe('convite de acesso do psicólogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(avisarBoasVindasPsicologo).mockResolvedValue({
      finalidade: 'boas_vindas_psicologo', chaveDedupe: 'nova', situacao: 'enviada',
    });
    vi.mocked(avisarCadastroAprovadoPorEmail).mockResolvedValue({ situacao: 'enviada' });
  });

  it('renova o token e envia o mesmo link pelos dois canais', async () => {
    vi.mocked(provisionPsychologistAccess).mockResolvedValue({
      userId: 'user-1', professionalId: 'pro-1', activationToken: 'token novo',
      email: cadastro.email!, displayName: cadastro.nomeCompleto, whatsapp: cadastro.whatsapp,
    });

    await expect(enviarConvitePsicologo(cadastro, 'retry-1')).resolves.toMatchObject({
      contaAtivada: false,
      whatsapp: 'enviada',
      email: { situacao: 'enviada' },
    });

    const activationUrl = 'https://clinicavivermais.cloud/ativar-conta?token=token%20novo';
    expect(avisarBoasVindasPsicologo).toHaveBeenCalledWith(cadastro, activationUrl, 'retry-1');
    expect(avisarCadastroAprovadoPorEmail).toHaveBeenCalledWith(
      cadastro, 'https://clinicavivermais.cloud/login', activationUrl, 'retry-1', undefined
    );
    expect(markWelcomeSent).toHaveBeenCalledWith(cadastro.id);
  });

  it('não cria nem envia novo link para uma conta já ativada', async () => {
    vi.mocked(provisionPsychologistAccess).mockResolvedValue({
      userId: 'user-1', professionalId: 'pro-1',
      email: cadastro.email!, displayName: cadastro.nomeCompleto, whatsapp: cadastro.whatsapp,
    });

    await expect(enviarConvitePsicologo(cadastro, 'retry-2')).resolves.toMatchObject({
      contaAtivada: true,
      whatsapp: 'nao_aplicavel',
      email: { situacao: 'enviada' },
    });
    expect(avisarBoasVindasPsicologo).not.toHaveBeenCalled();
    expect(avisarCadastroAprovadoPorEmail).toHaveBeenCalledWith(
      cadastro, 'https://clinicavivermais.cloud/login', undefined, 'retry-2', undefined
    );
  });

  it('inclui a prova original no convite aprovado e registra o envio ao profissional', async () => {
    const record: CadastroPsicologoRecord = { ...cadastro, aceiteTermoAdesao: {
      versao: '2026.2', aceitoEm: '2026-10-01T12:00:00.000Z', hashAlgoritmo: 'SHA-256',
    } };
    const comprovante = { pdf: Buffer.from('%PDF-teste'), arquivo: 'comprovante.pdf',
      sha256: 'a'.repeat(64), codigoVerificacao: 'b'.repeat(64) };
    vi.mocked(montarComprovanteTermoAdesao).mockResolvedValue(comprovante);
    vi.mocked(provisionPsychologistAccess).mockResolvedValue({
      userId: 'user-1', professionalId: 'pro-1', activationToken: 'novo',
      email: cadastro.email!, displayName: cadastro.nomeCompleto, whatsapp: cadastro.whatsapp,
    });
    const registrar = vi.spyOn(MysqlCaptureRepository.prototype, 'registrarEnvioComprovanteTermo');
    await enviarConvitePsicologo(record, 'aprovacao');
    expect(montarComprovanteTermoAdesao).toHaveBeenCalledWith(record);
    expect(avisarCadastroAprovadoPorEmail).toHaveBeenCalledWith(record,
      'https://clinicavivermais.cloud/login', 'https://clinicavivermais.cloud/ativar-conta?token=novo', 'aprovacao', comprovante);
    expect(record.aceiteTermoAdesao?.aceitoEm).toBe('2026-10-01T12:00:00.000Z');
    expect(registrar).toHaveBeenCalledWith(record.id, expect.objectContaining({
      situacao: 'enviada', paraProfissional: true, paraClinica: false,
    }), 'envioComprovanteConvite');
    registrar.mockRestore();
  });

  it('cria o acesso e envia o convite mesmo sem conseguir gerar o comprovante', async () => {
    const record: CadastroPsicologoRecord = { ...cadastro, aceiteTermoAdesao: {
      versao: 'nao-informada', aceitoEm: '2026-10-01T12:00:00.000Z', hashAlgoritmo: 'SHA-256',
    } };
    vi.mocked(montarComprovanteTermoAdesao).mockRejectedValue(new Error('Versão do Termo de Adesão indisponível.'));
    vi.mocked(provisionPsychologistAccess).mockResolvedValue({
      userId: 'user-1', professionalId: 'pro-1', activationToken: 'novo',
      email: cadastro.email!, displayName: cadastro.nomeCompleto, whatsapp: cadastro.whatsapp,
    });
    const registrar = vi.spyOn(MysqlCaptureRepository.prototype, 'registrarEnvioComprovanteTermo');
    const erroNoLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(enviarConvitePsicologo(record, 'aprovacao')).resolves.toMatchObject({ email: { situacao: 'enviada' } });

    expect(provisionPsychologistAccess).toHaveBeenCalledWith(record);
    expect(avisarCadastroAprovadoPorEmail).toHaveBeenCalledWith(record,
      'https://clinicavivermais.cloud/login', 'https://clinicavivermais.cloud/ativar-conta?token=novo', 'aprovacao', undefined);
    expect(registrar).not.toHaveBeenCalled();
    expect(erroNoLog).toHaveBeenCalled();
    registrar.mockRestore();
    erroNoLog.mockRestore();
  });

  it('não envia convite nem comprovante antes da aprovação', async () => {
    await expect(enviarConvitePsicologo({ ...cadastro, status: 'EM_ANALISE' })).rejects.toThrow(/aprovad/);
    expect(provisionPsychologistAccess).not.toHaveBeenCalled();
    expect(avisarCadastroAprovadoPorEmail).not.toHaveBeenCalled();
    expect(avisarBoasVindasPsicologo).not.toHaveBeenCalled();
    expect(montarComprovanteTermoAdesao).not.toHaveBeenCalled();
  });
});
