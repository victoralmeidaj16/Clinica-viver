import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { connection, poolQuery } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  connection: { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));
vi.mock('@/server/oci/runtime', () => ({
  isMysqlConfigured: () => true,
  getMysqlPool: () => ({ query: poolQuery, getConnection: async () => connection }),
}));
vi.mock('@/server/persistence/mysql/mappers', async (original) => ({
  ...await original<typeof import('@/server/persistence/mysql/mappers')>(),
  instituicaoId: () => 'inst', rowId: (prefix: string, ref: string) => `${prefix}:${ref}`,
}));
import {
  bookAppointments,
  getActiveUpcomingAppointment,
  janelasCompativeisComPaciente,
  listAvailability,
  listAvailableSlots,
} from './agendaRepository';
const patient = { patientRef: 'p', patientRowId: 'p', nome: 'Teste', organizationId: 'org',
  professionalId: 'pro', professionalRowId: 'pro', professionalName: 'Teste', sessionAmountCents: 10000 };
const now = new Date('2026-09-14T10:00:00Z');
const janelaDaGrade = { diaSemana: 2, horaInicio: '09:00', horaFim: '12:00', duracaoMin: 50, modalidade: 'online' as const };
const start = '2026-09-15T12:00:00.000Z';
const window = { dia_semana: 2, hora_inicio: '09:00:00', hora_fim: '12:00:00', duracao_min: 60, modalidade: 'presencial' };
beforeEach(() => {
  vi.clearAllMocks();
  poolQuery.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_disponibilidades') ? [window] : [], []]);
  connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM clinica_organizacoes')) return [[{ id: 'org' }], []];
    if (sql.includes('FROM clinica_disponibilidades')) return [[window], []];
    return [[], []];
  });
  connection.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
});
describe('reserva múltipla', () => {
  it('busca a organização somente na instituição do paciente', async () => {
    await bookAppointments(patient, [start], now);
    expect(connection.query).toHaveBeenCalledWith(expect.stringContaining('WHERE instituicao_id = ? AND ref_core = ?'), ['inst', 'org']);
  });
  it('mantém a disponibilidade vazia depois de configurada', async () => {
    poolQuery.mockImplementation(async (sql: string) => [sql.includes('disponibilidade_configurada')
      ? [{ disponibilidade_configurada: 1 }] : [], []]);
    expect(await listAvailability('org', 'pro')).toEqual([]);
    expect(await listAvailableSlots(patient, now, new Date('2026-09-20T00:00:00Z'), now)).toEqual([]);
  });
  it('recusa horário quando a grade mudou antes da reserva', async () => {
    connection.query.mockImplementation(async (sql: string) => [sql.includes('disponibilidade_configurada')
      ? [{ disponibilidade_configurada: 1 }] : [], []]);
    expect(await bookAppointments(patient, [start], now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('normaliza datas equivalentes sem duplicar a reserva', async () => {
    const result = await bookAppointments(patient, [start, '2026-09-15T09:00:00-03:00'], now);
    expect(result.ok && result.agendamentos).toHaveLength(1);
    expect(connection.execute).toHaveBeenCalledOnce();
  });
  it('recusa sobreposição entre horários da própria seleção', async () => {
    poolQuery.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_disponibilidades') ? [window, { ...window, hora_inicio: '09:30:00' }] : [], []]);
    expect(await bookAppointments(patient, [start, '2026-09-15T12:30:00Z'], now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(connection.execute).not.toHaveBeenCalled();
  });
  it('aceita horários consecutivos', async () => {
    const result = await bookAppointments(patient, [start, '2026-09-15T13:00:00Z'], now);
    expect(result.ok && result.agendamentos).toHaveLength(2);
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it('grava o valor resolvido como snapshot do novo agendamento', async () => {
    await expect(bookAppointments({ ...patient, sessionAmountCents: 6800 }, [start], now)).resolves.toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find((call) => String(call[0]).includes('INSERT INTO clinica_agendamentos'));
    expect(insert?.[1]).toContain(6800);
  });
  it('respeita horizonte de 60 dias', async () => {
    expect(await bookAppointments(patient, [start, '2099-01-01T12:00:00Z'], now)).toEqual({ ok: false, motivo: 'INDISPONIVEL' });
    expect(poolQuery).not.toHaveBeenCalled();
  });
});

it('grava acessibilidade na mesma transação do agendamento público com isolamento de organização', async () => {
  await bookAppointments(patient, [start], now, { necessita: true, descricao: 'Acesso sem degraus' });
  expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('pa.acessibilidade = CAST(? AS JSON)'),
    [JSON.stringify({ necessita: true, descricao: 'Acesso sem degraus' }), 'inst', 'org', 'p']);
  expect(connection.commit).toHaveBeenCalledOnce();
});
it('desfaz a reserva se não conseguir salvar a acessibilidade', async () => {
  connection.execute.mockImplementation(async (sql: string) => {
    if (sql.includes('pa.acessibilidade')) throw new Error('falha de gravação');
    return [{ affectedRows: 1 }, []];
  });
  await expect(bookAppointments(patient, [start], now, { necessita: false })).rejects.toThrow('falha de gravação');
  expect(connection.rollback).toHaveBeenCalledOnce();
  expect(connection.commit).not.toHaveBeenCalled();
});

describe('serviço e público na reserva pelo link individual (§§ 2.03 e 7.01–7.05)', () => {
  const janelas50e90 = [
    { dia_semana: 2, hora_inicio: '09:00:00', hora_fim: '10:00:00', duracao_min: 50, modalidade: 'online' },
    { dia_semana: 2, hora_inicio: '14:00:00', hora_fim: '16:00:00', duracao_min: 90, modalidade: 'presencial' },
  ];

  beforeEach(() => {
    poolQuery.mockImplementation(async (sql: string) => [
      sql.includes('FROM clinica_disponibilidades') ? janelas50e90 : [],
      [],
    ]);
    connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clinica_organizacoes')) return [[{ id: 'org' }], []];
      if (sql.includes('FROM clinica_disponibilidades')) return [janelas50e90, []];
      return [[], []];
    });
  });

  it('oferece e aceita apenas janelas de 50 min para Psicoterapia individual', async () => {
    const individual = { ...patient, serviceKey: 'PSICOTERAPIA', publico: 'Adulto', triageMode: 'SOCIAL' };
    const slots = await listAvailableSlots(individual, now, new Date('2026-09-16T00:00:00Z'), now);
    expect(slots.map((s) => s.inicio)).toEqual(['2026-09-15T12:00:00.000Z']);

    expect(await bookAppointments(individual, ['2026-09-15T17:00:00.000Z'], now)).toEqual({
      ok: false, motivo: 'INDISPONIVEL',
    });
    const ok = await bookAppointments(individual, ['2026-09-15T12:00:00.000Z'], now);
    expect(ok).toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find((call) => String(call[0]).includes('INSERT INTO clinica_agendamentos'));
    expect(insert?.[1]).toContain('PSICOTERAPIA');
  });

  it.each(['Família', 'Criança', undefined])('prioriza a modalidade familiar para Orientação Parental com público %s', async (publico) => {
    const familia = { ...patient, serviceKey: 'ORIENTACAO_PARENTAL', publico, triageMode: 'FAMILIA_PARTICULAR' };
    const slots = await listAvailableSlots(familia, now, new Date('2026-09-16T00:00:00Z'), now);
    expect(slots.map((s) => s.inicio)).toEqual(['2026-09-15T17:00:00.000Z']);

    expect(await bookAppointments(familia, ['2026-09-15T12:00:00.000Z'], now)).toEqual({
      ok: false, motivo: 'INDISPONIVEL',
    });
    const ok = await bookAppointments(familia, ['2026-09-15T17:00:00.000Z'], now);
    expect(ok).toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find((call) => String(call[0]).includes('INSERT INTO clinica_agendamentos'));
    expect(insert?.[1]).toContain('ORIENTACAO_PARENTAL');
  });

  it('oferece só a janela de 90 min para psicoterapia em grupo (§ 14)', async () => {
    const grupo = { ...patient, serviceKey: 'PSICOTERAPIA', publico: 'Grupo', triageMode: 'SOCIAL' };
    expect(janelasCompativeisComPaciente(janelas50e90.map((j) => ({ ...janelaDaGrade, duracaoMin: j.duracao_min })), grupo)
      .map((j) => j.duracaoMin)).toEqual([90]);
    const slots = await listAvailableSlots(grupo, now, new Date('2026-09-16T00:00:00Z'), now);
    expect(slots.map((s) => s.inicio)).toEqual(['2026-09-15T17:00:00.000Z']);
    await expect(bookAppointments(grupo, [slots[0].inicio], now)).resolves.toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO clinica_agendamentos'));
    const colunas = String(insert?.[0]).split('VALUES')[0].replace(/[()\s]/g, '').split(',');
    expect(insert?.[1][colunas.indexOf('publico_atendimento')]).toBe('Grupo');
    expect(insert?.[1][colunas.indexOf('duracao_min')]).toBe(90);
  });

  it('oferece só a janela de 50 min para psicoterapia de público adulto', () => {
    const adulto = { ...patient, serviceKey: 'PSICOTERAPIA', publico: 'Adulto', triageMode: 'SOCIAL' };
    expect(janelasCompativeisComPaciente(janelas50e90.map((j) => ({ ...janelaDaGrade, duracaoMin: j.duracao_min })), adulto)
      .map((j) => j.duracaoMin)).toEqual([50]);
  });

  it('grava o público da reserva em publico_atendimento (§ 7.04)', async () => {
    const adulto = { ...patient, serviceKey: 'PSICOTERAPIA', publico: 'Adulto', triageMode: 'SOCIAL' };
    await expect(bookAppointments(adulto, ['2026-09-15T12:00:00.000Z'], now)).resolves.toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find((call) => String(call[0]).includes('INSERT INTO clinica_agendamentos'));
    expect(String(insert?.[0])).toContain('publico_atendimento');
    expect(insert?.[1]).toContain('Adulto');
  });

  it('grava publico_atendimento nulo quando o vínculo não informa público', async () => {
    const semPublico = { ...patient, serviceKey: 'PSICOTERAPIA' };
    await expect(bookAppointments(semPublico, ['2026-09-15T12:00:00.000Z'], now)).resolves.toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find((call) => String(call[0]).includes('INSERT INTO clinica_agendamentos'));
    const colunas = String(insert?.[0]).split('VALUES')[0].replace(/[()\s]/g, '').split(',');
    expect((insert?.[1] as unknown[])[colunas.indexOf('publico_atendimento')]).toBeNull();
  });

  it('grava servico_key AVALIACAO ao reservar Avaliação pelo link público', async () => {
    const avaliacao = { ...patient, serviceKey: 'AVALIACAO', publico: 'Adolescente', triageMode: 'PARTICULAR' };
    const slots = await listAvailableSlots(avaliacao, now, new Date('2026-09-16T00:00:00Z'), now);
    expect(slots).toHaveLength(2);

    const ok = await bookAppointments(avaliacao, ['2026-09-15T17:00:00.000Z'], now);
    expect(ok).toMatchObject({ ok: true });
    const insert = connection.execute.mock.calls.find((call) => String(call[0]).includes('INSERT INTO clinica_agendamentos'));
    expect(insert?.[1]).toContain('AVALIACAO');
  });
});

describe('getActiveUpcomingAppointment — ocultação do pagamento para sessão custeada (§ 10.02)', () => {
  it('omite linkPagamento quando a sessão futura é custeada pela empresa, mesmo com token gravado', async () => {
    poolQuery.mockResolvedValueOnce([
      [{
        id: 'ag-1',
        ref_core: 'ag-ref-1',
        inicio: '2026-09-20T14:00:00.000Z',
        fim: '2026-09-20T14:50:00.000Z',
        modalidade: 'online',
        publico_atendimento: 'Adulto',
        status: 'agendado',
        token_pagamento_sessao: 'tok-abc',
        custeado: 1,
        solicitacao_id: null,
      }],
      [],
    ]);
    const custeada = await getActiveUpcomingAppointment(patient, now);
    expect(custeada?.custeadoPelaEmpresa).toBe(true);
    expect(custeada?.linkPagamento).toBeUndefined();

    poolQuery.mockResolvedValueOnce([
      [{
        id: 'ag-2',
        ref_core: 'ag-ref-2',
        inicio: '2026-09-21T14:00:00.000Z',
        fim: '2026-09-21T14:50:00.000Z',
        modalidade: 'online',
        publico_atendimento: 'Adulto',
        status: 'agendado',
        token_pagamento_sessao: 'tok-xyz',
        custeado: 0,
        solicitacao_id: null,
      }],
      [],
    ]);
    const particular = await getActiveUpcomingAppointment(patient, now);
    expect(particular?.custeadoPelaEmpresa).toBe(false);
    expect(particular?.linkPagamento).toBe('/pagar/sessao/tok-xyz');
  });
});
