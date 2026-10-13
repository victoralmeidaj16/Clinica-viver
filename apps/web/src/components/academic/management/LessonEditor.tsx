'use client';

import { FormEvent, useState } from 'react';
import type { AcademicLesson } from '@thats-life/core';
import { ConfirmPrompt } from './ConfirmButton';
import { errorMessage, lessonVimeoInput, sendJson } from './managementRequest';

const emptyForm = { title: '', description: '', durationMinutes: 10, vimeoUrl: '', published: false };

export function LessonEditor({ courseId, moduleId, modulePosition, nextPosition = 1, lesson, onSaved, onCancel }: {
  courseId: string; moduleId: string; modulePosition: number; nextPosition?: number;
  lesson?: AcademicLesson; onSaved: () => void; onCancel?: () => void;
}) {
  const [form, setForm] = useState(() => lesson ? {
    title: lesson.title, description: lesson.description ?? '', durationMinutes: lesson.durationMinutes,
    vimeoUrl: lessonVimeoInput(lesson), published: lesson.published,
  } : emptyForm);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  async function save() {
    setMessage(''); setConfirming(false);
    try {
      const body = { ...form, courseId, moduleId, modulePosition, position: lesson?.position ?? nextPosition };
      if (lesson) await sendJson(`/api/academico/gestao/aulas/${lesson.id}`, 'PATCH', body);
      else await sendJson(`/api/academico/gestao/modulos/${moduleId}/aulas`, 'POST', body);
      if (!lesson) setForm(emptyForm);
      setMessage(lesson ? 'Aula salva.' : 'Aula adicionada.'); onSaved();
    } catch (cause) { setMessage(errorMessage(cause)); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    // Despublicar tira a aula do portal de todos os alunos matriculados.
    if (lesson?.published && !form.published) return setConfirming(true);
    void save();
  }

  return <form onSubmit={submit} className="mt-3 grid gap-3 rounded-2xl bg-psi-light p-4 sm:grid-cols-2">
    <label className="block"><span className="mb-1 block text-xs font-bold">Título da aula</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2 text-xs" /></label>
    <label className="block"><span className="mb-1 block text-xs font-bold">Link ou ID do Vimeo</span><input required value={form.vimeoUrl} onChange={(event) => setForm({ ...form, vimeoUrl: event.target.value })} className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2 text-xs" /></label>
    <label className="block"><span className="mb-1 block text-xs font-bold">Duração em minutos</span><input type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2 text-xs" /></label>
    <label className="flex items-end gap-2 pb-2 text-xs font-black"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publicar aula</label>
    {message && <p role="status" className="text-xs font-bold text-psi-deep sm:col-span-2">{message}</p>}
    {confirming && <div className="sm:col-span-2"><ConfirmPrompt message="Despublicar esta aula a retira do portal de todos os alunos. O progresso já registrado é mantido." onCancel={() => setConfirming(false)} onConfirm={() => void save()} /></div>}
    <div className="flex gap-2 sm:col-span-2">
      <button className="flex-1 rounded-xl bg-psi-deep px-4 py-2.5 text-xs font-black text-white">{lesson ? 'Salvar aula' : 'Adicionar aula Vimeo'}</button>
      {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-psi-soft bg-white px-4 py-2.5 text-xs font-black text-psi-deep">Fechar</button>}
    </div>
  </form>;
}
