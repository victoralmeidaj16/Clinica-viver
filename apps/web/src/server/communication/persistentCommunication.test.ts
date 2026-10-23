import { DatabaseSync } from 'node:sqlite';
import type { Pool } from 'mysql2/promise';
import type { NotificationMessage, PatientHandoff } from '@thats-life/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const runtime = vi.hoisted(() => ({ pool: undefined as unknown }));
vi.mock('@/server/oci/runtime', () => ({
  getMysqlPool: () => runtime.pool,
  isMysqlConfigured: () => true,
}));
import { MysqlNotificationRepository } from './notificationRepository';
import { getHandoff, saveHandoff } from './handoffRepository';

let db: DatabaseSync;
let queries: string[];
let pool: Pool;

beforeEach(() => {
  vi.stubEnv('CLINICAL_DOCUMENTS_KEY', 'ab'.repeat(32));
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE clinica_comunicacoes (
    instituicao_id TEXT, organizacao_ref TEXT, tipo TEXT, chave_hash TEXT, id_hash TEXT,
    paciente_ref TEXT, estado TEXT, agendado_em TEXT, conteudo_cifrado TEXT,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (instituicao_id, organizacao_ref, tipo, chave_hash),
    UNIQUE (instituicao_id, organizacao_ref, tipo, id_hash)
  )`);
  queries = [];
  const adapt = (sql: string) => sql.replace(/ FOR UPDATE/g, '').replace(/CURRENT_TIMESTAMP\(3\)/g, 'CURRENT_TIMESTAMP');
  const query = async (sql: string, params: string[] = []) => {
    queries.push(sql);
    return [db.prepare(adapt(sql)).all(...params), []];
  };
  const execute = async (sql: string, params: string[] = []) => {
    queries.push(sql);
    const result = db.prepare(adapt(sql)).run(...params);
    return [{ affectedRows: result.changes }, []];
  };
  // SQLite cannot model MySQL row locks. Serialize transactions here and separately
  // assert FOR UPDATE is requested; MySQL concurrency needs an integration test.
  let pending: Promise<void> = Promise.resolve();
  pool = {
    query, execute,
    async getConnection() {
      const previous = pending;
      let unlock!: () => void;
      pending = new Promise<void>((resolve) => { unlock = resolve; });
      await previous;
      return {
        query, execute,
        async beginTransaction() { db.exec('BEGIN'); },
        async commit() { db.exec('COMMIT'); },
        async rollback() { db.exec('ROLLBACK'); },
        release() { unlock(); },
      };
    },
  } as unknown as Pool;
  runtime.pool = pool;
});
afterEach(() => { db.close(); vi.unstubAllEnvs(); });

const notification = (overrides: Partial<NotificationMessage> = {}): NotificationMessage => ({
  schemaVersion: 1, id: 'message-1', organizationId: 'org-a', patientId: 'patient-1',
  recipientReference: '5511999991111', category: 'patient_handoff', channel: 'whatsapp',
  subject: 'Resumo reservado', body: 'Conteúdo privado da sessão e tarefas combinadas.',
  status: 'queued', scheduledFor: '2026-10-22T12:00:00.000Z', attemptCount: 0, maxAttempts: 3,
  idempotencyKey: 'session-1-handoff', createdAt: '2026-10-22T11:00:00.000Z',
  updatedAt: '2026-10-22T11:00:00.000Z', ...overrides,
});
const handoff = (overrides: Partial<PatientHandoff> = {}): PatientHandoff => ({
  schemaVersion: 1, patientId: 'patient-1', sessionId: 'session-1',
  summary: 'Resumo privado aprovado durante o atendimento clínico.',
  tasks: [{ id: 'task-1', title: 'Praticar respiração diariamente', completed: false }],
  professionalName: 'Profissional', nextSessionLabel: 'Sexta-feira', status: 'approved',
  humanReviewRequired: true, safetyWarnings: [], approvedBy: 'psi-1',
  approvedAt: '2026-10-22T11:00:00.000Z', ...overrides,
});

function ciphertext() {
  return String(db.prepare('SELECT conteudo_cifrado FROM clinica_comunicacoes LIMIT 1').get()?.conteudo_cifrado);
}

describe('persistência cifrada de notificações', () => {
  it('reabre a fila em outra instância sem perder conteúdo e separa organização e paciente', async () => {
    const message = notification();
    await new MysqlNotificationRepository(pool).save(message);
    expect(ciphertext()).not.toContain(message.body);
    expect(ciphertext()).not.toContain(message.recipientReference);
    const fresh = new MysqlNotificationRepository(pool);
    expect(await fresh.getById('org-a', message.id)).toEqual(message);
    expect(await fresh.findByIdempotencyKey('org-a', message.idempotencyKey)).toEqual(message);
    expect(await fresh.getById('org-b', message.id)).toBeNull();
    expect(await fresh.list({ organizationId: 'org-a', patientId: 'another' })).toEqual([]);
    expect(await fresh.listDue('2026-10-22T11:59:00.000Z', 10)).toEqual([]);
    expect(await fresh.listDue('2026-10-22T12:00:00.000Z', 10)).toEqual([message]);
    await fresh.save(notification({ organizationId: 'org-b', body: 'Outra clínica' }));
    expect((await fresh.getById('org-a', message.id))?.body).toBe(message.body);
    expect((await fresh.list({ organizationId: 'org-b' })).map((item) => item.body)).toEqual(['Outra clínica']);
  });

  it('recusa alteração do conteúdo e colisão de chave sem sobrescrever o original', async () => {
    const repo = new MysqlNotificationRepository(pool);
    await repo.save(notification());
    await expect(repo.save(notification({ body: 'Conteúdo diferente' }))).rejects.toThrow('outro conteúdo');
    await expect(repo.save(notification({ id: 'message-2' }))).rejects.toThrow('outro conteúdo');
    expect(await repo.getById('org-a', 'message-1')).toEqual(notification());
  });

  it('apenas um consumidor inicia a mesma tentativa; entregue não volta à fila', async () => {
    const first = new MysqlNotificationRepository(pool);
    const second = new MysqlNotificationRepository(pool);
    await first.save(notification());
    const sending = notification({ status: 'sending', attemptCount: 1 });
    const results = await Promise.allSettled([first.save(sending), second.save(sending)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(queries.filter((sql) => sql.includes('FOR UPDATE'))).toHaveLength(3);
    expect(await second.listDue('2026-10-23T12:00:00.000Z', 10)).toEqual([]);
    const delivered = { ...sending, status: 'delivered' as const, providerMessageId: 'remote-1' };
    await first.save(delivered);
    await expect(second.save(notification())).rejects.toThrow();
    await expect(second.save({ ...sending, status: 'failed' })).rejects.toThrow();
    expect(await new MysqlNotificationRepository(pool).getById('org-a', 'message-1')).toEqual(delivered);
  });

  it('detecta cópia do ciphertext para outra organização por autenticação AES-GCM', async () => {
    await new MysqlNotificationRepository(pool).save(notification());
    db.prepare('UPDATE clinica_comunicacoes SET organizacao_ref = ?').run('org-b');
    await expect(new MysqlNotificationRepository(pool).getById('org-b', 'message-1')).rejects.toThrow();
  });
});

describe('persistência cifrada de resumos e tarefas', () => {
  it('recupera o resumo com tarefas após recarregar o módulo e isola organizações', async () => {
    const value = handoff();
    await saveHandoff('org-a', value);
    expect(ciphertext()).not.toContain(value.summary);
    expect(ciphertext()).not.toContain(value.tasks[0].title);
    vi.resetModules();
    const fresh = await import('./handoffRepository');
    expect(await fresh.getHandoff('org-a', value.sessionId)).toEqual(value);
    expect(await fresh.getHandoff('org-b', value.sessionId)).toBeNull();
    await fresh.saveHandoff('org-b', handoff({ summary: 'Resumo de outra organização' }));
    expect(await fresh.getHandoff('org-a', value.sessionId)).toEqual(value);
  });

  it('recusa alteração do resumo ou tarefa aprovada e preserva entregue contra gravação atrasada', async () => {
    const approved = handoff();
    await saveHandoff('org-a', approved);
    await expect(saveHandoff('org-a', handoff({ summary: 'Outro resumo' }))).rejects.toThrow('outro conteúdo');
    await expect(saveHandoff('org-a', handoff({ tasks: [{ id: 'task-1', title: 'Outra tarefa', completed: false }] })))
      .rejects.toThrow('outro conteúdo');
    const delivered = handoff({ status: 'delivered', deliveredAt: '2026-10-22T12:00:00.000Z' });
    await saveHandoff('org-a', delivered);
    expect(await saveHandoff('org-a', approved)).toEqual(delivered);
    expect(await getHandoff('org-a', 'session-1')).toEqual(delivered);
  });

  it('não aceita entrega sem aprovação persistida', async () => {
    await expect(saveHandoff('org-a', handoff({ status: 'delivered' }))).rejects.toThrow('aprovado');
    expect(await getHandoff('org-a', 'session-1')).toBeNull();
  });
});

it('recusa chave de cifra ausente antes de reservar conexão do pool', async () => {
  vi.stubEnv('CLINICAL_DOCUMENTS_KEY', '');
  const getConnection = vi.spyOn(pool, 'getConnection');
  await expect(new MysqlNotificationRepository(pool).save(notification())).rejects.toThrow('CLINICAL_DOCUMENTS_KEY');
  expect(getConnection).not.toHaveBeenCalled();
});
