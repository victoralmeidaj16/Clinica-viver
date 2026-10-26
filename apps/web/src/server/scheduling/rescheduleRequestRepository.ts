import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { resetAppointmentChargeDue } from '@/server/payments/sessionChargeDue';
import { listAvailableSlots, type PacienteIdentificado } from './agendaRepository';

export interface RescheduleRequestSummary {
  id: string;
  sequence: number;
  appointmentId: string;
  currentStartsAt: string;
  currentEndsAt: string;
  requestedStartsAt: string;
  requestedEndsAt: string;
  requestedModality: 'online' | 'presencial' | 'telefone';
  requestedAt: string;
}

export type RequestRescheduleResult =
  | { ok: true; request: RescheduleRequestSummary }
  | { ok: false; reason: 'NOT_FOUND' | 'TOO_LATE' | 'UNAVAILABLE' | 'UNCHANGED' | 'ALREADY_PENDING' };

export type DecideRescheduleResult =
  | { ok: true; decision: 'accepted'; appointmentId: string; previousStartsAt: string; startsAt: string; endsAt: string; version: number }
  | { ok: true; decision: 'rejected'; appointmentId: string; startsAt: string; requestSequence: number; notifyPatient: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'APPOINTMENT_CHANGED' | 'UNAVAILABLE' | 'EXPIRED' };

function summary(row: RowDataPacket): RescheduleRequestSummary {
  return {
    id: String(row.id),
    sequence: Number(row.numero),
    appointmentId: String(row.agendamento_id),
    currentStartsAt: new Date(row.inicio_atual).toISOString(),
    currentEndsAt: new Date(row.fim_atual).toISOString(),
    requestedStartsAt: new Date(row.inicio_solicitado).toISOString(),
    requestedEndsAt: new Date(row.fim_solicitado).toISOString(),
    requestedModality: row.modalidade_solicitada,
    requestedAt: new Date(row.solicitado_em).toISOString(),
  };
}

export async function requestPatientReschedule(
  patient: PacienteIdentificado,
  appointmentId: string,
  requestedStartIso: string,
  now: Date = new Date()
): Promise<RequestRescheduleResult> {
  const requestedStart = new Date(requestedStartIso);
  if (!Number.isFinite(requestedStart.getTime()) || requestedStart.getTime() > now.getTime() + 60 * 86_400_000) {
    return { ok: false, reason: 'UNAVAILABLE' };
  }
  const slots = await listAvailableSlots(patient, requestedStart, new Date(requestedStart.getTime() + 86_400_000), now);
  const slot = slots.find((candidate) => candidate.inicio === requestedStart.toISOString());
  if (!slot) return { ok: false, reason: 'UNAVAILABLE' };

  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM clinica_profissionais WHERE instituicao_id = ? AND id = ? FOR UPDATE', [instituicaoId(), patient.professionalRowId]);
    const [appointments] = await connection.query<RowDataPacket[]>(
      `SELECT id, inicio, COALESCE(fim, DATE_ADD(inicio, INTERVAL duracao_min MINUTE)) AS fim
         FROM clinica_agendamentos
        WHERE instituicao_id = ? AND profissional_id = ? AND paciente_id = ?
          AND (id = ? OR ref_core = ?) AND status IN ('agendado', 'confirmado')
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), patient.professionalRowId, patient.patientRowId, appointmentId, appointmentId]
    );
    const appointment = appointments[0];
    if (!appointment) { await connection.rollback(); return { ok: false, reason: 'NOT_FOUND' }; }
    const currentStart = new Date(appointment.inicio);
    if ((currentStart.getTime() - now.getTime()) / 3_600_000 < 2) {
      await connection.rollback(); return { ok: false, reason: 'TOO_LATE' };
    }
    if (currentStart.getTime() === requestedStart.getTime()) {
      await connection.rollback(); return { ok: false, reason: 'UNCHANGED' };
    }
    const [pending] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM clinica_solicitacoes_reagendamento
        WHERE instituicao_id = ? AND agendamento_id = ? AND status = 'pendente' LIMIT 1 FOR UPDATE`,
      [instituicaoId(), appointment.id]
    );
    if (pending.length) { await connection.rollback(); return { ok: false, reason: 'ALREADY_PENDING' }; }
    const [sequences] = await connection.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(numero), 0) + 1 AS proximo FROM clinica_solicitacoes_reagendamento WHERE agendamento_id = ?',
      [appointment.id]
    );
    const id = randomUUID();
    const sequence = Number(sequences[0]?.proximo ?? 1);
    const requestedEnd = new Date(slot.fim);
    await connection.execute(
      `INSERT INTO clinica_solicitacoes_reagendamento
        (id, instituicao_id, agendamento_id, paciente_id, profissional_id, numero,
         inicio_atual, fim_atual, inicio_solicitado, fim_solicitado, modalidade_solicitada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, instituicaoId(), appointment.id, patient.patientRowId, patient.professionalRowId, sequence,
        currentStart, new Date(appointment.fim), requestedStart, requestedEnd, slot.modalidade]
    );
    await connection.commit();
    return { ok: true, request: { id, sequence, appointmentId: String(appointment.id),
      currentStartsAt: currentStart.toISOString(), currentEndsAt: new Date(appointment.fim).toISOString(),
      requestedStartsAt: requestedStart.toISOString(), requestedEndsAt: requestedEnd.toISOString(),
      requestedModality: slot.modalidade, requestedAt: now.toISOString() } };
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return { ok: false, reason: 'ALREADY_PENDING' };
    throw error;
  } finally { connection.release(); }
}

export async function findPendingPatientRescheduleRequest(
  patient: PacienteIdentificado,
  appointmentId: string
): Promise<RescheduleRequestSummary | null> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT * FROM clinica_solicitacoes_reagendamento
      WHERE instituicao_id = ? AND profissional_id = ? AND paciente_id = ? AND agendamento_id = ?
        AND status = 'pendente' LIMIT 1`,
    [instituicaoId(), patient.professionalRowId, patient.patientRowId, appointmentId]
  );
  return rows[0] ? summary(rows[0]) : null;
}

export async function decidePatientRescheduleRequest(
  organizationId: string,
  professionalId: string,
  requestId: string,
  decision: 'accept' | 'reject',
  now: Date = new Date()
): Promise<DecideRescheduleResult> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.query<RowDataPacket[]>(
      `SELECT sr.*, p.id AS profissional_row_id
         FROM clinica_solicitacoes_reagendamento sr
         JOIN clinica_profissionais p ON p.id = sr.profissional_id
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        WHERE sr.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ? AND sr.id = ?
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), organizationId, professionalId, requestId]
    );
    const request = requests[0];
    if (!request) { await connection.rollback(); return { ok: false, reason: 'NOT_FOUND' }; }
    if (request.status !== 'pendente') { await connection.rollback(); return { ok: false, reason: 'NOT_PENDING' }; }
    const [appointments] = await connection.query<RowDataPacket[]>(
      `SELECT id, inicio, COALESCE(fim, DATE_ADD(inicio, INTERVAL duracao_min MINUTE)) AS fim, status, versao
         FROM clinica_agendamentos WHERE instituicao_id = ? AND id = ? LIMIT 1 FOR UPDATE`,
      [instituicaoId(), request.agendamento_id]
    );
    const appointment = appointments[0];
    if (!appointment) {
      await connection.rollback(); return { ok: false, reason: 'APPOINTMENT_CHANGED' };
    }
    if (decision === 'reject') {
      await connection.execute(
        `UPDATE clinica_solicitacoes_reagendamento SET status = 'recusada', respondido_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND id = ? AND status = 'pendente'`,
        [instituicaoId(), requestId]
      );
      await connection.commit();
      return { ok: true, decision: 'rejected', appointmentId: String(appointment.id),
        startsAt: new Date(appointment.inicio).toISOString(), requestSequence: Number(request.numero),
        notifyPatient: ['agendado', 'confirmado'].includes(String(appointment.status))
          && new Date(appointment.inicio).getTime() > now.getTime() };
    }
    // Só o aceite depende de a sessão continuar no estado e horário originais.
    // A recusa precisa liberar a pendência mesmo depois de uma edição direta.
    if (!['agendado', 'confirmado'].includes(String(appointment.status))
        || new Date(appointment.inicio).getTime() !== new Date(request.inicio_atual).getTime()) {
      await connection.rollback(); return { ok: false, reason: 'APPOINTMENT_CHANGED' };
    }
    const requestedStart = new Date(request.inicio_solicitado);
    const requestedEnd = new Date(request.fim_solicitado);
    // A solicitação pode ficar pendente até depois do horário pedido.
    if (requestedStart.getTime() <= now.getTime()) {
      await connection.rollback(); return { ok: false, reason: 'EXPIRED' };
    }
    const [conflicts] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM clinica_agendamentos WHERE instituicao_id = ? AND profissional_id = ?
        AND status <> 'cancelado' AND id <> ? AND inicio < ?
        AND COALESCE(fim, DATE_ADD(inicio, INTERVAL duracao_min MINUTE)) > ? FOR UPDATE`,
      [instituicaoId(), request.profissional_row_id, appointment.id, requestedEnd, requestedStart]
    );
    const [blocks] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM clinica_agenda_bloqueios WHERE instituicao_id = ? AND profissional_id = ?
        AND inicio < ? AND fim > ? FOR UPDATE`,
      [instituicaoId(), request.profissional_row_id, requestedEnd, requestedStart]
    );
    if (conflicts.length || blocks.length) { await connection.rollback(); return { ok: false, reason: 'UNAVAILABLE' }; }
    const duration = Math.round((requestedEnd.getTime() - requestedStart.getTime()) / 60_000);
    await connection.execute(
      `UPDATE clinica_agendamentos SET inicio = ?, fim = ?, duracao_min = ?, modalidade = ?,
        status = 'agendado', versao = versao + 1, atualizado_em = CURRENT_TIMESTAMP(3)
       WHERE instituicao_id = ? AND id = ?`,
      [requestedStart, requestedEnd, duration, request.modalidade_solicitada, instituicaoId(), appointment.id]
    );
    await resetAppointmentChargeDue(connection, String(appointment.id), requestedStart.toISOString());
    await connection.execute(
      `UPDATE clinica_solicitacoes_reagendamento SET status = 'aceita', respondido_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND id = ? AND status = 'pendente'`,
      [instituicaoId(), requestId]
    );
    await connection.commit();
    return { ok: true, decision: 'accepted', appointmentId: String(appointment.id),
      previousStartsAt: new Date(appointment.inicio).toISOString(), startsAt: requestedStart.toISOString(),
      endsAt: requestedEnd.toISOString(), version: Number(appointment.versao ?? 0) + 1 };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
