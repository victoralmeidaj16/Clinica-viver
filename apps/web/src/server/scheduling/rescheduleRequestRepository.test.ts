import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  conflict: false,
  resetCharge: vi.fn(),
  connection: { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => state.connection, query: state.connection.query }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst' }));
vi.mock('@/server/payments/sessionChargeDue', () => ({ resetAppointmentChargeDue: state.resetCharge }));
vi.mock('./agendaRepository', () => ({
  listAvailableSlots: vi.fn(async () => [{ inicio: '2026-10-22T15:00:00.000Z', fim: '2026-10-22T15:50:00.000Z', modalidade: 'online' }]),
}));
import { decidePatientRescheduleRequest, requestPatientReschedule } from './rescheduleRequestRepository';

const patient = { patientRef: 'p-ref', patientRowId: 'p-row', nome: 'Paciente', organizationId: 'org',
  professionalId: 'pro-ref', professionalRowId: 'pro-row', professionalName: 'Psi', sessionAmountCents: 10000 };

beforeEach(() => {
  vi.clearAllMocks(); state.conflict = false;
  state.connection.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
  state.connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM clinica_agendamentos') && sql.includes('paciente_id')) return [[{
      id: 'appointment-1', inicio: '2026-10-23T15:00:00.000Z', fim: '2026-10-23T15:50:00.000Z',
    }], []];
    if (sql.includes("status = 'pendente'")) return [[], []];
    if (sql.includes('MAX(numero)')) return [[{ proximo: 1 }], []];
    if (sql.includes('FROM clinica_solicitacoes_reagendamento sr')) return [[{
      id: 'request-1', agendamento_id: 'appointment-1', profissional_row_id: 'pro-row', numero: 1,
      status: 'pendente', inicio_atual: '2026-10-23T15:00:00.000Z',
      inicio_solicitado: '2026-10-22T15:00:00.000Z', fim_solicitado: '2026-10-22T15:50:00.000Z',
      modalidade_solicitada: 'online',
    }], []];
    if (sql.includes('FROM clinica_agendamentos') && sql.includes('status <>')) return [state.conflict ? [{ id: 'other' }] : [], []];
    if (sql.includes('FROM clinica_agendamentos WHERE')) return [[{
      id: 'appointment-1', inicio: '2026-10-23T15:00:00.000Z', fim: '2026-10-23T15:50:00.000Z', status: 'agendado', versao: 2,
    }], []];
    return [[], []];
  });
});

describe('solicitação pública de reagendamento', () => {
  it('grava o pedido sem alterar o agendamento', async () => {
    const result = await requestPatientReschedule(patient, 'appointment-1', '2026-10-22T15:00:00.000Z', new Date('2026-10-20T12:00:00Z'));
    expect(result.ok).toBe(true);
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clinica_solicitacoes_reagendamento'), expect.any(Array));
    expect(state.connection.execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE clinica_agendamentos'))).toBe(false);
    expect(state.connection.commit).toHaveBeenCalledOnce();
  });

  it('não cria outro pedido quando já existe pendência', async () => {
    state.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clinica_agendamentos') && sql.includes('paciente_id')) return [[{ id: 'appointment-1', inicio: '2026-10-23T15:00:00Z', fim: '2026-10-23T15:50:00Z' }], []];
      if (sql.includes("status = 'pendente'")) return [[{ id: 'existing' }], []];
      return [[], []];
    });
    expect(await requestPatientReschedule(patient, 'appointment-1', '2026-10-22T15:00:00.000Z', new Date('2026-10-20T12:00:00Z')))
      .toEqual({ ok: false, reason: 'ALREADY_PENDING' });
    expect(state.connection.execute).not.toHaveBeenCalled();
  });
});

describe('decisão do psicólogo', () => {
  it('não altera nada quando o horário solicitado foi ocupado', async () => {
    state.conflict = true;
    expect(await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'accept'))
      .toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(state.connection.execute).not.toHaveBeenCalled();
    expect(state.connection.rollback).toHaveBeenCalled();
  });

  it('recusar encerra o pedido sem alterar a sessão', async () => {
    const result = await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'reject');
    expect(result).toMatchObject({ ok: true, decision: 'rejected', appointmentId: 'appointment-1' });
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining("status = 'recusada'"), ['inst', 'request-1']);
    expect(state.connection.execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE clinica_agendamentos'))).toBe(false);
  });

  it('aceitar altera sessão e pedido na mesma transação', async () => {
    const result = await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'accept');
    expect(result).toMatchObject({ ok: true, decision: 'accepted', appointmentId: 'appointment-1', version: 3 });
    expect(state.connection.execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE clinica_agendamentos'))).toBe(true);
    expect(state.connection.execute.mock.calls.some(([sql]) => String(sql).includes("status = 'aceita'"))).toBe(true);
    expect(state.resetCharge).toHaveBeenCalledWith(state.connection, 'appointment-1', '2026-10-22T15:00:00.000Z');
    expect(state.connection.commit).toHaveBeenCalledOnce();
  });
});
