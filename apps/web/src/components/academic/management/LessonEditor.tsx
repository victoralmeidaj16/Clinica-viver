'use client';

import { FormEvent, useState } from 'react';

export function LessonEditor({ courseId, moduleId, modulePosition, nextPosition = 1, onSaved }: { courseId: string; moduleId: string; modulePosition: number; nextPosition?: number; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', durationMinutes: 10, vimeoUrl: '', published: false });
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch(`/api/academico/gestao/modulos/${moduleId}/aulas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, courseId, modulePosition, position: nextPosition }) });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.message ?? 'Falha ao salvar aula.');
    setForm({ title: '', description: '', durationMinutes: 10, vimeoUrl: '', published: false }); setMessage('Aula adicionada.'); onSaved();
  }
  return <form onSubmit={submit} className="mt-3 grid gap-3 rounded-2xl bg-psi-light p-4 sm:grid-cols-2">
    <label className="block"><span className="mb-1 block text-xs font-bold">Título da aula</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2 text-xs" /></label>
    <label className="block"><span className="mb-1 block text-xs font-bold">Link ou ID do Vimeo</span><input required value={form.vimeoUrl} onChange={(event) => setForm({ ...form, vimeoUrl: event.target.value })} className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2 text-xs" /></label>
    <label className="block"><span className="mb-1 block text-xs font-bold">Duração em minutos</span><input type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2 text-xs" /></label>
    <label className="flex items-end gap-2 pb-2 text-xs font-black"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publicar aula</label>
    {message && <p className="text-xs font-bold text-psi-deep sm:col-span-2">{message}</p>}
    <button className="rounded-xl bg-psi-deep px-4 py-2.5 text-xs font-black text-white sm:col-span-2">Adicionar aula Vimeo</button>
  </form>;
}
