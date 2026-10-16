'use client';

import { FormEvent, useState } from 'react';
import type { AcademicCourse } from '@thats-life/core';
import { ConfirmPrompt } from './ConfirmButton';
import { errorMessage, sendJson } from './managementRequest';

export function CourseEditor({ course, onSaved }: { course?: AcademicCourse; onSaved: () => void }) {
  const [form, setForm] = useState(() => course ? {
    title: course.title,
    description: course.description,
    coverUrl: course.coverUrl ?? '',
    certificateTextModel: course.certificateTextModel ?? 'standard',
    certificateInstructor: course.certificateInstructor ?? '',
    certificateDurationHours: Math.floor((course.certificateDurationMinutes ?? 0) / 60),
    certificateDurationRemainingMinutes: (course.certificateDurationMinutes ?? 0) % 60,
    position: course.position,
    active: course.active,
    published: course.published,
  } : { title: '', description: '', coverUrl: '', certificateTextModel: 'standard' as const, certificateInstructor: '', certificateDurationHours: 0, certificateDurationRemainingMinutes: 0, position: 0, active: true, published: false });
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  async function save() {
    setMessage(''); setConfirming(false);
    try {
      const payload = { ...form, certificateDurationMinutes: form.certificateDurationHours * 60 + form.certificateDurationRemainingMinutes };
      if (course) await sendJson(`/api/academico/gestao/cursos/${course.id}`, 'PATCH', payload);
      else await sendJson('/api/academico/gestao/cursos', 'POST', payload);
      setMessage('Curso salvo.'); onSaved();
    } catch (cause) { setMessage(errorMessage(cause)); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    // Despublicar ou desativar retira o curso do portal de todos os matriculados.
    if (course && ((course.published && !form.published) || (course.active && !form.active))) return setConfirming(true);
    void save();
  }
  return <form onSubmit={submit} className="space-y-4 rounded-3xl border border-psi-soft bg-white p-5 shadow-soft">
    <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-psi-vibrant">Catálogo</p><h2 className="text-lg font-black text-psi-darkest">{course ? 'Editar curso' : 'Novo curso'}</h2></div>
    <Input label="Título" value={form.title} onChange={(title) => setForm({ ...form, title })} required />
    <label className="block"><span className="mb-1 block text-xs font-bold">Descrição</span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-xl border border-psi-soft bg-psi-light p-3 text-sm outline-none" /></label>
    <Input label="URL da capa (opcional)" value={form.coverUrl} onChange={(coverUrl) => setForm({ ...form, coverUrl })} />
    <label className="block"><span className="mb-1 block text-xs font-bold">Modelo do texto do certificado</span><select value={form.certificateTextModel} onChange={(event) => setForm({ ...form, certificateTextModel: event.target.value as 'standard' | 'online-course-with-instructor' })} className="w-full rounded-xl border border-psi-soft bg-psi-light px-3 py-2.5 text-sm outline-none"><option value="standard">Modelo padrão</option><option value="online-course-with-instructor">Curso online com professora e duração oficial</option></select></label>
    {form.certificateTextModel === 'online-course-with-instructor' && <div className="space-y-3 rounded-2xl border border-psi-vibrant/20 bg-psi-soft/40 p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-psi-vibrant">Texto exclusivo do certificado</p><Input label="Professora do certificado" value={form.certificateInstructor} onChange={(certificateInstructor) => setForm({ ...form, certificateInstructor })} required /><div className="grid grid-cols-2 gap-3"><Input label="Duração — horas" type="number" value={String(form.certificateDurationHours)} onChange={(value) => setForm({ ...form, certificateDurationHours: Math.max(0, Number(value)) })} /><Input label="Duração — minutos" type="number" value={String(form.certificateDurationRemainingMinutes)} onChange={(value) => setForm({ ...form, certificateDurationRemainingMinutes: Math.max(0, Math.min(59, Number(value))) })} /></div><p className="text-[11px] leading-5 text-muted">Aplicado somente a este curso. O certificado sai no layout padrão da Viver Mais Psicologia, sem usar arte de template.</p></div>}
    <Input label="Ordem" type="number" value={String(form.position)} onChange={(position) => setForm({ ...form, position: Number(position) })} />
    <div className="grid gap-2 sm:grid-cols-2"><Check label="Curso ativo" checked={form.active} onChange={(active) => setForm({ ...form, active })} /><Check label="Publicar no portal" checked={form.published} onChange={(published) => setForm({ ...form, published })} /></div>
    {message && <p role="status" className="text-xs font-bold text-psi-deep">{message}</p>}
    {confirming && <ConfirmPrompt message="O curso deixará de aparecer para todos os alunos matriculados. O progresso é mantido." onCancel={() => setConfirming(false)} onConfirm={() => void save()} />}
    <button className="rounded-xl bg-psi-deep px-5 py-3 text-xs font-black text-white">Salvar curso</button>
  </form>;
}

function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-psi-soft bg-psi-light px-3 py-2.5 text-sm outline-none" /></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 rounded-xl border border-psi-soft p-3 text-xs font-black"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-psi-deep" />{label}</label>; }
