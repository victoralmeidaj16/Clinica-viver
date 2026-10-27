import type { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import type { PoolConnection } from 'mysql2/promise';
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
vi.mock('./mappers', () => ({ instituicaoId: () => 'inst' }));
import { assertPatientCpfAvailable } from './patientCpfUniqueness';
const sqliteModule = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22 ? await import(sqliteModule) as typeof import('node:sqlite') : null;

it.skipIf(!sqlite)('recusa duplicidade no cadastro ou na triagem, respeitando a organização', async () => {
  const db: DatabaseSync = new sqlite!.DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE clinica_organizacoes(id TEXT, ref_core TEXT);
      CREATE TABLE clinica_pacientes(id TEXT, instituicao_id TEXT, organizacao_id TEXT, ref_core TEXT, documento TEXT);
      CREATE TABLE clinica_triagens_pacientes(instituicao_id TEXT, organizacao_ref TEXT, paciente_ref TEXT, cpf TEXT);
      INSERT INTO clinica_organizacoes VALUES ('org-row', 'org'), ('other-row', 'other');
      INSERT INTO clinica_pacientes VALUES ('p1', 'inst', 'org-row', 'patient-1', NULL), ('p2', 'inst', 'other-row', 'patient-2', '11144477735');
      INSERT INTO clinica_triagens_pacientes VALUES ('inst', 'org', 'patient-1', '529.982.247-25');`);
    const connection = { query: async (sql: string, values: string[]) => [db.prepare(sql.replace(' FOR UPDATE', '')).all(...values), []] } as unknown as PoolConnection;
    await expect(assertPatientCpfAvailable(connection, 'org', 'new-patient', '52998224725')).rejects.toMatchObject({ status: 409 });
    await expect(assertPatientCpfAvailable(connection, 'org', 'patient-1', '52998224725')).resolves.toBeUndefined();
    await expect(assertPatientCpfAvailable(connection, 'org', 'new-patient', '11144477735')).resolves.toBeUndefined();
  } finally { db.close(); }
});
