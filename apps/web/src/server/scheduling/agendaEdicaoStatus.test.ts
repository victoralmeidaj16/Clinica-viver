import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Linha = Record<string, unknown>;

const { connection } = vi.hoisted(() => ({
  connection: {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(() => {}),
    query: vi.fn<
      (sql: string, values?: unknown[]) => Promise<[Record<string, unknown>[], unknown[]]>
    >(async () => [[], []]),
    execute: vi.fn<
      (sql: string, values?: unknown[]) => Promise<[{ affectedRows: number }, unknown[]]>
    >(async () => [{ affectedRows: 1 }, []]),
  },
}));

vi.mock('@/server/oci/runtime', () => ({
  isMysqlConfigured: () => true,
  getMysqlPool: () => ({ getConnection: async () => connection }),
}));
vi.mock('@/server/persistence/mysql/mappers', () => ({
  instituicaoId: () => 'inst-1',
  rowId: (prefix: string, ref: string) => `${prefix}:${ref}`,
}));

import { updateAppointmentDetails } from './agendaRepository';

const AGENDAMENTO = {
  id: 'apt-1',
  ref_core: 'apt-ref-1',
  profissional_id: 'pro-1',
  status: 'agendado',
  inicio: '2099-01-01T12:00:00Z',
  fim: '2099-01-01T12:50:00Z',
  duracao_min: 50,
  modalidade: 'online',
};

/** Primeira consulta devolve o agendamento; as seguintes (conflitos, bloqueios) vêm vazias. */
function comAgendamento(overrides: Linha = {}) {
  connection.query.mockImplementation(async (sql: string) =>
    sql.includes('FROM clinica_agendamentos a\n         JOIN clinica_profissionais')
      ? [[{ ...AGENDAMENTO, ...overrides }], []]
      : [[], []]
  );
}

/**
 * Concluir um atendimento cria a sessão clínica que alimenta indicadores e
 * faturamento, e só vale depois do término previsto. A edição de status não
 * pode ser um atalho para isso.
 */
describe('updateAppointmentDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comAgendamento();
  });

  it('recusa marcar como realizado sem passar pelo fluxo de conclusão', async () => {
    expect(await updateAppointmentDetails('org-1', 'pro-1', 'apt-1', { status: 'realizado' })).toBe(
      'requires_completion'
    );
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('recusa reverter um atendimento já concluído', async () => {
    comAgendamento({ status: 'realizado' });

    expect(await updateAppointmentDetails('org-1', 'pro-1', 'apt-1', { status: 'agendado' })).toBe(
      'completed_locked'
    );
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });

  it('segue editando horário e modalidade normalmente', async () => {
    expect(
      await updateAppointmentDetails('org-1', 'pro-1', 'apt-1', {
        startsAt: '2099-02-01T12:00:00.000Z',
        endsAt: '2099-02-01T12:50:00.000Z',
        modalidade: 'presencial',
      })
    ).toBe('ok');

    const [agendamentoSql] = connection.execute.mock.calls[0];
    expect(agendamentoSql).toContain('UPDATE clinica_agendamentos');
    expect(agendamentoSql).not.toContain('status = ?');
    expect(connection.commit).toHaveBeenCalled();
  });

  it('reagenda a cobrança pela coluna que existe no esquema', async () => {
    await updateAppointmentDetails('org-1', 'pro-1', 'apt-1', {
      startsAt: '2099-02-01T12:00:00.000Z',
      endsAt: '2099-02-01T12:50:00.000Z',
    });

    const cobranca = connection.execute.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes('UPDATE financeiro_cobrancas'));
    expect(cobranca).toBeDefined();
    // `financeiro_cobrancas` tem `vence_em`; `vencimento_em` nunca existiu.
    expect(cobranca).toContain('SET vence_em = ?');
    expect(cobranca).not.toContain('vencimento_em');
  });
});
