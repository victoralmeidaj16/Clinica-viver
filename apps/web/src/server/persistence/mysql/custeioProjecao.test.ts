import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { custeioDoAgendamentoSql } from './custeioSql';

// Node 20 não possui SQLite nativo; os testes estruturais rodam em todas as versões.
const sqliteModule = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22
  ? await import(sqliteModule) as typeof import('node:sqlite')
  : null;

// Executa a expressão de produção; DATE_FORMAT é a única função MySQL usada.
describe.skipIf(!sqlite)('projeção da cota por agendamento', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new sqlite!.DatabaseSync(':memory:');
    db.function('DATE_FORMAT', { varargs: true }, (date) => String(date).slice(0, 7));
    db.exec(`
      CREATE TABLE clinica_pacientes (
        id TEXT, instituicao_id TEXT, convenio_ref TEXT,
        custeado_pela_empresa INTEGER, custeio_sessoes_cota INTEGER,
        custeio_sessoes_ciclo TEXT
      );
      CREATE TABLE clinica_convenios (empresa_paga_sessoes INTEGER);
      CREATE TABLE clinica_agendamentos (
        id TEXT, instituicao_id TEXT, paciente_id TEXT, inicio TEXT,
        status TEXT, custeado_pela_empresa INTEGER, cobranca_ref TEXT
      );
      INSERT INTO clinica_pacientes VALUES ('p', 'i', 'c', 1, 2, 'total');
      INSERT INTO clinica_convenios VALUES (1);
    `);
    const insert = db.prepare(`INSERT INTO clinica_agendamentos
      VALUES (?, 'i', 'p', ?, 'agendado', NULL, NULL)`);
    for (let n = 1; n <= 4; n++) insert.run(String(n), `2026-10-${String(n * 7).padStart(2, '0')} 10:00:00`);
  });

  afterEach(() => db.close());

  function custeios() {
    return db.prepare(`SELECT ${custeioDoAgendamentoSql({
      agendamento: 'a', paciente: 'p', convenio: 'c',
    })} AS custeado
      FROM clinica_agendamentos a
      JOIN clinica_pacientes p ON p.id = a.paciente_id AND p.instituicao_id = a.instituicao_id
      CROSS JOIN clinica_convenios c
      WHERE a.status <> 'cancelado' ORDER BY a.id`).all().map(row => row.custeado);
  }

  it('empresa paga somente as duas primeiras das quatro sessões futuras', () => {
    expect(custeios()).toEqual([1, 1, 0, 0]);
  });

  it('cancelamento libera a reserva para a próxima sessão', () => {
    db.exec("UPDATE clinica_agendamentos SET status = 'cancelado' WHERE id = '1'");
    expect(custeios()).toEqual([1, 1, 0]);
  });

  it('não desconta duas vezes a sessão que foi realizada', () => {
    db.exec("UPDATE clinica_agendamentos SET status = 'realizado', custeado_pela_empresa = 1 WHERE id = '1'");
    expect(custeios()).toEqual([1, 1, 0, 0]);
  });

  it('preserva decisões gravadas quando a cota muda', () => {
    db.exec(`UPDATE clinica_agendamentos SET custeado_pela_empresa = 1 WHERE id = '1';
      UPDATE clinica_agendamentos SET custeado_pela_empresa = 0 WHERE id = '4';
      UPDATE clinica_pacientes SET custeio_sessoes_cota = 0;`);
    expect(custeios()).toEqual([1, 0, 0, 0]);
  });

  it('renova a cota mensal, mas não a cota total', () => {
    db.exec("UPDATE clinica_agendamentos SET inicio = '2026-11-07 10:00:00' WHERE id = '4'");
    expect(custeios()).toEqual([1, 1, 0, 0]);
    db.exec("UPDATE clinica_pacientes SET custeio_sessoes_ciclo = 'mensal'");
    expect(custeios()).toEqual([1, 1, 0, 1]);
  });

  it('desempata horários iguais pelo id', () => {
    db.exec("UPDATE clinica_agendamentos SET inicio = '2026-10-07 10:00:00'");
    expect(custeios()).toEqual([1, 1, 0, 0]);
  });

  it('não reserva cota para cobrança individual ou decisão de paciente pagante', () => {
    db.exec(`UPDATE clinica_agendamentos SET cobranca_ref = 'charge' WHERE id = '1';
      UPDATE clinica_agendamentos SET custeado_pela_empresa = 0 WHERE id = '2';`);
    expect(custeios().slice(2)).toEqual([1, 1]);
  });

  it('mantém custeio ilimitado e opção de paciente pagante', () => {
    db.exec('UPDATE clinica_pacientes SET custeio_sessoes_cota = NULL');
    expect(custeios()).toEqual([1, 1, 1, 1]);
    db.exec('UPDATE clinica_pacientes SET custeado_pela_empresa = 0');
    expect(custeios()).toEqual([0, 0, 0, 0]);
  });
});
