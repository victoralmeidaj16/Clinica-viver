import 'server-only';

import type {
  AcademicCourse,
  AcademicCourseTree,
  AcademicEnrollment,
  AcademicLesson,
  AcademicModule,
  AcademicStudent,
  LessonCompletion,
} from '@thats-life/core';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { MysqlAcademicRepository } from './mysqlAcademicRepository';

export interface StudentCredential {
  student: AcademicStudent;
  passwordHash: string;
}

export interface StudentLessonAccess {
  course: AcademicCourse;
  module: AcademicModule;
  lesson: AcademicLesson;
  enrollment: AcademicEnrollment;
}

export interface AcademicRepository {
  findStudentCredentialByEmail(email: string): Promise<StudentCredential | null>;
  getStudent(studentId: string): Promise<AcademicStudent | null>;
  listStudents(): Promise<AcademicStudent[]>;
  insertStudent(student: AcademicStudent, passwordHash: string, actorUserId: string): Promise<void>;
  updateStudent(student: AcademicStudent): Promise<void>;
  /** `changedAt` revoga as sessões emitidas antes dele (ver requireActiveStudent). */
  updateStudentPassword(studentId: string, passwordHash: string, mustChangePassword: boolean, changedAt: string, actorUserId?: string): Promise<void>;
  listCoursesForManagement(): Promise<AcademicCourse[]>;
  getCourseTree(courseId: string): Promise<AcademicCourseTree | null>;
  saveCourse(course: AcademicCourse): Promise<AcademicCourse>;
  saveModule(module: AcademicModule): Promise<void>;
  saveLesson(lesson: AcademicLesson): Promise<void>;
  listEnrollments(studentId?: string): Promise<AcademicEnrollment[]>;
  saveEnrollment(enrollment: AcademicEnrollment): Promise<void>;
  listStudentCourses(studentId: string): Promise<AcademicCourse[]>;
  getStudentLesson(studentId: string, lessonId: string): Promise<StudentLessonAccess | null>;
  listCompletions(studentId: string, courseId?: string): Promise<LessonCompletion[]>;
  completeLesson(studentId: string, lessonId: string, completedAt: string): Promise<void>;
}

let repository: AcademicRepository | undefined;

export function getAcademicRepository(): AcademicRepository {
  if (!isMysqlConfigured()) throw new Error('PERSISTENCE_UNAVAILABLE: o portal do aluno exige MySQL.');
  return repository ??= new MysqlAcademicRepository(undefined, instituicaoId());
}

export function setAcademicRepositoryForTests(value: AcademicRepository | undefined): void {
  repository = value;
}
