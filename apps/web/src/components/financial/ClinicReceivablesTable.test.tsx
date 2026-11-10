import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { chargeDueFieldValues, futureChargeDueIso } from '@/components/scheduling/ChargeDueFields';
import { ClinicReceivablesTable, type Atendimento } from './ClinicReceivablesTable';

const base: Atendimento = { chargeId: 'charge-test', patientId: 'patient-test', sessionId: 'session-test',
  pacienteNome: 'Paciente fictício', psicologoId: 'pro-test', psicologoNome: 'Profissional fictício',
  vencimentoEm: '2099-01-02T22:30:00Z', status: 'pending', valorLiquidoCents: 10000, recebidoCents: 0,
  emAbertoCents: 10000, creditoPsicologoCents: 0, receitaClinicaCents: 0, nfseStatus: 'none', custeadoPelaEmpresa: false };
const render = (item: Partial<Atendimento>, eAdmin = true) => renderToStaticMarkup(
  <ClinicReceivablesTable atendimentos={[{ ...base, ...item }]} eAdmin={eAdmin} abrirPreviaNfse={vi.fn()} onPaymentSaved={vi.fn()} />);

it.each(['draft', 'pending', 'overdue'] as const)('oferece a edição de vencimento à gestão na cobrança %s', (status) => {
  expect(render({ status })).toContain('Editar vencimento de Paciente fictício');
});

it.each([
  ['paga', { status: 'paid' as const, recebidoCents: 10000, emAbertoCents: 0 }],
  ['parcialmente paga', { status: 'partially_paid' as const, recebidoCents: 4000 }],
  ['cancelada', { status: 'cancelled' as const }],
  ['custeada pela empresa', { custeadoPelaEmpresa: true }],
  ['faturada ao convênio', { faturaConvenioId: 'invoice-test' }],
])('não oferece a edição em cobrança %s', (_, item) => {
  expect(render(item)).not.toContain('Editar vencimento');
});

it('não oferece a edição a quem não é da administração', () => {
  expect(render({}, false)).not.toContain('Editar vencimento');
});

it('abre o vencimento atual no fuso da clínica', () => {
  expect(chargeDueFieldValues('2099-01-02T22:30:00Z')).toEqual({ date: '2099-01-02', time: '19:30' });
  expect(chargeDueFieldValues('2099-01-03T02:10:00Z')).toEqual({ date: '2099-01-02', time: '23:10' });
});

it('recusa vencimento passado antes de enviar, igual nas três telas', () => {
  expect(() => futureChargeDueIso('2000-01-01', '10:00')).toThrow('O vencimento deve estar no futuro.');
  expect(futureChargeDueIso('2099-01-02', '19:30')).toBe('2099-01-02T22:30:00.000Z');
});
