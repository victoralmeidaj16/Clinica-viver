import type { AcademicLesson } from '@thats-life/core';

/** Envia JSON à API de gestão e transforma recusa em erro com mensagem exibível. */
export async function sendJson<T = unknown>(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível salvar. Tente novamente.');
  return payload.data as T;
}

export const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.';

/** A API recebe o vídeo como link; o hash de vídeos não listados precisa voltar junto. */
export function lessonVimeoInput(lesson: Pick<AcademicLesson, 'vimeoId' | 'vimeoHash'>): string {
  return lesson.vimeoHash ? `https://vimeo.com/${lesson.vimeoId}/${lesson.vimeoHash}` : lesson.vimeoId;
}
