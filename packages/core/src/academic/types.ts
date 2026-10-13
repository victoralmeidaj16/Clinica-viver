export type AcademicAccountStatus = 'active' | 'disabled';
export type AcademicEnrollmentStatus = 'active' | 'suspended';

export interface AcademicStudent {
  id: string;
  institutionId: string;
  fullName: string;
  email: string;
  phone?: string;
  status: AcademicAccountStatus;
  mustChangePassword: boolean;
  /** Instante da última troca ou redefinição; sessões anteriores a ele são inválidas. */
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicCourse {
  id: string;
  institutionId: string;
  title: string;
  description: string;
  coverUrl?: string;
  position: number;
  active: boolean;
  published: boolean;
}

export interface AcademicModule {
  id: string;
  courseId: string;
  title: string;
  position: number;
}

export interface AcademicLesson {
  id: string;
  courseId: string;
  moduleId: string;
  modulePosition: number;
  title: string;
  description?: string;
  durationMinutes: number;
  position: number;
  vimeoId: string;
  vimeoHash?: string;
  published: boolean;
}

export interface AcademicEnrollment {
  id: string;
  studentId: string;
  courseId: string;
  status: AcademicEnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LessonCompletion {
  studentId: string;
  lessonId: string;
  completedAt: string;
}

export interface CourseProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface AcademicCourseTree extends AcademicCourse {
  modules: Array<AcademicModule & { lessons: AcademicLesson[] }>;
}
