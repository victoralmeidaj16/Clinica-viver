import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type {
  AcademicCourse, AcademicCourseTree, AcademicEnrollment, AcademicLesson,
  AcademicModule, AcademicStudent, LessonCompletion,
} from '@thats-life/core';
import { AcademicManagementService } from './academicManagementService';
import type { AcademicRepository, StudentCredential, StudentLessonAccess } from './academicRepository';
import { authenticateStudent } from './studentAuth';
import { StudentPortalService } from './studentPortalService';

class JourneyRepository implements AcademicRepository {
  students = new Map<string, AcademicStudent>();
  credentials = new Map<string, string>();
  courses = new Map<string, AcademicCourse>();
  modules = new Map<string, AcademicModule>();
  lessons = new Map<string, AcademicLesson>();
  enrollments = new Map<string, AcademicEnrollment>();
  completions = new Map<string, LessonCompletion>();

  async findStudentCredentialByEmail(email: string): Promise<StudentCredential | null> {
    const student = [...this.students.values()].find((item) => item.email === email);
    return student ? { student, passwordHash: this.credentials.get(student.id)! } : null;
  }
  async getStudent(id: string) { return this.students.get(id) ?? null; }
  async listStudents() { return [...this.students.values()]; }
  async insertStudent(student: AcademicStudent, passwordHash: string) { this.students.set(student.id, student); this.credentials.set(student.id, passwordHash); }
  async updateStudent(student: AcademicStudent) { this.students.set(student.id, student); }
  async updateStudentPassword(id: string, passwordHash: string, mustChangePassword: boolean, changedAt: string) {
    const student = this.students.get(id)!;
    this.credentials.set(id, passwordHash);
    this.students.set(id, { ...student, mustChangePassword, passwordChangedAt: changedAt });
  }
  async listCoursesForManagement() { return [...this.courses.values()]; }
  async getCourseTree(id: string): Promise<AcademicCourseTree | null> {
    const course = this.courses.get(id); if (!course) return null;
    const modules = [...this.modules.values()].filter((item) => item.courseId === id).sort((a, b) => a.position - b.position);
    return { ...course, modules: modules.map((item) => ({ ...item, lessons: [...this.lessons.values()].filter((lesson) => lesson.moduleId === item.id).sort((a, b) => a.position - b.position) })) };
  }
  async saveCourse(course: AcademicCourse) {
    const saved = { ...course, id: course.id || `course-${this.courses.size + 1}` };
    this.courses.set(saved.id, saved); return saved;
  }
  async saveModule(academicModule: AcademicModule) { this.modules.set(academicModule.id, academicModule); }
  async saveLesson(lesson: AcademicLesson) { this.lessons.set(lesson.id, lesson); }
  async listEnrollments(studentId?: string) { return [...this.enrollments.values()].filter((item) => !studentId || item.studentId === studentId); }
  async saveEnrollment(enrollment: AcademicEnrollment) { this.enrollments.set(enrollment.id, enrollment); }
  async listStudentCourses(studentId: string) {
    const allowed = new Set([...this.enrollments.values()].filter((item) => item.studentId === studentId && item.status === 'active').map((item) => item.courseId));
    return [...this.courses.values()].filter((item) => allowed.has(item.id) && item.active && item.published);
  }
  async getStudentLesson(studentId: string, lessonId: string): Promise<StudentLessonAccess | null> {
    const lesson = this.lessons.get(lessonId); if (!lesson?.published) return null;
    const course = this.courses.get(lesson.courseId); const academicModule = this.modules.get(lesson.moduleId);
    const enrollment = [...this.enrollments.values()].find((item) => item.studentId === studentId && item.courseId === lesson.courseId && item.status === 'active');
    return course?.active && course.published && academicModule && enrollment ? { course, module: academicModule, lesson, enrollment } : null;
  }
  async listCompletions(studentId: string, courseId?: string) {
    const courseLessonIds = courseId ? new Set([...this.lessons.values()].filter((item) => item.courseId === courseId).map((item) => item.id)) : null;
    return [...this.completions.values()].filter((item) => item.studentId === studentId && (!courseLessonIds || courseLessonIds.has(item.lessonId)));
  }
  async completeLesson(studentId: string, lessonId: string, completedAt: string) {
    const key = `${studentId}:${lessonId}`;
    if (!this.completions.has(key)) this.completions.set(key, { studentId, lessonId, completedAt });
  }
}

describe('jornada acadêmica completa', () => {
  it('preserva identidade, acesso e progresso entre criação, suspensão e reativação', async () => {
    const repository = new JourneyRepository();
    const now = () => new Date('2026-10-13T12:00:00.000Z');
    const management = new AcademicManagementService(repository, 'institution-1', now);
    const portal = new StudentPortalService(repository, now);

    const student = await management.createStudent({ fullName: 'Ana Aluna', email: 'ana@example.com', temporaryPassword: 'Temporaria123' }, 'admin-1');
    const initialSession = await authenticateStudent('ana@example.com', 'Temporaria123', repository);
    expect(initialSession?.mustChangePassword).toBe(true);
    await portal.changePassword(student.id, 'Definitiva123');
    expect((await authenticateStudent('ana@example.com', 'Definitiva123', repository))?.mustChangePassword).toBe(false);

    const course = await management.createCourse({ title: 'Formação clínica', description: 'Curso inicial', position: 1, active: true, published: true });
    const academicModule = await management.createModule({ courseId: course.id, title: 'Fundamentos', position: 1 });
    const lesson = await management.createLesson({ courseId: course.id, moduleId: academicModule.id, modulePosition: 1, title: 'Acolhimento', durationMinutes: 20, position: 1, vimeoUrl: 'https://vimeo.com/76979871', published: true });
    const enrollment = await management.upsertEnrollment({ studentId: student.id, courseId: course.id, status: 'active' });

    expect((await portal.getCourse(student.id, course.id)).nextLesson?.id).toBe(lesson.id);
    expect(await portal.completeLesson(student.id, lesson.id)).toEqual({ completed: 1, total: 1, percentage: 100 });
    expect((await portal.getDashboard(student.id)).courses[0].progress.percentage).toBe(100);

    await management.setEnrollmentStatus(enrollment.id, 'suspended');
    expect(await portal.listCourses(student.id)).toEqual([]);
    await expect(portal.getLesson(student.id, lesson.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await repository.listCompletions(student.id, course.id)).toHaveLength(1);

    await management.setEnrollmentStatus(enrollment.id, 'active');
    expect((await portal.getDashboard(student.id)).courses[0].progress.percentage).toBe(100);
  });
});
