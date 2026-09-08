import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Linha = Record<string, unknown>;

const { connection } = vi.hoisted(() => ({
  connection: {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(() => {}),
    query: vi.fn<(sql: string, values?: unknown[]) => Promise<[Linha[], unknown[]]>>(
      async () => [[], []]
    ),
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

import {
  completeAppointment,
  listAppointments,
  updateAppointmentDetails,
} from './agendaRepository';

const AGORA = new Date('2026-09-08T18:00:00.000Z');

const SESSAO_PASSADA: Linha = {
  id: 'apt-1',
  inicio: '2026-09-07T12:00:00Z',
  fim: '2026-09-07T12:50:00Z',
  duracao_min: 50,
  modalidade: 'online',
  status: 'agendado',
  sessao_clinica_ref: null,
  origem_criacao: 'portal',
  criado_em: '2026-09-01T10:00:00Z',
  realizado_em: null,
  token_pagamento_sessao: 'tok-1',
  paciente_nome: 'Paciente',
  convenio_nome: null,
  custeado_pela_empresa: 0,
  pagamento_status: null,
  vencimento_cobranca_em: null,
};

function comLinhas(...linhas: Linha[]) {
  connection.query.mockImplementation(async () => [linhas, []]);
}

/**
 * Concluir um atendimento cria a sessão clínica que alimenta indicadores e a
 * cobrança da empresa que custeia. Uma listagem que troca o status sozinha pula
 * as duas coisas e ainda esconde o botão que faria o trabalho direito.
 */
describe('listAppointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comLinhas(SESSAO_PASSADA);
  });

  it('não conclui atendimento durante a leitura', async () => {
    await listAppointments('org-1', 'pro-1', new Date('2026-06-01T00:00:00Z'), AGORA);

    expect(connection.execute).not.toHaveBeenCalled();
    const escritas = connection.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => /^\s*UPDATE/.test(sql));
    expect(escritas).toEqual([]);
  });

  it('oferece a confirmação de uma sessão aberta que já terminou', async () => {
    const [item] = await listAppointments(
      'org-1',
      'pro-1',
      new Date('2026-06-01T00:00:00Z'),
      AGORA
    );

    expect(item.status).toBe('agendado');
    expect(item.realizadoEm).toBeUndefined();
    expect(item.podeConfirmarRealizacao).toBe(true);
  });

  it('ainda oferece a confirmação de um registro marcado sem sessão clínica', async () => {
    comLinhas({ ...SESSAO_PASSADA, status: 'realizado', realizado_em: '2026-09-07T12:50:00Z' });

    const [item] = await listAppointments(
      'org-1',
      'pro-1',
      new Date('2026-06-01T00:00:00Z'),
      AGORA
    );

    expect(item.podeConfirmarRealizacao).toBe(true);
  });

  it('não oferece a confirmação depois que a sessão clínica existe', async () => {
    comLinhas({
      ...SESSAO_PASSADA,
      status: 'realizado',
      realizado_em: '2026-09-07T12:50:00Z',
      sessao_clinica_ref: 'session-apt-ref-1',
    });

    const [item] = await listAppointments(
      'org-1',
      'pro-1',
      new Date('2026-06-01T00:00:00Z'),
      AGORA
    );

    expect(item.podeConfirmarRealizacao).toBe(false);
  });
});

const PARA_CONCLUIR: Linha = {
  ref_core: 'apt-ref-1',
  sessao_clinica_ref: null,
  status: 'agendado',
  inicio: '2026-09-07T12:00:00Z',
  fim: '2026-09-07T12:50:00Z',
  modalidade: 'online',
  valor_centavos: 20000,
  valor_sessao_centavos: 20000,
  organizacao_ref: 'org-1',
  paciente_ref: 'pac-1',
  profissional_ref: 'pro-1',
  convenio_nome: null,
  custeado_pela_empresa: 0,
  cobranca_ref: null,
};

describe('completeAppointment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('materializa a sessão clínica de um registro que só teve o status trocado', async () => {
    comLinhas({ ...PARA_CONCLUIR, status: 'realizado' });

    expect(await completeAppointment('org-1', 'pro-1', 'apt-1', AGORA)).toBe('completed');

    const sessao = connection.execute.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes('INSERT IGNORE INTO clinica_sessoes'));
    expect(sessao).toBeDefined();
    expect(connection.commit).toHaveBeenCalled();
  });

  it('reconhece como concluído o atendimento que já tem sessão clínica', async () => {
    comLinhas({ ...PARA_CONCLUIR, status: 'realizado', sessao_clinica_ref: 'session-apt-ref-1' });

    expect(await completeAppointment('org-1', 'pro-1', 'apt-1', AGORA)).toBe('already_completed');
    expect(connection.execute).not.toHaveBeenCalled();
  });
});

const AGENDAMENTO: Linha = {
  id: 'apt-1',
  ref_core: 'apt-ref-1',
  profissional_id: 'pro-1',
  status: 'agendado',
  inicio: '2026-09-07T12:00:00Z',
  fim: '2026-09-07T12:50:00Z',
  duracao_min: 50,
  modalidade: 'online',
};

/**
 * A edição que também conclui não pode gravar horário e só depois descobrir que
 * a conclusão não vale: a interface avisaria falha sobre algo já persistido.
 */
describe('updateAppointmentDetails com conclusão em seguida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM clinica_agendamentos a\n         JOIN clinica_profissionais')
        ? [[AGENDAMENTO], []]
        : [[], []]
    );
  });

  it('recusa antes de gravar quando o novo horário ainda não terminou', async () => {
    const resultado = await updateAppointmentDetails(
      'org-1',
      'pro-1',
      'apt-1',
      { startsAt: '2099-01-01T12:00:00.000Z', endsAt: '2099-01-01T12:50:00.000Z' },
      { concluirDepois: true },
      AGORA
    );

    expect(resultado).toBe('not_finished');
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });

  it('recusa antes de gravar quando o atendimento está cancelado', async () => {
    connection.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM clinica_agendamentos a\n         JOIN clinica_profissionais')
        ? [[{ ...AGENDAMENTO, status: 'cancelado' }], []]
        : [[], []]
    );

    const resultado = await updateAppointmentDetails(
      'org-1',
      'pro-1',
      'apt-1',
      { modalidade: 'presencial' },
      { concluirDepois: true },
      AGORA
    );

    expect(resultado).toBe('invalid_status');
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('grava a edição quando o atendimento já terminou', async () => {
    const resultado = await updateAppointmentDetails(
      'org-1',
      'pro-1',
      'apt-1',
      { modalidade: 'presencial' },
      { concluirDepois: true },
      AGORA
    );

    expect(resultado).toBe('ok');
    expect(connection.commit).toHaveBeenCalled();
  });
});
