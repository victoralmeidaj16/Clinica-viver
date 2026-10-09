import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./psychologistAccess', () => ({
  provisionPsychologistAccess: vi.fn(),
  markWelcomeSent: vi.fn(),
}));
vi.mock('./psychologistRegistrationEmail', () => ({
  avisarCadastroAprovadoPorEmail: vi.fn(),
}));
vi.mock('./viverMaisWhatsApp', () => ({
  avisarBoasVindasPsicologo: vi.fn(),
}));

import type { CadastroPsicologoRecord } from './persistence';
import { enviarConvitePsicologo } from './psychologistInvitation';
import { markWelcomeSent, provisionPsychologistAccess } from './psychologistAccess';
import { avisarCadastroAprovadoPorEmail } from './psychologistRegistrationEmail';
import { avisarBoasVindasPsicologo } from './viverMaisWhatsApp';

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
      cadastro, 'https://clinicavivermais.cloud/login', activationUrl, 'retry-1'
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
      cadastro, 'https://clinicavivermais.cloud/login', undefined, 'retry-2'
    );
  });
});
