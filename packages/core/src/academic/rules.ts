import type { AcademicLesson, CourseProgress, LessonCompletion } from './types';

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

export interface VimeoVideo {
  id: string;
  /** Hash de privacidade de links não listados; sem ele o embed recusa o vídeo. */
  hash?: string;
}

const VIMEO_HASH = /^[a-z0-9]{1,32}$/i;

export function parseVimeoVideo(input: string): VimeoVideo {
  const value = input.trim();
  if (/^\d+$/.test(value)) return { id: value };

  try {
    const url = new URL(value);
    if (!VIMEO_HOSTS.has(url.hostname.toLowerCase())) throw new Error();
    const parts = url.pathname.split('/').filter(Boolean);
    // Em /showcase/111/video/222 o vídeo é o número depois de "video";
    // nos demais formatos, o último segmento numérico.
    const afterVideo = parts.indexOf('video');
    const index = afterVideo >= 0 && /^\d+$/.test(parts[afterVideo + 1] ?? '')
      ? afterVideo + 1
      : parts.map((part) => /^\d+$/.test(part)).lastIndexOf(true);
    if (index >= 0) {
      const hash = url.searchParams.get('h') ?? parts[index + 1];
      return hash && VIMEO_HASH.test(hash) && !/^\d+$/.test(hash)
        ? { id: parts[index], hash }
        : { id: parts[index] };
    }
  } catch {
    // A mensagem única evita revelar diferenças desnecessárias de parsing.
  }

  throw new Error('Informe um ID ou link válido do Vimeo.');
}

export function normalizeVimeoId(input: string): string {
  return parseVimeoVideo(input).id;
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
