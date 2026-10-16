import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), email: vi.fn(), comprovante: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: vi.fn() }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/server/application/ibgeLocations', () => ({ municipioPertenceAoEstado: async () => true }));
vi.mock('@/server/application/psychologistRegistrationEmail', () => ({ avisarCadastroRecebidoPorEmail: mocks.email }));
vi.mock('@/server/application/termoAdesaoComprovantePdf', () => ({ montarComprovanteTermoAdesao: async () => null }));
vi.mock('@/server/application/termoAdesaoComprovanteEmail', () => ({ enviarComprovanteTermoAdesao: mocks.comprovante }));
import { POST } from './route';
import { CadastroDuplicadoError } from '@/server/application/psychologistUniqueness';

const body = { nomeCompleto: 'Teste', crp: '12/34567', email: 'psi@example.com', whatsapp: '48998315675', estadoUf: 'SC', cidade: 'Florianópolis', logradouro: 'Rua Teste', bairro: 'Centro', genero: 'FEMININO', aceitouTermos: true, disponibilidadeTurnos: ['MANHA'] };
const request = () => new Request('https://example.com/api/application/credenciamento-psicologo', { method: 'POST', body: JSON.stringify(body) });

describe('resposta ao cadastro repetido', () => {
  beforeEach(() => vi.resetAllMocks());
  it('retorna 409 com ação identificável e não envia nenhum e-mail', async () => {
    mocks.mutate.mockRejectedValue(new CadastroDuplicadoError());
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, code: 'CADASTRO_DUPLICADO' });
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.comprovante).not.toHaveBeenCalled();
  });
  it('mantém o envio normal para um cadastro novo', async () => {
    mocks.mutate.mockResolvedValue(undefined);
    mocks.email.mockResolvedValue({ situacao: 'enviada' });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
});
