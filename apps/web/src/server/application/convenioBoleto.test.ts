import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), buscar: vi.fn(), registrar: vi.fn(), cancelar: vi.fn(), remover: vi.fn(), fatura: { id: 'fat-1', status: 'aberta', valorCents: 10000, competencia: '2026-10', totalSessoes: 1, providerId: undefined as string | undefined },
  lock: Promise.resolve(), dia: undefined as number | undefined,
}));
vi.mock('server-only', () => ({}));
vi.mock('./clinicFinanceService', () => ({ exigirAdminFiscal: () => {} }));
vi.mock('@/server/reports/convenioReportPdf', () => ({}));
vi.mock('@/server/payments/convenioChargeTransfer', () => ({}));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst-1' }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => {
  let release: () => void = () => {};
  return {
    beginTransaction: async () => {},
    query: async () => { const previous = mocks.lock; mocks.lock = new Promise<void>((resolve) => { release = resolve; }); await previous; return [[], []]; },
    commit: async () => release(), rollback: async () => release(), release: () => {},
  };
} }) }));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({
  obterConvenio: async () => ({ id: 'conv-1', nome: 'Empresa fictícia', cnpj: '12345678901234', diaVencimento: mocks.dia }),
  obterFatura: async () => ({ ...mocks.fatura }),
  registrarBoleto: mocks.registrar,
  cancelarFatura: mocks.cancelar,
  sessoesDoConvenio: async () => [
    { chargeId: 'c1', sessionId: 's1', patientId: 'p1', pacienteNome: 'Ana', professionalId: 'pr1', psicologoNome: 'Psi', realizadaEm: '2026-10-10', valorCents: 10000, status: 'pending', custeadoPelaEmpresa: false },
  ],
}));
const getLinha = vi.hoisted(() => vi.fn(async () => 'linha'));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  findAsaasPaymentByExternalReference: mocks.buscar,
  getOrCreateAsaasCustomer: async () => 'customer',
  createAsaasPayment: mocks.create,
  deleteAsaasPayment: mocks.remover,
  getAsaasBoletoIdentificationField: getLinha,
}));
import { cancelConvenioInvoice, convenioReport, createConvenioBoleto, updateConvenio } from './convenioService';

const context = { actor: { organizationId: 'org-1', roles: ['admin'] } } as never;
describe('geração de boleto empresarial', () => {
  beforeEach(() => {
    mocks.lock = Promise.resolve(); mocks.fatura.providerId = undefined;
    mocks.create.mockReset().mockResolvedValue({ id: 'pay-1', value: 100, dueDate: '2026-11-05', bankSlipUrl: 'https://example.test' });
    mocks.buscar.mockReset().mockResolvedValue(null);
    mocks.registrar.mockReset().mockImplementation(async (_org, _conv, _fat, boleto) => { mocks.fatura.providerId = boleto.providerId; });
    mocks.cancelar.mockReset().mockResolvedValue(undefined);
    mocks.remover.mockReset().mockResolvedValue(true);
  });

  it('cancela no provedor o boleto que termina de ser criado simultaneamente', async () => {
    await Promise.all([createConvenioBoleto(context, 'conv-1', 'fat-1'), cancelConvenioInvoice(context, 'conv-1', 'fat-1')]);
    expect(mocks.remover).toHaveBeenCalledWith('pay-1');
    expect(mocks.cancelar).toHaveBeenCalledOnce();
  });

  it('serializa pedidos simultâneos para a mesma fatura', async () => {
    await Promise.all([createConvenioBoleto(context, 'conv-1', 'fat-1'), createConvenioBoleto(context, 'conv-1', 'fat-1')]);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.registrar).toHaveBeenCalledOnce();
    expect(mocks.registrar.mock.calls[0][3].tomador).toEqual({ cnpj: '12345678901234', nome: 'Empresa fictícia', email: undefined });
  });

  it('não presume o tomador de boleto recuperado após falha', async () => {
    mocks.buscar.mockResolvedValue({ id: 'pay-1', value: 100, dueDate: '2026-11-05', bankSlipUrl: 'https://example.test' });
    await createConvenioBoleto(context, 'conv-1', 'fat-1');
    expect(mocks.registrar.mock.calls[0][3].tomador).toBeUndefined();
  });

  it('calcula sete dias depois quando não existe dia fixo', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    try {
      await createConvenioBoleto(context, 'conv-1', 'fat-1');
      expect(mocks.create.mock.calls[0][0].dueDate).toBe('2026-11-05');
    } finally { vi.useRealTimers(); }
  });

  /** Hoje é 27/10 em Brasília. Vencer no dia 28 daria um dia para a empresa pagar. */
  it.each([
    [28, '2026-11-28', 'empurra para o mês seguinte quando o dia fixo cai amanhã'],
    [1, '2026-11-01', 'mantém o próximo dia fixo quando ele respeita o prazo mínimo'],
    [27, '2026-11-27', 'não vence no próprio dia da emissão'],
    [10, '2026-11-10', 'usa o mês seguinte quando o dia já passou'],
  ])('dia fixo %i vence em %s: %s', async (dia, esperado) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T15:00:00Z'));
    mocks.dia = dia;
    try {
      await createConvenioBoleto(context, 'conv-1', 'fat-1');
      expect(mocks.create.mock.calls[0][0].dueDate).toBe(esperado);
    } finally { vi.useRealTimers(); mocks.dia = undefined; }
  });

  it('respeita o prazo mínimo também na virada para um mês curto', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2027-02-26T15:00:00Z'));
    mocks.dia = 1;
    try {
      await createConvenioBoleto(context, 'conv-1', 'fat-1');
      // 1º de março fica a três dias de 26/02; o próximo dia 1 válido é em abril.
      expect(mocks.create.mock.calls[0][0].dueDate).toBe('2027-04-01');
    } finally { vi.useRealTimers(); mocks.dia = undefined; }
  });

  it('não vincula um boleto anterior com valor diferente da fatura', async () => {
    mocks.buscar.mockResolvedValue({ id: 'pay-1', value: 50 });
    await expect(createConvenioBoleto(context, 'conv-1', 'fat-1')).rejects.toMatchObject({ code: 'PROVIDER_AMOUNT_MISMATCH' });
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it('registra o boleto e o tomador mesmo se a linha digitável atrasar no Asaas', async () => {
    getLinha.mockRejectedValueOnce(new Error('indisponível'));
    await createConvenioBoleto(context, 'conv-1', 'fat-1');
    expect(mocks.registrar).toHaveBeenCalledOnce();
    expect(mocks.registrar.mock.calls[0][3]).toMatchObject({
      providerId: 'pay-1',
      linhaDigitavel: undefined,
      tomador: { cnpj: '12345678901234', nome: 'Empresa fictícia' },
    });
  });

  it('rejeita nome vazio na edição parcial e rotula sessão individual no CSV', async () => {
    await expect(updateConvenio(context, 'conv-1', { nome: '   ' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const csv = await convenioReport(context, 'conv-1', { format: 'csv' });
    expect(String(csv.body)).toContain('Pagamento individual');
  });
});
