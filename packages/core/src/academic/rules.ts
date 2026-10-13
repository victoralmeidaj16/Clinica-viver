import type { AcademicLesson, CourseProgress, LessonCompletion } from './types';

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

export function normalizeVimeoId(input: string): string {
  const value = input.trim();
  if (/^\d+$/.test(value)) return value;

  try {
    const url = new URL(value);
    if (!VIMEO_HOSTS.has(url.hostname.toLowerCase())) throw new Error();
    const id = url.pathname.split('/').find((part) => /^\d+$/.test(part));
    if (id) return id;
  } catch {
    // A mensagem única evita revelar diferenças desnecessárias de parsing.
  }

  throw new Error('Informe um ID ou link válido do Vimeo.');
}

export function assertAcademicPassword(password: string): void {
  if (password.length < 10) {
    throw new Error('A senha deve ter pelo menos 10 caracteres.');
  }
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    throw new Error('A senha deve conter letra e número.');
  }
}

export function summarizeCourseProgress(
  lessons: readonly AcademicLesson[],
  completions: readonly LessonCompletion[],
): CourseProgress {
  const published = lessons.filter((lesson) => lesson.published);
  const completedIds = new Set(completions.map((completion) => completion.lessonId));
  const completed = published.filter((lesson) => completedIds.has(lesson.id)).length;
  return {
    completed,
    total: published.length,
    percentage: published.length === 0 ? 0 : Math.round((completed / published.length) * 100),
  };
}

export function nextIncompleteLesson(
  lessons: readonly AcademicLesson[],
  completions: readonly LessonCompletion[],
): AcademicLesson | undefined {
  const completedIds = new Set(completions.map((completion) => completion.lessonId));
  return lessons
    .filter((lesson) => lesson.published && !completedIds.has(lesson.id))
    .sort((left, right) => left.modulePosition - right.modulePosition || left.position - right.position)[0];
}
