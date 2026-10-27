import type { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query }) }));
vi.mock('./mappers', () => ({ instituicaoId: () => 'inst', fromSqlTimestamp: (value: unknown) => value }));
import { sessoesDoConvenio } from './convenioRepository';
const sqliteModule = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22 ? await import(sqliteModule) as typeof import('node:sqlite') : null;

describe.skipIf(!sqlite)('pagador histórico das sessões', () => {
  it('mantém a sessão na empresa original depois da mudança do vínculo', async () => {
    const db: DatabaseSync = new sqlite!.DatabaseSync(':memory:');
    db.function('DATE_FORMAT', { varargs: true }, (value) => String(value).slice(0, 7));
    db.function('CONVERT_TZ', { varargs: true }, (value) => value);
    db.exec(`
      CREATE TABLE financeiro_cobrancas (instituicao_id TEXT, organizacao_ref TEXT, paciente_ref TEXT, ref_core TEXT, sessao_ref TEXT, profissional_ref TEXT, valor_centavos INT, status TEXT, fatura_convenio_ref TEXT, convenio_ref TEXT, emitida_em TEXT);
      CREATE TABLE clinica_pacientes (id TEXT, instituicao_id TEXT, ref_core TEXT, nome TEXT, nome_social TEXT, convenio_ref TEXT, custeado_pela_empresa INT, custeio_sessoes_cota INT, custeio_sessoes_ciclo TEXT);
      CREATE TABLE clinica_convenios (instituicao_id TEXT, organizacao_ref TEXT, ref_core TEXT, empresa_paga_sessoes INT);
      CREATE TABLE clinica_agendamentos (id TEXT, instituicao_id TEXT, ref_core TEXT, sessao_clinica_ref TEXT, status TEXT, custeado_pela_empresa INT, paciente_id TEXT, inicio TEXT, organizacao_id TEXT);
      CREATE TABLE clinica_sessoes (instituicao_id TEXT, organizacao_ref TEXT, ref_core TEXT, status TEXT, inicio_real TEXT, inicio_previsto TEXT);
      CREATE TABLE clinica_profissionais (instituicao_id TEXT, ref_core TEXT, nome TEXT);
      CREATE TABLE clinica_organizacoes (id TEXT, ref_core TEXT);
      INSERT INTO clinica_convenios VALUES ('inst','org','anterior',1), ('inst','org','novo',1);
      INSERT INTO clinica_pacientes VALUES ('p','inst','pac','Paciente fictício',NULL,'novo',1,NULL,NULL);
      INSERT INTO clinica_agendamentos VALUES ('a','inst','ag','sess','realizado',1,'p','2026-10-10','o');
      INSERT INTO clinica_sessoes VALUES ('inst','org','sess','completed','2026-10-10','2026-10-10');
      INSERT INTO clinica_profissionais VALUES ('inst','prof','Profissional fictício');
      INSERT INTO financeiro_cobrancas VALUES ('inst','org','pac','charge','sess','prof',10000,'pending',NULL,'anterior','2026-10-10');
    `);
    query.mockImplementation(async (sql: string, params: string[]) => [db.prepare(sql
      .replaceAll('DATE_ADD(DATE_ADD(?, INTERVAL 1 DAY), INTERVAL 3 HOUR)', "datetime(?, '+1 day', '+3 hours')")
      .replaceAll('DATE_ADD(?, INTERVAL 3 HOUR)', "datetime(?, '+3 hours')")).all(...params), []]);
    try {
      expect(await sessoesDoConvenio('org', 'anterior')).toHaveLength(1);
      expect(await sessoesDoConvenio('org', 'novo')).toHaveLength(0);
      db.exec("UPDATE clinica_sessoes SET inicio_real = '2026-11-01 00:00:00', inicio_previsto = '2026-11-01 00:00:00'");
      expect(await sessoesDoConvenio('org', 'anterior', '2026-10-01', '2026-10-31')).toHaveLength(1);
      expect(await sessoesDoConvenio('org', 'anterior', '2026-11-01', '2026-11-30')).toHaveLength(0);
    } finally { db.close(); }
  });
});
