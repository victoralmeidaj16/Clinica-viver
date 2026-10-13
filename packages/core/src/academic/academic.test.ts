import { describe, expect, it } from 'vitest';
import {
  assertAcademicPassword,
  nextIncompleteLesson,
  normalizeVimeoId,
  parseVimeoVideo,
  summarizeCourseProgress,
  type AcademicLesson,
} from '.';

const lessons: AcademicLesson[] = [
  {
    id: 'lesson-2', courseId: 'course-1', moduleId: 'module-1', modulePosition: 1,
    title: 'Segunda aula', durationMinutes: 20, position: 2, vimeoId: '200', published: true,
  },
  {
    id: 'lesson-1', courseId: 'course-1', moduleId: 'module-1', modulePosition: 1,
    title: 'Primeira aula', durationMinutes: 10, position: 1, vimeoId: '100', published: true,
  },
  {
    id: 'lesson-draft', courseId: 'course-1', moduleId: 'module-2', modulePosition: 2,
    title: 'Rascunho', durationMinutes: 15, position: 1, vimeoId: '300', published: false,
  },
];

describe('domínio acadêmico', () => {
  it('normaliza ID e URLs Vimeo, inclusive player e caminho privado', () => {
    expect(normalizeVimeoId(' 76979871 ')).toBe('76979871');
    expect(normalizeVimeoId('https://vimeo.com/76979871/abc123')).toBe('76979871');
    expect(normalizeVimeoId('https://player.vimeo.com/video/76979871?h=abc123')).toBe('76979871');
  });

  it('preserva o hash de links não listados para o player conseguir reproduzir', () => {
    expect(parseVimeoVideo('https://vimeo.com/76979871/abc123')).toEqual({ id: '76979871', hash: 'abc123' });
    expect(parseVimeoVideo('https://player.vimeo.com/video/76979871?h=abc123')).toEqual({ id: '76979871', hash: 'abc123' });
    expect(parseVimeoVideo('76979871')).toEqual({ id: '76979871' });
    expect(parseVimeoVideo('https://vimeo.com/76979871')).toEqual({ id: '76979871' });
  });

  it('usa o ID do vídeo, não o da vitrine ou canal, em links com vários números', () => {
    expect(parseVimeoVideo('https://vimeo.com/showcase/111/video/222')).toEqual({ id: '222' });
    expect(parseVimeoVideo('https://vimeo.com/channels/staffpicks/333')).toEqual({ id: '333' });
  });

  it('recusa YouTube, texto vazio e URL Vimeo sem ID numérico', () => {
    expect(() => normalizeVimeoId('https://youtube.com/watch?v=76979871')).toThrow(/Vimeo/);
    expect(() => normalizeVimeoId('')).toThrow(/Vimeo/);
    expect(() => normalizeVimeoId('https://vimeo.com/showcase')).toThrow(/Vimeo/);
  });

  it('exige 10 caracteres com letra e número na senha acadêmica', () => {
    expect(() => assertAcademicPassword('forte12345')).not.toThrow();
    expect(() => assertAcademicPassword('curta123')).toThrow(/10 caracteres/);
    expect(() => assertAcademicPassword('apenasletras')).toThrow(/letra e número/);
    expect(() => assertAcademicPassword('1234567890')).toThrow(/letra e número/);
  });

  it('calcula progresso somente sobre aulas publicadas', () => {
    expect(summarizeCourseProgress(lessons, [
      { studentId: 'student-1', lessonId: 'lesson-1', completedAt: '2026-10-13T12:00:00.000Z' },
      { studentId: 'student-1', lessonId: 'lesson-draft', completedAt: '2026-10-13T12:00:00.000Z' },
    ])).toEqual({ completed: 1, total: 2, percentage: 50 });
  });

  it('preserva conclusão armazenada ao despublicar uma aula sem contá-la no percentual', () => {
    const completion = { studentId: 'student-1', lessonId: 'lesson-2', completedAt: '2026-10-13T12:00:00.000Z' };
    const unpublished = lessons.map((lesson) => lesson.id === 'lesson-2' ? { ...lesson, published: false } : lesson);
    expect(summarizeCourseProgress(unpublished, [completion])).toEqual({ completed: 0, total: 1, percentage: 0 });
    expect(completion.lessonId).toBe('lesson-2');
  });

  it('seleciona a primeira aula publicada e não concluída na ordem módulo/aula', () => {
    expect(nextIncompleteLesson(lessons, [])?.id).toBe('lesson-1');
    expect(nextIncompleteLesson(lessons, [
      { studentId: 'student-1', lessonId: 'lesson-1', completedAt: '2026-10-13T12:00:00.000Z' },
    ])?.id).toBe('lesson-2');
  });
});
