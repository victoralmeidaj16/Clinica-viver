'use client';

import { FormEvent, useState } from 'react';
import type { AcademicCourse } from '@thats-life/core';

export function CourseEditor({ course, onSaved }: { course?: AcademicCourse; onSaved: () => void }) {
  const [form, setForm] = useState(() => course ? {
    title: course.title,
    description: course.description,
    coverUrl: course.coverUrl ?? '',
    position: course.position,
    active: course.active,
    published: course.published,
  } : { title: '', description: '', coverUrl: '', position: 0, active: true, published: false });
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch(course ? `/api/academico/gestao/cursos/${course.id}` : '/api/academico/gestao/cursos', {
      method: course ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.message ?? 'Falha ao salvar curso.');
    setMessage('Curso salvo.'); onSaved();
  }
  return <form onSubmit={submit} className="space-y-4 rounded-3xl border border-psi-soft bg-white p-5 shadow-soft">
    <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-psi-vibrant">Catálogo</p><h2 className="text-lg font-black text-psi-darkest">{course ? 'Editar curso' : 'Novo curso'}</h2></div>
    <Input label="Título" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
    <label className="block"><span className="mb-1 block text-xs font-bold">Descrição</span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-xl border border-psi-soft bg-psi-light p-3 text-sm outline-none" /></label>
    <Input label="URL da capa (opcional)" value={form.coverUrl} onChange={(coverUrl) => setForm({ ...form, coverUrl })} />
    <Input label="Ordem" type="number" value={String(form.position)} onChange={(position) => setForm({ ...form, position: Number(position) })} />
    <div className="grid gap-2 sm:grid-cols-2"><Check label="Curso ativo" checked={form.active} onChange={(active) => setForm({ ...form, active })} /><Check label="Publicar no portal" checked={form.published} onChange={(published) => setForm({ ...form, published })} /></div>
    {message && <p className="text-xs font-bold text-psi-deep">{message}</p>}
    <button className="rounded-xl bg-psi-deep px-5 py-3 text-xs font-black text-white">Salvar curso</button>
  </form>;
}

function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-psi-soft bg-psi-light px-3 py-2.5 text-sm outline-none" /></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 rounded-xl border border-psi-soft p-3 text-xs font-black"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-psi-deep" />{label}</label>; }
