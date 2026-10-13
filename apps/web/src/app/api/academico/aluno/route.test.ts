import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));

const { authenticateStudent, startStudentSession, resolveStudentPortal, service } = vi.hoisted(() => {
  const service = { completeLesson: vi.fn(), listCourses: vi.fn() };
  return {
    service,
    authenticateStudent: vi.fn(), startStudentSession: vi.fn(),
    resolveStudentPortal: vi.fn(async () => ({ student: { id: 'student-1' }, service })),
  };
});

vi.mock('@/server/academic/studentAuth', () => ({ authenticateStudent, startStudentSession }));
vi.mock('@/server/academic/studentApi', () => ({
  resolveStudentPortal,
  studentApiFailure: (error: unknown) => Response.json({ ok: false, error: { message: String(error) } }, { status: 403 }),
}));

import { POST as login } from '../auth/login/route';
import { POST as completeLesson } from './aulas/[id]/concluir/route';

describe('API do aluno', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recusa credenciais inválidas', async () => {
    authenticateStudent.mockResolvedValueOnce(null);
    const response = await login(new Request('http://localhost/api/academico/auth/login', {
      method: 'POST', body: JSON.stringify({ email: 'ana@example.com', password: 'errada12345' }),
    }));
    expect(response.status).toBe(401);
  });

  it('direciona senha temporária para a troca obrigatória', async () => {
    authenticateStudent.mockResolvedValueOnce({
      studentId: 'student-1', institutionId: 'inst-1', mustChangePassword: true,
      issuedAt: 1, expiresAt: Date.now() + 60_000,
    });
    const response = await login(new Request('http://localhost/api/academico/auth/login', {
      method: 'POST', body: JSON.stringify({ email: 'ana@example.com', password: 'senhaForte123' }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).data.destination).toBe('/aluno/trocar-senha');
    expect(startStudentSession).toHaveBeenCalledOnce();
  });

  it('não expõe detalhes de infraestrutura quando o login falha internamente', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    authenticateStudent.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:3307'));
    const response = await login(new Request('http://localhost/api/academico/auth/login', {
      method: 'POST', body: JSON.stringify({ email: 'ana@example.com', password: 'senhaForte123' }),
    }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('ECONNREFUSED');
  });

  it('deriva o aluno da sessão e ignora tentativa de selecionar outro aluno', async () => {
    service.completeLesson.mockResolvedValue({ completed: 1, total: 1, percentage: 100 });
    const request = new Request('http://localhost/api/academico/aluno/aulas/lesson-1/concluir?studentId=student-2', {
      method: 'POST', body: JSON.stringify({ studentId: 'student-2' }),
    });
    const first = await completeLesson(request, { params: Promise.resolve({ id: 'lesson-1' }) });
    const repeated = await completeLesson(request, { params: Promise.resolve({ id: 'lesson-1' }) });
    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(service.completeLesson).toHaveBeenNthCalledWith(1, 'student-1', 'lesson-1');
    expect(service.completeLesson).toHaveBeenNthCalledWith(2, 'student-1', 'lesson-1');
  });
});
