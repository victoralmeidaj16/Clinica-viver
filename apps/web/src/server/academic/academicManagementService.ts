import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  assertAcademicPassword,
  normalizeVimeoId,
  type AcademicCourse,
  type AcademicEnrollment,
  type AcademicLesson,
  type AcademicModule,
  type AcademicStudent,
} from '@thats-life/core';
import { ApplicationError } from '@/server/application/http';
import { hashPassword } from '@/server/security/passwordHash';
import { getAcademicRepository, type AcademicRepository } from './academicRepository';

export interface CreateStudentInput {
  fullName: string;
  email: string;
  phone?: string;
  temporaryPassword: string;
}

export interface SaveCourseInput {
  title: string;
  description?: string;
  coverUrl?: string;
  position: number;
  active: boolean;
  published: boolean;
}

export interface SaveModuleInput {
  courseId: string;
  title: string;
  position: number;
}

export interface SaveLessonInput {
  courseId: string;
  moduleId: string;
  modulePosition: number;
  title: string;
  description?: string;
  durationMinutes: number;
  position: number;
  vimeoUrl: string;
  published: boolean;
}

export interface SaveEnrollmentInput {
  studentId: string;
  courseId: string;
  status: AcademicEnrollment['status'];
}

const normalizedEmail = (value: string) => value.trim().toLocaleLowerCase('pt-BR');

function required(value: string, label: string): string {
  const clean = value.trim();
  if (!clean) throw new ApplicationError('INVALID_INPUT', `${label} é obrigatório.`, 400);
  return clean;
}

export class AcademicManagementService {
  constructor(
    private readonly repository: AcademicRepository = getAcademicRepository(),
    private readonly institutionId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listStudents() { return this.repository.listStudents(); }
  listCourses() { return this.repository.listCoursesForManagement(); }
  getCourse(courseId: string) { return this.repository.getCourseTree(courseId); }
  listEnrollments(studentId?: string) { return this.repository.listEnrollments(studentId); }

  async createStudent(input: CreateStudentInput, actorUserId: string): Promise<AcademicStudent> {
    const email = normalizedEmail(input.email);
    const fullName = required(input.fullName, 'Nome');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new ApplicationError('INVALID_EMAIL', 'Informe um e-mail válido.', 400);
    }
    try { assertAcademicPassword(input.temporaryPassword); }
    catch (error) { throw new ApplicationError('WEAK_PASSWORD', error instanceof Error ? error.message : 'Senha inválida.', 400); }
    if (await this.repository.findStudentCredentialByEmail(email)) {
      throw new ApplicationError('EMAIL_IN_USE', 'Este e-mail já possui uma conta de aluno.', 409);
    }
    const timestamp = this.now().toISOString();
    const student: AcademicStudent = {
      id: randomUUID(), institutionId: this.institutionId, fullName, email,
      phone: input.phone?.trim() || undefined, status: 'active', mustChangePassword: true,
      createdAt: timestamp, updatedAt: timestamp,
    };
    await this.repository.insertStudent(student, hashPassword(input.temporaryPassword), actorUserId);
    return student;
  }

  async updateStudent(studentId: string, input: Pick<CreateStudentInput, 'fullName' | 'email' | 'phone'> & { status: AcademicStudent['status'] }): Promise<AcademicStudent> {
    const current = await this.requireStudent(studentId);
    const email = normalizedEmail(input.email);
    const owner = await this.repository.findStudentCredentialByEmail(email);
    if (owner && owner.student.id !== studentId) throw new ApplicationError('EMAIL_IN_USE', 'Este e-mail já possui uma conta de aluno.', 409);
    const next = {
      ...current, fullName: required(input.fullName, 'Nome'), email,
      phone: input.phone?.trim() || undefined, status: input.status, updatedAt: this.now().toISOString(),
    };
    await this.repository.updateStudent(next);
    return next;
  }

  async resetTemporaryPassword(studentId: string, password: string, actorUserId: string): Promise<void> {
    await this.requireStudent(studentId);
    try { assertAcademicPassword(password); }
    catch (error) { throw new ApplicationError('WEAK_PASSWORD', error instanceof Error ? error.message : 'Senha inválida.', 400); }
    await this.repository.updateStudentPassword(studentId, hashPassword(password), true, actorUserId);
  }

  async setStudentStatus(studentId: string, status: AcademicStudent['status']): Promise<AcademicStudent> {
    const current = await this.requireStudent(studentId);
    const next = { ...current, status, updatedAt: this.now().toISOString() };
    await this.repository.updateStudent(next);
    return next;
  }

  async createCourse(input: SaveCourseInput): Promise<AcademicCourse> {
    return this.repository.saveCourse({
      id: '', institutionId: this.institutionId, title: required(input.title, 'Título'),
      description: input.description?.trim() ?? '', coverUrl: input.coverUrl?.trim() || undefined,
      position: input.position, active: input.active, published: input.published,
    });
  }

  async updateCourse(courseId: string, input: SaveCourseInput): Promise<AcademicCourse> {
    const current = await this.repository.getCourseTree(courseId);
    if (!current) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado.', 404);
    return this.repository.saveCourse({
      ...current, title: required(input.title, 'Título'), description: input.description?.trim() ?? '',
      coverUrl: input.coverUrl?.trim() || undefined, position: input.position,
      active: input.active, published: input.published,
    });
  }

  async createModule(input: SaveModuleInput): Promise<AcademicModule> {
    if (!await this.repository.getCourseTree(input.courseId)) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado.', 404);
    const module = { id: randomUUID(), courseId: input.courseId, title: required(input.title, 'Título'), position: input.position };
    await this.repository.saveModule(module);
    return module;
  }

  async updateModule(moduleId: string, input: SaveModuleInput): Promise<AcademicModule> {
    const course = await this.repository.getCourseTree(input.courseId);
    if (!course?.modules.some((module) => module.id === moduleId)) throw new ApplicationError('NOT_FOUND', 'Módulo não encontrado.', 404);
    const module = { id: moduleId, courseId: input.courseId, title: required(input.title, 'Título'), position: input.position };
    await this.repository.saveModule(module);
    return module;
  }

  async createLesson(input: SaveLessonInput): Promise<AcademicLesson> {
    const course = await this.repository.getCourseTree(input.courseId);
    if (!course?.modules.some((module) => module.id === input.moduleId)) throw new ApplicationError('NOT_FOUND', 'Módulo não encontrado.', 404);
    const lesson = this.lessonFromInput(randomUUID(), input);
    await this.repository.saveLesson(lesson);
    return lesson;
  }

  async updateLesson(lessonId: string, input: SaveLessonInput): Promise<AcademicLesson> {
    const course = await this.repository.getCourseTree(input.courseId);
    if (!course?.modules.some((module) => module.lessons.some((lesson) => lesson.id === lessonId))) {
      throw new ApplicationError('NOT_FOUND', 'Aula não encontrada.', 404);
    }
    const lesson = this.lessonFromInput(lessonId, input);
    await this.repository.saveLesson(lesson);
    return lesson;
  }

  async upsertEnrollment(input: SaveEnrollmentInput): Promise<AcademicEnrollment> {
    await this.requireStudent(input.studentId);
    if (!await this.repository.getCourseTree(input.courseId)) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado.', 404);
    const current = (await this.repository.listEnrollments(input.studentId)).find((item) => item.courseId === input.courseId);
    const timestamp = this.now().toISOString();
    const enrollment: AcademicEnrollment = {
      id: current?.id ?? randomUUID(), studentId: input.studentId, courseId: input.courseId,
      status: input.status, createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
    };
    await this.repository.saveEnrollment(enrollment);
    return enrollment;
  }

  async setEnrollmentStatus(enrollmentId: string, status: AcademicEnrollment['status']): Promise<AcademicEnrollment> {
    const current = (await this.repository.listEnrollments()).find((item) => item.id === enrollmentId);
    if (!current) throw new ApplicationError('NOT_FOUND', 'Matrícula não encontrada.', 404);
    const next = { ...current, status, updatedAt: this.now().toISOString() };
    await this.repository.saveEnrollment(next);
    return next;
  }

  private async requireStudent(studentId: string): Promise<AcademicStudent> {
    const student = await this.repository.getStudent(studentId);
    if (!student) throw new ApplicationError('NOT_FOUND', 'Aluno não encontrado.', 404);
    return student;
  }

  private lessonFromInput(id: string, input: SaveLessonInput): AcademicLesson {
    let vimeoId: string;
    try { vimeoId = normalizeVimeoId(input.vimeoUrl); }
    catch { throw new ApplicationError('INVALID_VIMEO', 'Informe um ID ou link válido do Vimeo.', 400); }
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
      throw new ApplicationError('INVALID_INPUT', 'A duração da aula deve ser maior que zero.', 400);
    }
    return {
      id, courseId: input.courseId, moduleId: input.moduleId, modulePosition: input.modulePosition,
      title: required(input.title, 'Título'), description: input.description?.trim() || undefined,
      durationMinutes: input.durationMinutes, position: input.position, vimeoId, published: input.published,
    };
  }
}
