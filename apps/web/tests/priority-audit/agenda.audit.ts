import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { scheduleAppointmentCommand } from '@thats-life/core';
import { fixture, org, when } from './fixtures';
import { fromSqlTimestamp, instituicaoId, rowId } from '@/server/persistence/mysql/mappers';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  store: {} as unknown,
  enviar: vi.fn(),
  asaas: { get: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/server/application/store', () => ({ getApplicationStore: () => state.store, persistApplicationState: async () => {} }));
vi.mock('@/server/application/persistence', async (original) => ({
  ...await original<typeof import('@/server/application/persistence')>(), readSnapshot: () => null,
}));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  enviarTexto: state.enviar, avisarConfirmacaoPaciente: vi.fn(), responderPsicologo: vi.fn(),
  avisarTransbordo: vi.fn(), avisarCoordenacao: vi.fn(),
}));
vi.mock('@/server/adapters/asaasAdapter', async (original) => ({
  ...await original<typeof import('@/server/adapters/asaasAdapter')>(),
  getAsaasPayment: state.asaas.get, deleteAsaasPayment: state.asaas.remove,
}));
vi.mock('@/server/application/patientPromotion', () => ({ reconciliarPacientes: vi.fn() }));
vi.mock('@/server/viverMaisGestaoAuth', () => ({ exigirGestao: async () => {}, NaoAutorizadoError: class extends Error {} }));
vi.mock('@/server/application/psychologistInvitation', () => ({ enviarConvitePsicologo: vi.fn() }));

import { reassignPatient } from '@/server/application/patientDirectory';
import {
  cancelAgendaAppointment, editAgendaAppointment, rescheduleAgendaAppointment,
} from '@/server/application/agendaService';
import { changeAppointment, createAppointmentFlow } from '@/server/application/appointmentService';
import { createBlock, rescheduleAppointmentProfessional, updateAppointmentDetails } from '@/server/scheduling/agendaRepository';
import { liberarAvisosAguardando } from '@/server/scheduling/agendaAvisosPendentes';

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede externa proibida nesta auditoria.'); }));
  state.enviar.mockReset().mockResolvedValue({ situacao: 'enviada' });
  state.asaas.get.mockReset().mockResolvedValue({ status: 'PENDING' });
  state.asaas.remove.mockReset().mockResolvedValue(true);
  f = await fixture();
  state.store = f.store;
  await f.pool.execute('UPDATE clinica_pacientes SET telefone = ? WHERE id = ?',
    ['5511999999999', rowId('paciente', f.patient.id)]);
});
afterEach(() => { vi.useRealTimers(); });
afterAll(async () => { vi.unstubAllGlobals(); await f?.pool.end(); });

const admin = () => ({ ...f.context, actor: { ...f.context.actor, roles: ['admin' as const] } });
const as = (professionalProfileId: string) => ({ ...f.context, idempotencyKey: `audit-${randomUUID()}`,
  actor: { ...f.context.actor, professionalProfileId } });

/** Sessão fictícia de 50 minutos; `inicio` em UTC. */
async function seed(inicio: string, minutos = 50, professional = f.pro) {
  const ref = `appointment-${randomUUID()}`;
  const fim = new Date(Date.parse(inicio) + minutos * 60_000);
  await f.pool.execute(`INSERT INTO clinica_agendamentos
    (id, instituicao_id, ref_core, organizacao_id, paciente_id, profissional_id,
     inicio, fim, duracao_min, modalidade, status, servico_key, versao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', 'agendado', 'PSICOTERAPIA', 1)`,
  [rowId('agendamento', ref), instituicaoId(), ref, rowId('organizacao', org),
    rowId('paciente', f.patient.id), rowId('profissional', professional), new Date(inicio), fim, minutos]);
  return { ref, id: rowId('agendamento', ref) };
}

async function row(id: string) {
  const [rows] = await f.pool.query<RowDataPacket[]>(
    'SELECT inicio, fim, status, versao, cobranca_vence_em FROM clinica_agendamentos WHERE id = ?', [id]);
  const r = rows[0];
  return { ...r, inicio: fromSqlTimestamp(r.inicio), fim: fromSqlTimestamp(r.fim),
    cobranca_vence_em: fromSqlTimestamp(r.cobranca_vence_em) };
}

const enviosPara = (id: string, finalidade?: string) => state.enviar.mock.calls.filter((call) =>
  String(call[3]).includes(id) && (!finalidade || call[2] === finalidade));

async function encaminhar() {
  await f.capture.mutate((s) => ({ next: { ...s, triagensPacientes: [...s.triagensPacientes, {
    id: `lead-${f.patient.id}`, protocolo: 'VM-FICTICIO', nomePaciente: 'Paciente fictício', telefone: '',
    convenioSelecionado: 'Nenhum', origem: 'manual', turno: 'TARDE', status: 'CONTATO_CONFIRMADO' as const,
    pacienteRef: f.patient.id, psicologoAlocadoId: `cad-${f.pro}`, confirmadoEm: when, criadoEm: when,
  }] }, result: null }));
  await reassignPatient(admin(), { id: f.patient.id, professionalId: f.other, motivo: 'Encaminhamento fictício' });
}

it('1 — após o encaminhamento, o novo psicólogo não edita nem cancela a agenda do anterior', async () => {
  const { ref, id } = await seed('2030-01-01T12:00:00.000Z');
  await encaminhar();
  const novo = as(f.other);
  const tentativas = await Promise.allSettled([
    cancelAgendaAppointment(novo, id, 'Tentativa fictícia'),
    rescheduleAgendaAppointment(novo, id, '2030-01-02T12:00:00.000Z', '2030-01-02T12:50:00.000Z'),
    editAgendaAppointment(novo, id, { modalidade: 'presencial' }),
    changeAppointment(novo, ref, { action: 'cancel', reasonCode: 'USER_REQUEST' }),
    changeAppointment(novo, ref, { action: 'reschedule',
      startsAt: '2030-01-03T12:00:00.000Z', endsAt: '2030-01-03T12:50:00.000Z' }),
  ]);
  expect(tentativas.map((t) => t.status)).toEqual(Array(5).fill('rejected'));
  expect(await row(id)).toMatchObject({ status: 'agendado', versao: 1,
    inicio: '2030-01-01T12:00:00.000Z' });
  expect(state.enviar).not.toHaveBeenCalled();
});

it('3 — horários parcialmente sobrepostos com inícios diferentes são recusados', async () => {
  await seed('2030-01-01T12:00:00.000Z');
  const outra = await seed('2030-01-01T15:00:00.000Z');
  const proprio = as(f.pro);
  await expect(rescheduleAgendaAppointment(proprio, outra.id, '2030-01-01T12:30:00.000Z', '2030-01-01T13:20:00.000Z'))
    .rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
  await expect(editAgendaAppointment(proprio, outra.id, { startsAt: '2030-01-01T11:30:00.000Z', endsAt: '2030-01-01T12:20:00.000Z' }))
    .rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
  const novo = (startsAt: string, endsAt: string) => scheduleAppointmentCommand(
    { appointments: f.appointments, identities: f.identities }, admin().actor,
    { id: `appointment-${randomUUID()}`, organizationId: org, patientId: f.patient.id, professionalId: f.pro,
      startsAt, endsAt, timezone: 'America/Sao_Paulo', mode: 'video', reminders: [], createdAt: when },
    { actorUserId: 'audit-user', occurredAt: when, correlationId: 'audit', commandId: `audit-${randomUUID()}` });
  await expect(novo('2030-01-01T12:40:00.000Z', '2030-01-01T13:30:00.000Z')).rejects.toThrow(/conflito/);
  // Duas marcações simultâneas que se cruzam por 30 minutos: só uma permanece.
  const corrida = await Promise.allSettled([
    novo('2030-01-05T12:00:00.000Z', '2030-01-05T12:50:00.000Z'),
    novo('2030-01-05T12:20:00.000Z', '2030-01-05T13:10:00.000Z'),
  ]);
  expect(corrida.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await outraNoDia('2030-01-05')).toBe(1);
  expect(await row(outra.id)).toMatchObject({ inicio: '2030-01-01T15:00:00.000Z' });
});

async function outraNoDia(dia: string) {
  const [rows] = await f.pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM clinica_agendamentos WHERE profissional_id = ? AND status <> 'cancelado'
      AND DATE(inicio) = ?`, [rowId('profissional', f.pro), dia]);
  return Number(rows[0].total);
}

/**
 * Pausa a transação de remarcação logo antes do UPDATE e cria o bloqueio nessa
 * janela. Sem a pausa, a corrida dependeria do escalonador.
 */
async function bloqueioDuranteAMarcacao(marcar: () => Promise<unknown>) {
  const original = f.pool.getConnection.bind(f.pool);
  let bloqueio: Promise<string> | undefined;
  vi.spyOn(f.pool, 'getConnection').mockImplementation(async () => {
    const connection = await original() as PoolConnection;
    const execute = connection.execute.bind(connection);
    vi.spyOn(connection, 'execute').mockImplementation(((sql: string, ...rest: unknown[]) => {
      if (!bloqueio && /UPDATE clinica_agendamentos\s+SET (inicio|[\s\S]*inicio = \?)/.test(String(sql))) {
        bloqueio = createBlock(org, f.pro, { inicio: '2030-02-01T13:00:00.000Z', fim: '2030-02-01T15:00:00.000Z' });
        return Promise.race([bloqueio, new Promise((r) => setTimeout(r, 600))])
          .then(() => (execute as (...a: unknown[]) => unknown)(sql, ...rest));
      }
      return (execute as (...a: unknown[]) => unknown)(sql, ...rest);
    }) as never);
    return connection;
  });
  const marcado = await Promise.allSettled([marcar()]);
  vi.mocked(f.pool.getConnection).mockRestore();
  const criado = await bloqueio;
  return { marcado: marcado[0], criado };
}

it.each([
  ['reagendamento', (id: string) => rescheduleAppointmentProfessional(org, f.pro, id,
    '2030-02-01T14:00:00.000Z', '2030-02-01T14:50:00.000Z')],
  ['edição de horário', (id: string) => updateAppointmentDetails(org, f.pro, id,
    { startsAt: '2030-02-01T14:00:00.000Z', endsAt: '2030-02-01T14:50:00.000Z' })],
])('4 — bloqueio criado durante a %s não deixa a sessão no período bloqueado', async (_nome, marcar) => {
  const { id } = await seed('2030-02-01T18:00:00.000Z');
  const { marcado, criado } = await bloqueioDuranteAMarcacao(() => marcar(id));
  const sessao = await row(id);
  const [bloqueios] = await f.pool.query<RowDataPacket[]>(
    'SELECT inicio, fim FROM clinica_agenda_bloqueios WHERE profissional_id = ?', [rowId('profissional', f.pro)]);
  const sobrepoe = bloqueios.some((b) => fromSqlTimestamp(b.inicio)! < sessao.fim! && fromSqlTimestamp(b.fim)! > sessao.inicio!);
  expect(sobrepoe).toBe(false);
  expect(criado).toBeDefined();
  expect([marcado.status === 'fulfilled' && marcado.value === 'ok', criado === 'created']).toContain(true);
});

it('4b — bloqueio e marcação manual simultâneos não ocupam o mesmo período', async () => {
  const [marcado, criado] = await Promise.allSettled([
    scheduleAppointmentCommand({ appointments: f.appointments, identities: f.identities }, admin().actor,
      { id: `appointment-${randomUUID()}`, organizationId: org, patientId: f.patient.id, professionalId: f.pro,
        startsAt: '2030-02-02T14:00:00.000Z', endsAt: '2030-02-02T14:50:00.000Z', timezone: 'America/Sao_Paulo',
        mode: 'video', reminders: [], createdAt: when },
      { actorUserId: 'audit-user', occurredAt: when, correlationId: 'audit', commandId: `audit-${randomUUID()}` }),
    createBlock(org, f.pro, { inicio: '2030-02-02T13:00:00.000Z', fim: '2030-02-02T15:00:00.000Z' }),
  ]);
  const ok = [marcado.status === 'fulfilled', criado.status === 'fulfilled' && criado.value === 'created'];
  expect(ok.filter(Boolean)).toHaveLength(1);
});

it('6 — reagendamentos simultâneos preservam uma alteração e o vencimento correspondente', async () => {
  const { id } = await seed('2030-03-01T12:00:00.000Z');
  const destinos = ['2030-03-02T12:00:00.000Z', '2030-03-03T12:00:00.000Z'];
  const resultados = await Promise.all(destinos.map((inicio) => rescheduleAppointmentProfessional(org, f.pro, id,
    inicio, new Date(Date.parse(inicio) + 50 * 60_000).toISOString(), { expectedVersion: 1 })));
  expect(resultados.filter((r) => r === 'ok')).toHaveLength(1);
  expect(resultados.filter((r) => r === 'stale')).toHaveLength(1);
  const vencedor = destinos[resultados.indexOf('ok')];
  const sessao = await row(id);
  expect(sessao).toMatchObject({ versao: 2, inicio: vencedor, cobranca_vence_em: vencedor });
  expect(enviosPara(id, 'agenda_remarcacao_paciente')).toHaveLength(1);
});

it('7 — confirmações concorrentes da mesma marcação enviam uma única mensagem', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T13:00:00.000Z')); // quarta-feira, 10h na clínica
  const body = { id: `appointment-manual-${randomUUID()}`, organizationId: org, patientId: f.patient.id,
    professionalId: f.pro, startsAt: '2030-04-01T12:00:00.000Z', endsAt: '2030-04-01T12:50:00.000Z',
    timezone: 'America/Sao_Paulo', mode: 'video' as const, reminders: [], createdAt: when };
  const contexto = as(f.pro);
  const resultados = await Promise.allSettled(Array.from({ length: 4 },
    () => createAppointmentFlow(contexto, body, undefined, 'PSICOTERAPIA')));
  expect(resultados.filter((r) => r.status === 'fulfilled').length).toBeGreaterThan(0);
  const id = rowId('agendamento', body.id);
  expect(enviosPara(id, 'agenda_confirmacao_paciente')).toHaveLength(1);
  const [linhas] = await f.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM clinica_agendamentos WHERE id = ?', [id]);
  expect(Number(linhas[0].total)).toBe(1);
});

it('8 — aviso marcado fora do expediente fica na fila até a abertura comercial', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T13:00:00.000Z')); // sábado, 10h na clínica
  const body = { id: `appointment-manual-${randomUUID()}`, organizationId: org, patientId: f.patient.id,
    professionalId: f.pro, startsAt: '2030-04-02T12:00:00.000Z', endsAt: '2030-04-02T12:50:00.000Z',
    timezone: 'America/Sao_Paulo', mode: 'video' as const, reminders: [], createdAt: when };
  await createAppointmentFlow(as(f.pro), body, undefined, 'PSICOTERAPIA');
  const id = rowId('agendamento', body.id);
  expect(enviosPara(id)).toHaveLength(0);
  const [fila] = await f.pool.query<RowDataPacket[]>(
    "SELECT situacao, enviar_em FROM clinica_agenda_avisos WHERE agendamento_id = ? AND tipo = 'confirmacao_paciente'", [id]);
  expect(fila).toHaveLength(1);
  expect({ ...fila[0], enviar_em: fromSqlTimestamp(fila[0].enviar_em) })
    .toMatchObject({ situacao: 'aguardando_horario', enviar_em: '2026-11-02T11:00:00.000Z' });
  for (const agora of ['2026-11-01T15:00:00.000Z', '2026-11-02T10:59:00.000Z']) {
    await liberarAvisosAguardando(new Date(agora));
    expect(enviosPara(id)).toHaveLength(0);
  }
  await liberarAvisosAguardando(new Date('2026-11-02T11:00:00.000Z'));
  await liberarAvisosAguardando(new Date('2026-11-02T11:05:00.000Z'));
  expect(enviosPara(id, 'agenda_confirmacao_paciente')).toHaveLength(1);
});

it('9 — cancelamento repetido não duplica a mensagem nem o cancelamento da cobrança', async () => {
  const { ref, id } = await seed('2030-05-01T12:00:00.000Z');
  await f.financial.saveCharge({ ...f.charge, sessionId: ref, providerReference: `pay-${f.charge.id}` });
  const proprio = as(f.pro);
  await Promise.allSettled([
    cancelAgendaAppointment(proprio, id, 'Motivo fictício'),
    cancelAgendaAppointment(proprio, id, 'Motivo fictício'),
    changeAppointment(as(f.pro), ref, { action: 'cancel', reasonCode: 'USER_REQUEST' }),
  ]);
  await cancelAgendaAppointment(proprio, id, 'Motivo fictício').catch(() => undefined);
  await changeAppointment(as(f.pro), ref, { action: 'cancel', reasonCode: 'USER_REQUEST' }).catch(() => undefined);
  expect(await row(id)).toMatchObject({ status: 'cancelado' });
  expect(enviosPara(id, 'agenda_cancelamento_paciente')).toHaveLength(1);
  expect(state.asaas.remove).toHaveBeenCalledOnce();
  const [cobranca] = await f.pool.query<RowDataPacket[]>(
    'SELECT status FROM financeiro_cobrancas WHERE ref_core = ?', [f.charge.id]);
  expect(cobranca[0].status).toBe('cancelled');
});
