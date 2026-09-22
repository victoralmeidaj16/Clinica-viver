import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { cobrancaVisivelNoConvenioSql } from './convenioChargeSql';

const sqliteModule = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22
  ? await import(sqliteModule) as typeof import('node:sqlite') : null;

describe.skipIf(!sqlite)('elegibilidade de cobranças canceladas no convênio', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = new sqlite!.DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE financeiro_cobrancas (instituicao_id, organizacao_ref, sessao_ref, status, fatura_convenio_ref);
      CREATE TABLE clinica_organizacoes (id, ref_core);
      CREATE TABLE clinica_agendamentos (instituicao_id, organizacao_id, ref_core, sessao_clinica_ref, status);
      CREATE TABLE clinica_sessoes (instituicao_id, organizacao_ref, ref_core, status);
      INSERT INTO clinica_organizacoes VALUES ('org-id', 'org'), ('other-id', 'other');
      INSERT INTO financeiro_cobrancas VALUES ('inst', 'org', 'appt', 'pending', NULL);
      INSERT INTO clinica_agendamentos VALUES ('inst', 'org-id', 'appt', 'session', 'confirmado');
    `);
  });
  afterEach(() => db.close());
  const visible = () => db.prepare(`SELECT * FROM financeiro_cobrancas fc WHERE ${cobrancaVisivelNoConvenioSql('fc')}`).all();

  it('remove cobrança cancelada e mantém atendimento ativo', () => {
    expect(visible()).toHaveLength(1);
    db.exec("UPDATE financeiro_cobrancas SET status = 'cancelled'");
    expect(visible()).toHaveLength(0);
  });
  it.each(['appt', 'session'])('remove pendência antiga vinculada por %s', (ref) => {
    db.prepare('UPDATE financeiro_cobrancas SET sessao_ref = ?').run(ref);
    db.exec("UPDATE clinica_agendamentos SET status = 'cancelado'");
    expect(visible()).toHaveLength(0);
  });
  it('remove sessão clínica cancelada mesmo sem agendamento', () => {
    db.exec("DELETE FROM clinica_agendamentos; INSERT INTO clinica_sessoes VALUES ('inst', 'org', 'appt', 'cancelled')");
    expect(visible()).toHaveLength(0);
  });
  it('não confunde cancelamentos de outras organizações ou instituições', () => {
    db.exec(`INSERT INTO clinica_agendamentos VALUES ('inst', 'other-id', 'appt', NULL, 'cancelado'),
      ('other-inst', 'org-id', 'appt', NULL, 'cancelado');
      INSERT INTO clinica_sessoes VALUES ('inst', 'other', 'appt', 'cancelled');`);
    expect(visible()).toHaveLength(1);
  });
  it.each(['paid', 'partially_paid', 'refunded'])('preserva histórico financeiro %s', (status) => {
    db.exec("UPDATE clinica_agendamentos SET status = 'cancelado'");
    db.prepare('UPDATE financeiro_cobrancas SET status = ?').run(status);
    expect(visible()).toHaveLength(1);
  });
  it('preserva o vínculo com fatura existente após cancelar a agenda', () => {
    db.exec("UPDATE clinica_agendamentos SET status = 'cancelado'; UPDATE financeiro_cobrancas SET fatura_convenio_ref = 'invoice'");
    expect(visible()).toHaveLength(1);
  });
});
