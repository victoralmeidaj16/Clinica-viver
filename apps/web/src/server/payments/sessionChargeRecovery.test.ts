import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'mysql2';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  guarantee: vi.fn(),
}));

vi.mock('@/server/oci/runtime', () => ({
  getMysqlPool: () => ({ query: mocks.query }),
}));
vi.mock('./sessionCharge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sessionCharge')>()),
  garantirCobrancaDaSessao: mocks.guarantee,
}));

import { recuperarCobrancasPosSessaoPendentes } from './sessionChargeRecovery';

afterEach(() => vi.useRealTimers());

describe('recuperação de cobrança após conclusão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    mocks.query.mockResolvedValue([[{ id: 'appointment-1', realizado_em: '2026-10-26T11:00:00.000Z' }], []]);
  });

  it('refaz a cobrança ausente com três dias de prazo após a realização', async () => {
    mocks.guarantee.mockResolvedValue('created');

    await expect(recuperarCobrancasPosSessaoPendentes()).resolves.toEqual({ created: 1, existing: 0, failed: 0 });
    expect(mocks.guarantee).toHaveBeenCalledWith('appointment-1', '2026-10-29T11:00:00.000Z');
  });

  it('recupera o agendamento ainda não realizado com o vencimento escolhido', async () => {
    mocks.query.mockResolvedValue([[{ id: 'appointment-2', realizado_em: null, cobranca_vence_em: '2026-11-10 15:00:00.000' }], []]);
    mocks.guarantee.mockResolvedValue('created');
    await recuperarCobrancasPosSessaoPendentes();
    expect(mocks.guarantee).toHaveBeenCalledWith('appointment-2', '2026-11-10T15:00:00.000Z');
    expect(mocks.query.mock.calls[0][0]).toContain("a.status IN ('agendado', 'confirmado')");
  });

  it('mantém a cobrança para nova tentativa quando a emissão volta a falhar', async () => {
    mocks.guarantee.mockResolvedValue('failed');

    await expect(recuperarCobrancasPosSessaoPendentes()).resolves.toEqual({ created: 0, existing: 0, failed: 1 });
  });

  it('recupera o portal sem vencimento explícito usando o início da sessão', async () => {
    mocks.query.mockResolvedValue([[{ id: 'portal', realizado_em: null, cobranca_vence_em: null, inicio: '2026-11-10 15:00:00.000' }], []]);
    mocks.guarantee.mockResolvedValue('created');
    await recuperarCobrancasPosSessaoPendentes();
    expect(mocks.guarantee).toHaveBeenCalledWith('portal', '2026-11-10T15:00:00.000Z');
  });

  it('preserva o vencimento original passado para recuperar a dívida como vencida', async () => {
    mocks.query.mockResolvedValue([[{ id: 'late', realizado_em: null, cobranca_vence_em: '2026-10-25 15:00:00.000', inicio: '2026-11-10 15:00:00.000' }], []]);
    mocks.guarantee.mockResolvedValue('created');
    await recuperarCobrancasPosSessaoPendentes();
    expect(mocks.guarantee).toHaveBeenCalledWith('late', '2026-10-25T15:00:00.000Z');
  });
});

const sqliteModule = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22
  ? await import(sqliteModule) as typeof import('node:sqlite') : null;
async function bancoDeRecuperacao() {
  vi.clearAllMocks();
  const db = new sqlite!.DatabaseSync(':memory:');
  const { instituicaoId } = await import('@/server/persistence/mysql/mappers');
  const inst = instituicaoId();
  db.function('DATE_FORMAT', { varargs: true }, () => '2026-10');
  db.function('CONVERT_TZ', { varargs: true }, (value) => value);
  db.exec(`CREATE TABLE clinica_agendamentos (cota_ocorrencia_ref TEXT, pacote_id TEXT, custeio_aguarda_autorizacao INT DEFAULT 0, id TEXT, instituicao_id TEXT, organizacao_id TEXT, paciente_id TEXT,
    ref_core TEXT, sessao_clinica_ref TEXT, status TEXT, realizado_em TEXT, cobranca_vence_em TEXT, custeado_pela_empresa INT, custeio_convenio_ref TEXT, inicio TEXT,
    valor_centavos INT DEFAULT 10000, criado_em TEXT DEFAULT '2000-01-01', atualizado_em TEXT DEFAULT '2000-01-01', cobranca_recuperacao_tentada_em TEXT);
    CREATE TABLE clinica_organizacoes (id TEXT, ref_core TEXT);
    CREATE TABLE clinica_pacientes (id TEXT, instituicao_id TEXT, convenio_ref TEXT, custeado_pela_empresa INT, custeio_sessoes_cota INT, custeio_sessoes_ciclo TEXT);
    CREATE TABLE clinica_convenios (instituicao_id TEXT, organizacao_ref TEXT, ref_core TEXT, empresa_paga_sessoes INT, pacote_sessoes INT, pacote_sessoes_ciclo TEXT);
    CREATE TABLE financeiro_cobrancas (instituicao_id TEXT, organizacao_ref TEXT, sessao_ref TEXT, status TEXT, convenio_ref TEXT);
    INSERT INTO clinica_organizacoes VALUES ('org-row', 'org');`);
  db.prepare('INSERT INTO clinica_pacientes (id, instituicao_id) VALUES (?, ?)').run('patient-row', inst);
  mocks.query.mockImplementation(async (sql, params) => {
    const statement = db.prepare(format(sql, params).replace('CURRENT_TIMESTAMP(3)', 'CURRENT_TIMESTAMP'));
    return [statement.all(), []];
  });
  return { db, inst };
}

it.skipIf(!sqlite)('a consulta real seleciona portal e vencimento passado sem incluir cancelados ou cobranças existentes', async () => {
  const { db, inst } = await bancoDeRecuperacao();
  for (const [id, due, status] of [['portal', null, 'agendado'], ['expired', '2020-01-01 12:00:00.000', 'confirmado'],
    ['cancelled', null, 'cancelado'], ['existing', null, 'agendado']]) {
    db.prepare('INSERT INTO clinica_agendamentos (id, instituicao_id, organizacao_id, paciente_id, ref_core, status, cobranca_vence_em, inicio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, inst, 'org-row', 'patient-row', id, status, due, '2099-01-01 12:00:00.000');
  }
  db.prepare("INSERT INTO financeiro_cobrancas (instituicao_id, organizacao_ref, sessao_ref, status) VALUES (?, 'org', 'existing', 'pending')").run(inst);
  mocks.guarantee.mockResolvedValue('created');
  try {
    expect(await recuperarCobrancasPosSessaoPendentes()).toEqual({ created: 2, existing: 0, failed: 0 });
    expect(mocks.guarantee.mock.calls.map(([id]) => id).sort()).toEqual(['expired', 'portal']);
    expect(mocks.guarantee).toHaveBeenCalledWith('portal', '2099-01-01T12:00:00.000Z');
    expect(mocks.guarantee).toHaveBeenCalledWith('expired', '2020-01-01T12:00:00.000Z');
  } finally { db.close(); }
});

it.skipIf(!sqlite)('um lote inteiro de falhas libera a vez das demais sessões e permite retentar as antigas', async () => {
  const { db, inst } = await bancoDeRecuperacao();
  try {
    const insert = db.prepare(`INSERT INTO clinica_agendamentos
      (id, instituicao_id, organizacao_id, paciente_id, ref_core, status, inicio, valor_centavos)
      VALUES (?, ?, 'org-row', 'patient-row', ?, 'agendado', '2026-10-25 12:00:00', ?)`);
    const falhas = Array.from({ length: 100 }, (_, n) => `b-${String(n).padStart(3, '0')}`);
    for (const id of falhas) {
      insert.run(`a-${id}`, inst, `a-${id}`, null);
      insert.run(id, inst, id, 6500);
    }
    insert.run('a-zerada', inst, 'a-zerada', 0);
    insert.run('a-sem-referencia', inst, null, 6500);
    insert.run('c-valida', inst, 'c-valida', 6500);
    mocks.guarantee.mockResolvedValue('failed');
    expect(await recuperarCobrancasPosSessaoPendentes()).toEqual({ created: 0, existing: 0, failed: 100 });
    expect(mocks.guarantee.mock.calls.map(([id]) => id)).toEqual(falhas);

    db.prepare("UPDATE clinica_agendamentos SET valor_centavos = 6500 WHERE id = 'a-zerada'").run();
    mocks.guarantee.mockClear().mockResolvedValue('created');
    expect(await recuperarCobrancasPosSessaoPendentes()).toEqual({ created: 100, existing: 0, failed: 0 });
    expect(mocks.guarantee.mock.calls.map(([id]) => id)).toEqual(['a-zerada', 'c-valida', ...falhas.slice(0, 98)]);
  } finally { db.close(); }
});
