'use client';

import { FormEvent, useState } from 'react';
import type { AcademicModule } from '@thats-life/core';
import { errorMessage, sendJson } from './managementRequest';

export function ModuleEditor({ courseId, nextPosition, module, onSaved, onCancel }: {
  courseId: string; nextPosition: number; module?: AcademicModule; onSaved: () => void; onCancel?: () => void;
}) {
  const [title, setTitle] = useState(module?.title ?? '');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      if (module) await sendJson(`/api/academico/gestao/modulos/${module.id}`, 'PATCH', { courseId, title, position: module.position });
      else await sendJson(`/api/academico/gestao/cursos/${courseId}/modulos`, 'POST', { title, position: nextPosition });
      if (!module) setTitle('');
      onSaved();
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <form onSubmit={submit} className="space-y-2">
    <div className="flex gap-2"><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome do novo módulo" className="min-w-0 flex-1 rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs outline-none" /><button className="rounded-xl bg-psi-darkest px-4 text-xs font-black text-white">{module ? 'Salvar módulo' : 'Adicionar módulo'}</button>{onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-psi-soft px-3 text-xs font-black text-psi-deep">Fechar</button>}</div>
    {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
  </form>;
}
