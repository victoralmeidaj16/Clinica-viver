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
import { listAvailableSlots } from './agendaRepository';

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
      status: 'pendente', inicio_atual: '2026-10-23T15:00:00.000Z', fim_atual: '2026-10-23T15:50:00.000Z',
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
  it('não permite ao paciente mudar a duração ao pedir outro horário', async () => {
    vi.mocked(listAvailableSlots).mockResolvedValueOnce([{
      inicio: '2026-10-22T15:00:00.000Z', fim: '2026-10-22T16:30:00.000Z',
      dia: '2026-10-22', hora: '12:00', modalidade: 'online',
    }]);
    expect(await requestPatientReschedule(patient, 'appointment-1', '2026-10-22T15:00:00.000Z', new Date('2026-10-20T12:00:00Z')))
      .toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(state.connection.execute).not.toHaveBeenCalled();
  });

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

const ANTES = new Date('2026-10-20T12:00:00Z');

describe('decisão do psicólogo', () => {
  it('não aceita pedido após o início da sessão original', async () => {
    const query = state.connection.query.getMockImplementation()!;
    state.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clinica_solicitacoes_reagendamento sr')) {
        const [rows, fields] = await query(sql);
        return [[{ ...rows[0], inicio_solicitado: '2026-10-25T15:00:00Z', fim_solicitado: '2026-10-25T15:50:00Z' }], fields];
      }
      return query(sql);
    });
    expect(await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'accept', new Date('2026-10-23T15:01:00Z')))
      .toEqual({ ok: false, reason: 'ORIGINAL_STARTED' });
    expect(state.connection.execute).not.toHaveBeenCalled();
  });
  it('libera nova solicitação depois de recusar o pedido de um horário alterado', async () => {
    let pending = true;
    const query = state.connection.query.getMockImplementation()!;
    state.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clinica_agendamentos WHERE') || (sql.includes('FROM clinica_agendamentos') && sql.includes('paciente_id'))) {
        return [[{ id: 'appointment-1', status: 'agendado', inicio: '2026-10-24T15:00:00Z', fim: '2026-10-24T15:50:00Z' }], []];
      }
      if (sql.includes("status = 'pendente'")) return [pending ? [{ id: 'request-1' }] : [], []];
      return query(sql);
    });
    state.connection.execute.mockImplementation(async (sql: string) => {
      if (sql.includes("status = 'recusada'")) pending = false;
      return [{ affectedRows: 1 }, []];
    });
    expect(await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'reject', ANTES)).toMatchObject({ ok: true });
    expect(await requestPatientReschedule(patient, 'appointment-1', '2026-10-22T15:00:00.000Z', ANTES)).toMatchObject({ ok: true });
  });
  const changedAppointments = [
    { status: 'agendado', inicio: '2026-10-24T15:00:00Z', notifyPatient: true },
    { status: 'cancelado', inicio: '2026-10-23T15:00:00Z', notifyPatient: false },
    { status: 'realizado', inicio: '2026-10-23T15:00:00Z', notifyPatient: false },
  ];
  it.each(changedAppointments)('encerra pedido antigo após sessão $status sem mudar agenda ou cobrança', async (appointment) => {
    const query = state.connection.query.getMockImplementation()!;
    state.connection.query.mockImplementation(async (sql: string) => sql.includes('FROM clinica_agendamentos WHERE')
      ? [[{ id: 'appointment-1', ...appointment }], []] : query(sql));
    expect(await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'reject', ANTES))
      .toMatchObject({ ok: true, decision: 'rejected', notifyPatient: appointment.notifyPatient });
    expect(state.connection.execute).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("status = 'recusada'"), ['inst', 'request-1']);
    expect(state.resetCharge).not.toHaveBeenCalled();
    expect(state.connection.commit).toHaveBeenCalledOnce();
  });
  it.each(changedAppointments)('continua recusando aceite após sessão $status alterada', async (appointment) => {
    const query = state.connection.query.getMockImplementation()!;
    state.connection.query.mockImplementation(async (sql: string) => sql.includes('FROM clinica_agendamentos WHERE')
      ? [[{ id: 'appointment-1', ...appointment }], []] : query(sql));
    expect(await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'accept', ANTES))
      .toEqual({ ok: false, reason: 'APPOINTMENT_CHANGED' });
    expect(state.connection.execute).not.toHaveBeenCalled();
    expect(state.resetCharge).not.toHaveBeenCalled();
  });
  it('não aceita pedido cujo horário já passou', async () => {
    expect(await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'accept', new Date('2026-10-22T15:10:00Z')))
      .toEqual({ ok: false, reason: 'EXPIRED' });
    expect(state.connection.execute).not.toHaveBeenCalled();
    expect(state.connection.rollback).toHaveBeenCalled();
  });

  it('não altera nada quando o horário solicitado foi ocupado', async () => {
    state.conflict = true;
    expect(await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'accept', ANTES))
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
    const result = await decidePatientRescheduleRequest('org', 'pro-ref', 'request-1', 'accept', ANTES);
    expect(result).toMatchObject({ ok: true, decision: 'accepted', appointmentId: 'appointment-1', version: 3 });
    expect(state.connection.execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE clinica_agendamentos'))).toBe(true);
    expect(state.connection.execute.mock.calls.some(([sql]) => String(sql).includes("status = 'aceita'"))).toBe(true);
    expect(state.resetCharge).toHaveBeenCalledWith(state.connection, 'appointment-1', '2026-10-22T15:00:00.000Z');
    expect(state.connection.commit).toHaveBeenCalledOnce();
  });
});
