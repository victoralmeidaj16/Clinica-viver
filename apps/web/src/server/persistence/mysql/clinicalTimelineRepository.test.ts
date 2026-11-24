import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: vi.fn() }));
vi.mock('./mappers', async (original) => ({
  ...(await original<typeof import('./mappers')>()),
  instituicaoId: () => 1,
}));

import { MysqlClinicalTimelineRepository } from './clinicalTimelineRepository';

describe('pacientes com prontuário do profissional', () => {
  it('filtra pela organização, pelo profissional autorizado e pela categoria, sem repetir pacientes', async () => {
    const query = vi.fn(async () => [[{ paciente_ref: 'paciente-a' }, { paciente_ref: 'paciente-b' }]]);
    const repository = new MysqlClinicalTimelineRepository({ query } as never);

    const ids = await repository.listPatientIdsAuthorizedFor({
      organizationId: 'org-ficticia',
      professionalId: 'profissional-a',
      categories: ['clinical_record'],
    });

    expect(ids).toEqual(['paciente-a', 'paciente-b']);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('SELECT DISTINCT paciente_ref');
    expect(sql).toContain('JSON_CONTAINS(profissionais_autorizados, JSON_QUOTE(?))');
    expect(sql).toContain('categoria IN (?)');
    expect(params).toEqual([1, 'org-ficticia', 'profissional-a', ['clinical_record']]);
  });
});
