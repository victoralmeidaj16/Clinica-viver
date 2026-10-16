import 'server-only';

import {
  assertAcademicPassword,
  isCourseCertificateEligible,
  formatCertificateDuration,
  nextIncompleteLesson,
  summarizeCourseProgress,
  type AcademicCourse,
  type AcademicCourseTree,
  type AcademicLesson,
  type AcademicStudent,
  type CourseProgress,
  type CertificateRecord,
  type LessonCompletion,
} from '@thats-life/core';
import { ApplicationError } from '@/server/application/http';
import { hashPassword, verifyPasswordHash } from '@/server/security/passwordHash';
import { getAcademicRepository, type AcademicRepository } from './academicRepository';
import { certificadosRepo } from '@/server/certificados/certificadosRepository';

export interface StudentCertificateSummary {
  code: string;
  courseId?: string;
  courseTitle: string;
  durationHours: string;
  issueDate: string;
  completionDate?: string;
  status: CertificateRecord['status'];
}

interface StudentCertificateRepository {
  emitirAutomatico(input: {
    institutionId: string; studentId: string; courseId: string; studentName: string; studentEmail?: string;
    courseTitle: string; durationHours: string; issueDate: string; startDate?: string; completionDate: string;
    certificateInstructor?: string; certificateDurationMinutes?: number;
    certificateTextModel?: CertificateRecord['certificateTextModel'];
  }): Promise<Pick<CertificateRecord, 'code'>>;
  listarDoAluno(studentId: string, institutionId: string): Promise<CertificateRecord[]>;
  porCodigo(code: string): Promise<CertificateRecord | null>;
}

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
    private readonly certificateRepository: StudentCertificateRepository = certificadosRepo,
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
    const student = await this.requireStudent(studentId);
    const access = await this.repository.getStudentLesson(studentId, lessonId);
    if (!access) throw new ApplicationError('NOT_FOUND', 'Aula não encontrada ou acesso suspenso.', 404);
    await this.repository.completeLesson(studentId, lessonId, this.now().toISOString());
    const tree = await this.repository.getCourseTree(access.course.id);
    if (!tree) throw new ApplicationError('NOT_FOUND', 'Curso não encontrado.', 404);
    const completions = await this.repository.listCompletions(studentId, access.course.id);
    const lessons = tree.modules.flatMap((module) => module.lessons);
    const progress = summarizeCourseProgress(lessons, completions);
    await this.issueEligibleCertificate(student, access.course, lessons, completions, access.enrollment.createdAt);
    return progress;
  }

  async listCertificates(studentId: string): Promise<StudentCertificateSummary[]> {
    const student = await this.requireStudent(studentId);
    const current = await this.certificateRepository.listarDoAluno(student.id, student.institutionId);
    const issuedCourseIds = new Set(current.map((certificate) => certificate.courseId).filter(Boolean));
    const [courses, enrollments] = await Promise.all([
      this.listCourses(student.id),
      this.repository.listEnrollments(student.id),
    ]);
    for (const course of courses.filter((item) => item.progress.percentage === 100 && !issuedCourseIds.has(item.id))) {
      const lessons = course.modules.flatMap((module) => module.lessons);
      const completions = await this.repository.listCompletions(student.id, course.id);
      const enrollment = enrollments.find((item) => item.courseId === course.id && item.status === 'active');
      await this.issueEligibleCertificate(student, course, lessons, completions, enrollment?.createdAt);
    }
    const certificates = await this.certificateRepository.listarDoAluno(student.id, student.institutionId);
    return certificates.map(toStudentCertificateSummary);
  }

  async getOwnedCertificate(studentId: string, code: string): Promise<CertificateRecord> {
    const student = await this.requireStudent(studentId);
    const certificate = await this.certificateRepository.porCodigo(code);
    if (!certificate || certificate.studentId !== student.id || certificate.institutionId !== student.institutionId) {
      throw new ApplicationError('NOT_FOUND', 'Certificado não encontrado.', 404);
    }
    return certificate;
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

  private async issueEligibleCertificate(
    student: AcademicStudent,
    course: AcademicCourse,
    lessons: AcademicLesson[],
    completions: LessonCompletion[],
    startedAt?: string,
  ): Promise<void> {
    if (!isCourseCertificateEligible(lessons, completions)) return;
    const completionDate = completions.map((completion) => completion.completedAt).sort().at(-1) ?? this.now().toISOString();
    try {
      await this.certificateRepository.emitirAutomatico({
        institutionId: student.institutionId,
        studentId: student.id,
        courseId: course.id,
        studentName: student.fullName,
        studentEmail: student.email,
        courseTitle: course.title,
        certificateTextModel: course.certificateTextModel ?? 'standard',
        certificateInstructor: course.certificateInstructor,
        certificateDurationMinutes: course.certificateDurationMinutes,
        durationHours: course.certificateTextModel === 'online-course-with-instructor'
          ? formatCertificateDuration(course.certificateDurationMinutes ?? 0)
          : `${Math.max(1, Math.round(lessons.filter((lesson) => lesson.published)
            .reduce((total, lesson) => total + lesson.durationMinutes, 0) / 60))}h`,
        issueDate: this.now().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        startDate: startedAt ? isoDate(startedAt) : undefined,
        completionDate: isoDate(completionDate) ?? this.now().toISOString().slice(0, 10),
      });
    } catch (error) {
      // A conclusão acadêmica é a fonte de verdade. A listagem e repetições tentam emitir novamente.
      console.error('Falha ao emitir certificado automático após conclusão do curso:', error);
    }
  }

  private async requireStudent(studentId: string): Promise<AcademicStudent> {
    const student = await this.repository.getStudent(studentId);
    if (!student || student.status !== 'active') throw new ApplicationError('FORBIDDEN', 'A conta do aluno não está ativa.', 403);
    return student;
  }
}

function isoDate(value: string): string | undefined {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString().slice(0, 10);
}

function toStudentCertificateSummary(certificate: CertificateRecord): StudentCertificateSummary {
  return {
    code: certificate.code,
    courseId: certificate.courseId,
    courseTitle: certificate.courseTitle,
    durationHours: certificate.durationHours,
    issueDate: certificate.issueDate,
    completionDate: certificate.completionDate,
    status: certificate.status,
  };
}
