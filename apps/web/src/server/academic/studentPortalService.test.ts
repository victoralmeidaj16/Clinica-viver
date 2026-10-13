import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { AcademicRepository } from './academicRepository';
import type { AcademicCourse, AcademicCourseTree, AcademicStudent } from '@thats-life/core';
import { hashPassword } from '@/server/security/passwordHash';
import { StudentPortalService } from './studentPortalService';

const student: AcademicStudent = {
  id: 'student-1', institutionId: 'inst-1', fullName: 'Ana', email: 'ana@example.com',
  status: 'active', mustChangePassword: false, createdAt: 'now', updatedAt: 'now',
};
const course: AcademicCourse = {
  id: '2', institutionId: 'inst-1', title: 'Psicodrama', description: '', position: 1, active: true, published: true,
};
const tree = {
  ...course,
  modules: [{
    id: 'module-1', courseId: '2', title: 'Módulo 1', position: 1,
    lessons: [
      { id: 'lesson-1', courseId: '2', moduleId: 'module-1', modulePosition: 1, title: 'Aula 1', durationMinutes: 10, position: 1, vimeoId: '123', published: true },
      { id: 'draft', courseId: '2', moduleId: 'module-1', modulePosition: 1, title: 'Rascunho', durationMinutes: 10, position: 2, vimeoId: '456', published: false },
    ],
  }],
} satisfies AcademicCourseTree;

describe('StudentPortalService', () => {
  const repository = {
    getStudent: vi.fn(), listStudentCourses: vi.fn(), getCourseTree: vi.fn(), listCompletions: vi.fn(),
    getStudentLesson: vi.fn(), completeLesson: vi.fn(), updateStudent: vi.fn(), updateStudentPassword: vi.fn(),
    findStudentCredentialByEmail: vi.fn(),
  } as unknown as AcademicRepository;
  const service = new StudentPortalService(repository, () => new Date('2026-10-13T12:00:00.000Z'));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repository.getStudent).mockResolvedValue(student);
    vi.mocked(repository.listStudentCourses).mockResolvedValue([course]);
    vi.mocked(repository.getCourseTree).mockResolvedValue(tree);
    vi.mocked(repository.listCompletions).mockResolvedValue([]);
  });

  it('lista somente aulas publicadas e calcula a próxima aula', async () => {
    const result = await service.getCourse('student-1', '2');
    expect(result.modules[0].lessons.map((lesson) => lesson.id)).toEqual(['lesson-1']);
    expect(result.progress).toEqual({ completed: 0, total: 1, percentage: 0 });
    expect(result.nextLesson?.id).toBe('lesson-1');
  });

  it('nega conta desativada e matrícula suspensa mesmo com sessão anterior', async () => {
    vi.mocked(repository.getStudent).mockResolvedValueOnce({ ...student, status: 'disabled' });
    await expect(service.listCourses('student-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    vi.mocked(repository.getStudentLesson).mockResolvedValueOnce(null);
    await expect(service.completeLesson('student-1', 'lesson-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('conclui a mesma aula idempotentemente e devolve progresso atual', async () => {
    vi.mocked(repository.getStudentLesson).mockResolvedValue({
      course, module: tree.modules[0], lesson: tree.modules[0].lessons[0],
      enrollment: { id: 'enrollment-1', studentId: 'student-1', courseId: '2', status: 'active', createdAt: 'now', updatedAt: 'now' },
    });
    vi.mocked(repository.listCompletions).mockResolvedValue([
      { studentId: 'student-1', lessonId: 'lesson-1', completedAt: '2026-10-13T12:00:00.000Z' },
    ]);
    const first = await service.completeLesson('student-1', 'lesson-1');
    const repeated = await service.completeLesson('student-1', 'lesson-1');
    expect(repository.completeLesson).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ completed: 1, total: 1, percentage: 100 });
    expect(repeated).toEqual(first);
  });

  it('atualiza somente nome e telefone do próprio perfil', async () => {
    const result = await service.updateProfile('student-1', { fullName: 'Ana Atualizada', phone: '(11) 99999-9999' });
    expect(result).toMatchObject({ fullName: 'Ana Atualizada', email: 'ana@example.com' });
    expect(repository.updateStudent).toHaveBeenCalledWith(expect.objectContaining({ id: 'student-1', email: 'ana@example.com' }));
  });

  it('troca a senha temporária sem pedir a atual e registra o instante da troca', async () => {
    vi.mocked(repository.getStudent).mockResolvedValue({ ...student, mustChangePassword: true });
    await service.changePassword('student-1', 'novaSenha123');
    expect(repository.updateStudentPassword).toHaveBeenCalledWith(
      'student-1', expect.stringMatching(/^scrypt\$/), false, '2026-10-13T12:00:00.000Z',
    );
  });

  it('exige a senha atual para a troca voluntária', async () => {
    vi.mocked(repository.findStudentCredentialByEmail).mockResolvedValue({ student, passwordHash: hashPassword('atualSenha123') });
    await expect(service.changePassword('student-1', 'novaSenha123')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(service.changePassword('student-1', 'novaSenha123', 'errada12345')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(repository.updateStudentPassword).not.toHaveBeenCalled();
    await service.changePassword('student-1', 'novaSenha123', 'atualSenha123');
    expect(repository.updateStudentPassword).toHaveBeenCalledOnce();
  });
});
