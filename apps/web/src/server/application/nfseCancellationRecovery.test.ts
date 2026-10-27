import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ falha: vi.fn(), sucesso: vi.fn(), enviar: vi.fn(), consultar: vi.fn(), eventos: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@thats-life/core', () => ({ TIPO_EVENTO_CANCELAMENTO: '101101', gerarPedidoCancelamentoNfse: () => ({ id: 'id', xml: '<pedido />' }) }));
vi.mock('./clinicFinanceService', () => ({ exigirAdminFiscal: () => {} }));
vi.mock('./store', () => ({}));
vi.mock('@/server/fiscal/certificadoNfse', () => ({ exigirCertificadoNfseApto: () => ({}) }));
vi.mock('@/server/fiscal/prestador', () => ({ PRESTADOR_NFSE: { cnpj: '12345678901234' }, SERVICO_NFSE: {} }));
vi.mock('@/server/fiscal/nfseRepository', () => ({ exigirPersistenciaFiscal: () => {}, NfseRepository: class {
  porCobranca = async () => ({ id: 'nfse-1', status: 'issued', chaveAcesso: '1'.repeat(50), ambiente: 'producao_restrita' });
  eventos = mocks.eventos;
  reservarEvento = async () => ({ id: 'evt-1', numeroPedido: 1 });
  salvarPedidoEvento = async () => {};
  registrarCancelamento = mocks.sucesso;
  registrarFalhaEvento = mocks.falha;
} }));
vi.mock('@/server/fiscal/sefinNacional', () => ({ ambienteNfse: () => 'producao_restrita', CODIGO_TP_AMB: { producao_restrita: '2' }, registrarEvento: mocks.enviar, consultarCancelamentoNfse: mocks.consultar, SefinNacionalError: class extends Error {} }));
vi.mock('@/server/fiscal/assinaturaXmlFiscal', () => ({ assinarXmlFiscal: () => '<signed />' }));
vi.mock('@/server/fiscal/validacaoXmlFiscal', () => ({ validarPedidoEventoAssinado: () => {} }));
vi.mock('@/server/fiscal/danfsePdf', () => ({}));
vi.mock('@/server/fiscal/nfseEmail', () => ({}));
import { cancelarNfse } from './nfseEmissionService';

describe('cancelamento fiscal com resposta perdida', () => {
  const context = { actor: { organizationId: 'org', userId: 'admin', roles: ['admin'] } } as never;
  const entrada = { confirmar: true, motivo: 'Motivo fictício de cancelamento' };
  it('confirma na SEFIN antes de registrar o cancelamento', async () => {
    mocks.eventos.mockResolvedValue([]);
    mocks.enviar.mockRejectedValue(new Error('timeout fictício'));
    mocks.consultar.mockResolvedValue({ status: 200, corpo: 'evento confirmado' });
    expect(await cancelarNfse(context, 'charge-1', entrada)).toMatchObject({ status: 'cancelled' });
    expect(mocks.sucesso).toHaveBeenCalledOnce();
  });
  it('mantém a tentativa pendente quando a consulta também falha', async () => {
    mocks.eventos.mockResolvedValue([]);
    mocks.enviar.mockRejectedValue(new Error('timeout fictício'));
    mocks.consultar.mockRejectedValue(new Error('indisponível'));
    mocks.falha.mockClear();
    await expect(cancelarNfse(context, 'charge-1', entrada)).rejects.toMatchObject({ code: 'NFSE_CANCELLATION_UNKNOWN' });
    expect(mocks.falha).not.toHaveBeenCalled();
  });
});
