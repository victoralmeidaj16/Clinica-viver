import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));

const { resolveAcademicManager, academicApiFailure, service } = vi.hoisted(() => {
  const service = { listStudents: vi.fn(), createStudent: vi.fn() };
  return {
    service,
    resolveAcademicManager: vi.fn(async () => ({ actorUserId: 'admin-1', service })),
    academicApiFailure: vi.fn((error: unknown) => Response.json({ ok: false, error: { code: 'FORBIDDEN', message: String(error) } }, { status: 403 })),
  };
});

vi.mock('@/server/academic/managementApi', () => ({
  resolveAcademicManager,
  academicApiFailure,
  stringValue: (value: unknown) => typeof value === 'string' ? value : '',
}));

import { GET, POST } from './alunos/route';

describe('API de gestão acadêmica', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista alunos no envelope padrão', async () => {
    service.listStudents.mockResolvedValueOnce([{ id: 'student-1', fullName: 'Ana' }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: 'student-1', fullName: 'Ana' }]);
  });

  it('cria aluno com o ator administrador e retorna 201 sem senha', async () => {
    service.createStudent.mockResolvedValueOnce({ id: 'student-1', fullName: 'Ana' });
    const response = await POST(new Request('http://localhost/api/academico/gestao/alunos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Ana', email: 'ana@example.com', temporaryPassword: 'senhaForte123' }),
    }));
    expect(response.status).toBe(201);
    expect(service.createStudent).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@example.com' }), 'admin-1');
    expect(JSON.stringify(await response.json())).not.toContain('senhaForte123');
  });

  it('não chama o serviço quando a autorização falha', async () => {
    resolveAcademicManager.mockRejectedValueOnce(new Error('restrito à gestão'));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(service.listStudents).not.toHaveBeenCalled();
    expect(academicApiFailure).toHaveBeenCalled();
  });
});
