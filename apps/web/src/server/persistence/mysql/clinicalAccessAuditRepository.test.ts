import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';

vi.mock('server-only', () => ({}));

import { MysqlClinicalAccessAudit } from './clinicalAccessAuditRepository';

describe('MysqlClinicalAccessAudit', () => {
  it('grava na tabela de auditoria nova com organização e referência idempotente', async () => {
    const execute = vi.fn().mockResolvedValue([{}]);
    const repository = new MysqlClinicalAccessAudit({ execute } as unknown as Pool);

    await repository.append({
      id: 'audit-1', organizationId: 'org-1', actorUserId: 'user-1',
      action: 'clinical_record.read', recordId: 'record-1',
      occurredAt: '2026-08-21T12:00:00.000Z', correlationId: 'correlation-1',
    });

    expect(execute).toHaveBeenCalledOnce();
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('INSERT IGNORE INTO clinica_auditoria_acessos');
    expect(sql).not.toContain('clinica_acessos_prontuario');
    expect(params).toEqual(expect.arrayContaining(['org-1', 'audit-1', 'user-1', 'clinical_record.read', 'record-1']));
  });
});
