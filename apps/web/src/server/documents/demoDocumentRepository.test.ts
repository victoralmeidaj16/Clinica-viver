import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IssuedPsychologicalDocument } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const mysql = vi.hoisted(() => ({ configured: false }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => mysql.configured }));
import { DemoDocumentRepository } from './demoDocumentRepository';
import { isDocumentDemo } from './demoMode';

let directory: string;
const scope = { organizationId: 'org-demo', patientId: 'patient-document-demo', professionalId: 'professional-1' };
const document = { ...scope, id: 'a'.repeat(64), issuedAt: '2026-10-02T12:00:00Z', content: { demo: true, patientName: 'Pessoa fictícia' } } as IssuedPsychologicalDocument;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'documents-demo-test-'));
  mysql.configured = false;
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('CLINICAL_DOCUMENTS_DEMO', 'true');
  vi.stubEnv('ORGANIZATION_ID', 'org-demo'); vi.stubEnv('CLINICAL_DOCUMENTS_KEY', 'ab'.repeat(32));
  vi.stubEnv('CLINICAL_DOCUMENTS_DEMO_DIR', directory);
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe('emissão local de demonstração', () => {
  it('mantém documentos cifrados entre instâncias e preserva a primeira emissão', async () => {
    const repository = new DemoDocumentRepository();
    const results = await Promise.all([repository.save(scope, document), repository.save(scope, document)]);
    expect(results).toEqual([document, document]);
    expect(await new DemoDocumentRepository().list(scope)).toEqual([document]);
    expect(await repository.save(scope, { ...document, issuedAt: '2099-01-01' })).toEqual(document);
    const [subdirectory] = await readdir(directory);
    const [file] = await readdir(join(directory, subdirectory));
    expect(await readFile(join(directory, subdirectory, file), 'utf8')).not.toContain('Pessoa fictícia');
    expect(await repository.list({ ...scope, patientId: 'outro' })).toEqual([]);
  });
  it('não habilita o modo local em produção, com banco ou em outra organização', () => {
    expect(isDocumentDemo()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production'); expect(isDocumentDemo()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development'); mysql.configured = true; expect(isDocumentDemo()).toBe(false);
    mysql.configured = false; vi.stubEnv('ORGANIZATION_ID', 'outra'); expect(isDocumentDemo()).toBe(false);
  });
  it('nega acesso fora da demonstração e impede caminhos arbitrários', async () => {
    const repository = new DemoDocumentRepository();
    await expect(repository.get(scope, '../arquivo')).rejects.toThrow('Identificador');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(repository.list(scope)).rejects.toThrow('somente na demonstração');
  });
});
