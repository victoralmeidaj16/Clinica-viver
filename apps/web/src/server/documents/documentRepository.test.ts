import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IssuedPsychologicalDocument } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const pool = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => pool, isMysqlConfigured: () => true }));
import { MysqlDocumentRepository } from './documentRepository';

beforeEach(() => { vi.clearAllMocks(); pool.query.mockResolvedValue([[]]); });
describe('persistência dos documentos', () => {
  it('inclui organização, paciente e profissional nas leituras', async () => {
    const repository = new MysqlDocumentRepository();
    await repository.get({ organizationId: 'org', patientId: 'patient', professionalId: 'psi' }, 'id');
    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain('instituicao_id = ? AND organizacao_ref = ? AND paciente_ref = ? AND profissional_ref = ?');
    expect(values.slice(1)).toEqual(['org', 'patient', 'psi', 'id']);
  });

  it('grava somente conteúdo cifrado e não sobrescreve a emissão', async () => {
    vi.stubEnv('CLINICAL_DOCUMENTS_KEY', 'ab'.repeat(32));
    const repository = new MysqlDocumentRepository();
    const scope = { organizationId: 'org', patientId: 'patient', professionalId: 'psi' };
    const document = { ...scope, id: 'id', issuedBy: 'user', issuedAt: '2026-01-01T12:00:00Z', content: { patientName: 'Paciente secreto' } } as IssuedPsychologicalDocument;
    pool.execute.mockImplementation(async (_sql, values) => { pool.query.mockResolvedValue([[{ id: 'id', conteudo_cifrado: values[5] }]]); });
    expect(await repository.save(scope, document)).toEqual(document);
    const [sql, values] = pool.execute.mock.calls[0];
    expect(sql).toContain('ON DUPLICATE KEY UPDATE id = id');
    expect(JSON.stringify(values)).not.toContain('Paciente secreto');
    vi.unstubAllEnvs();
  });
});
