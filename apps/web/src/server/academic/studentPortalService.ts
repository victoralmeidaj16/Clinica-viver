import 'server-only';

import {
  assertAcademicPassword,
  nextIncompleteLesson,
  summarizeCourseProgress,
  type AcademicCourse,
  type AcademicCourseTree,
  type AcademicLesson,
  type AcademicStudent,
  type CourseProgress,
} from '@thats-life/core';
import { ApplicationError } from '@/server/application/http';
import { hashPassword, verifyPasswordHash } from '@/server/security/passwordHash';
import { getAcademicRepository, type AcademicRepository } from './academicRepository';

export interface StudentCourseView extends AcademicCourseTree {
  progress: CourseProgress;
  nextLesson?: AcademicLesson;
}

export interface StudentDashboard {
  student: AcademicStudent;
  courses: StudentCourseView[];
}

export class StudentPortalService {
  constructor(
    private readonly repository: AcademicRepository = getAcademicRepository(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getDashboard(studentId: string): Promise<StudentDashboard> {
    const student = await this.requireStudent(studentId);
    return { student, courses: await this.listCourses(studentId) };
  }

  async listCourses(studentId: string): Promise<StudentCourseView[]> {
    await this.requireStudent(studentId);
    const courses = await this.repository.listStudentCourses(studentId);
    return Promise.all(courses.map((course) => this.courseView(studentId, course)));
  }

  async getCourse(studentId: string, courseId: string): Promise<StudentCourseView> {
    await this.requireStudent(studentId);
    const allowed = (await this.repository.listStudentCourses(studentId)).find((course) => course.id === courseId);
    if (!allowed) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado ou matrícula inativa.', 404);
    return this.courseView(studentId, allowed);
  }

  async getLesson(studentId: string, lessonId: string) {
    await this.requireStudent(studentId);
    const access = await this.repository.getStudentLesson(studentId, lessonId);
    if (!access) throw new ApplicationError('NOT_FOUND', 'Aula não encontrada ou acesso suspenso.', 404);
    const completions = await this.repository.listCompletions(studentId, access.course.id);
    return { ...access, completed: completions.some((item) => item.lessonId === lessonId) };
  }

  async completeLesson(studentId: string, lessonId: string): Promise<CourseProgress> {
    await this.requireStudent(studentId);
    const access = await this.repository.getStudentLesson(studentId, lessonId);
    if (!access) throw new ApplicationError('NOT_FOUND', 'Aula não encontrada ou acesso suspenso.', 404);
    await this.repository.completeLesson(studentId, lessonId, this.now().toISOString());
    const tree = await this.repository.getCourseTree(access.course.id);
    if (!tree) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado.', 404);
    const completions = await this.repository.listCompletions(studentId, access.course.id);
    return summarizeCourseProgress(tree.modules.flatMap((module) => module.lessons), completions);
  }

  async getProfile(studentId: string): Promise<AcademicStudent> {
    return this.requireStudent(studentId);
  }

  async updateProfile(studentId: string, input: { fullName: string; phone?: string }): Promise<AcademicStudent> {
    const current = await this.requireStudent(studentId);
    const fullName = input.fullName.trim();
    if (!fullName) throw new ApplicationError('INVALID_INPUT', 'Nome é obrigatório.', 400);
    const next = {
      ...current, fullName, phone: input.phone?.trim() || undefined, updatedAt: this.now().toISOString(),
    };
    await this.repository.updateStudent(next);
    return next;
  }

  /** A senha atual só é dispensada na troca obrigatória da senha temporária. */
  async changePassword(studentId: string, password: string, currentPassword = ''): Promise<void> {
    const student = await this.requireStudent(studentId);
    if (!student.mustChangePassword) {
      const credential = await this.repository.findStudentCredentialByEmail(student.email);
      if (!credential || credential.student.id !== studentId || !verifyPasswordHash(currentPassword, credential.passwordHash)) {
        throw new ApplicationError('INVALID_CREDENTIALS', 'Senha atual incorreta.', 400);
      }
    }
    try { assertAcademicPassword(password); }
    catch (error) { throw new ApplicationError('WEAK_PASSWORD', error instanceof Error ? error.message : 'Senha inválida.', 400); }
    await this.repository.updateStudentPassword(studentId, hashPassword(password), false, this.now().toISOString());
  }

  private async courseView(studentId: string, course: AcademicCourse): Promise<StudentCourseView> {
    const tree = await this.repository.getCourseTree(course.id);
    if (!tree || !tree.active || !tree.published) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado.', 404);
    const visibleTree: AcademicCourseTree = {
      ...tree,
      modules: tree.modules.map((module) => ({
        ...module,
        lessons: module.lessons.filter((lesson) => lesson.published),
      })),
    };
    const lessons = visibleTree.modules.flatMap((module) => module.lessons);
    const completions = await this.repository.listCompletions(studentId, course.id);
    return {
      ...visibleTree,
      progress: summarizeCourseProgress(lessons, completions),
      nextLesson: nextIncompleteLesson(lessons, completions),
    };
  }

  private async requireStudent(studentId: string): Promise<AcademicStudent> {
    const student = await this.repository.getStudent(studentId);
    if (!student || student.status !== 'active') throw new ApplicationError('FORBIDDEN', 'A conta do aluno não está ativa.', 403);
    return student;
  }
}
