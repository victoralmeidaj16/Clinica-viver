import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { AcademicCourse, AcademicStudent } from '@thats-life/core';
import { AcademicManagementService } from './academicManagementService';
import type { AcademicRepository } from './academicRepository';

const student: AcademicStudent = {
  id: 'student-1', institutionId: 'inst-1', fullName: 'Ana Aluna', email: 'ana@example.com',
  status: 'active', mustChangePassword: true,
  createdAt: '2026-10-13T12:00:00.000Z', updatedAt: '2026-10-13T12:00:00.000Z',
};

const course: AcademicCourse = {
  id: '2', institutionId: 'inst-1', title: 'Psicodrama', description: '',
  position: 1, active: true, published: true,
};

describe('AcademicManagementService', () => {
  const repository = {
    findStudentCredentialByEmail: vi.fn(), getStudent: vi.fn(), insertStudent: vi.fn(),
    updateStudent: vi.fn(), updateStudentPassword: vi.fn(), saveLesson: vi.fn(),
    saveEnrollment: vi.fn(), getCourseTree: vi.fn(), saveCourse: vi.fn(), saveModule: vi.fn(),
    listEnrollments: vi.fn(),
  } as unknown as AcademicRepository;
  const service = new AcademicManagementService(repository, 'inst-1', () => new Date('2026-10-13T12:00:00.000Z'));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repository.listEnrollments).mockResolvedValue([]);
  });

  it('cria aluno com hash, troca obrigatória e resposta segura', async () => {
    vi.mocked(repository.findStudentCredentialByEmail).mockResolvedValue(null);
    const result = await service.createStudent({
      fullName: 'Ana Aluna', email: ' ANA@EXAMPLE.COM ', temporaryPassword: 'senhaForte123',
    }, 'admin-1');

    expect(repository.insertStudent).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com', mustChangePassword: true }),
      expect.stringMatching(/^scrypt\$/),
      'admin-1',
    );
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('temporaryPassword');
  });

  it('recusa senha fraca e e-mail acadêmico duplicado', async () => {
    await expect(service.createStudent({ fullName: 'Ana', email: 'ana@example.com', temporaryPassword: 'fraca' }, 'admin-1'))
      .rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    vi.mocked(repository.findStudentCredentialByEmail).mockResolvedValue({ student, passwordHash: 'scrypt$x$y' });
    await expect(service.createStudent({ fullName: 'Ana', email: 'ana@example.com', temporaryPassword: 'senhaForte123' }, 'admin-1'))
      .rejects.toMatchObject({ code: 'EMAIL_IN_USE' });
  });

  it('redefine senha temporária e exige troca no próximo login', async () => {
    vi.mocked(repository.getStudent).mockResolvedValue(student);
    await service.resetTemporaryPassword('student-1', 'outraSenha123', 'admin-2');
    expect(repository.updateStudentPassword).toHaveBeenCalledWith(
      'student-1', expect.stringMatching(/^scrypt\$/), true, '2026-10-13T12:00:00.000Z', 'admin-2',
    );
  });

  it('normaliza Vimeo e recusa outro provedor', async () => {
    vi.mocked(repository.getCourseTree).mockResolvedValue({ ...course, modules: [{ id: 'module-1', courseId: '2', title: 'Módulo', position: 1, lessons: [] }] });
    await service.createLesson({
      moduleId: 'module-1', courseId: '2', modulePosition: 1, title: 'Aula', durationMinutes: 12,
      position: 1, vimeoUrl: 'https://vimeo.com/76979871/abc', published: true,
    });
    expect(repository.saveLesson).toHaveBeenCalledWith(expect.objectContaining({ vimeoId: '76979871', vimeoHash: 'abc' }));
    await expect(service.createLesson({
      moduleId: 'module-1', courseId: '2', modulePosition: 1, title: 'Aula', durationMinutes: 12,
      position: 1, vimeoUrl: 'https://youtube.com/watch?v=123', published: true,
    })).rejects.toMatchObject({ code: 'INVALID_VIMEO' });
  });

  it('faz upsert da matrícula e preserva suspensão', async () => {
    vi.mocked(repository.getStudent).mockResolvedValue(student);
    vi.mocked(repository.getCourseTree).mockResolvedValue({ ...course, modules: [] });
    const enrollment = await service.upsertEnrollment({ studentId: 'student-1', courseId: '2', status: 'suspended' });
    expect(enrollment.status).toBe('suspended');
    expect(repository.saveEnrollment).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended' }));
  });

  it('valida e persiste o modelo exclusivo do certificado no curso', async () => {
    vi.mocked(repository.saveCourse).mockImplementation(async (value) => ({ ...value, id: 'course-special' }));
    const input = {
      title: 'Orientação Parental', description: '', position: 1, active: true, published: true,
      certificateTextModel: 'online-course-with-instructor' as const,
      certificateInstructor: 'Dra. Rafaela Dias Matavelli', certificateDurationMinutes: 180,
    };
    await expect(service.createCourse(input)).resolves.toMatchObject({
      certificateTextModel: 'online-course-with-instructor',
      certificateInstructor: 'Dra. Rafaela Dias Matavelli', certificateDurationMinutes: 180,
    });
    await expect(service.createCourse({ ...input, certificateInstructor: '' }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(service.createCourse({ ...input, certificateDurationMinutes: 0 }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('remove metadados exclusivos quando o curso volta ao modelo padrão', async () => {
    vi.mocked(repository.saveCourse).mockImplementation(async (value) => ({ ...value, id: 'course-standard' }));
    await expect(service.createCourse({
      title: 'Curso comum', description: '', position: 1, active: true, published: true,
      certificateTextModel: 'standard', certificateInstructor: 'Não deve persistir', certificateDurationMinutes: 90,
    })).resolves.toMatchObject({
      certificateTextModel: 'standard', certificateInstructor: undefined, certificateDurationMinutes: undefined,
    });
  });
});
