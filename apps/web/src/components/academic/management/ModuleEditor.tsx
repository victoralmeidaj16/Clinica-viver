'use client';

import { FormEvent, useState } from 'react';

export function ModuleEditor({ courseId, nextPosition, onSaved }: { courseId: string; nextPosition: number; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/academico/gestao/cursos/${courseId}/modulos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, position: nextPosition }) });
    if (response.ok) { setTitle(''); onSaved(); }
  }
  return <form onSubmit={submit} className="flex gap-2"><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome do novo módulo" className="min-w-0 flex-1 rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs outline-none" /><button className="rounded-xl bg-psi-darkest px-4 text-xs font-black text-white">Adicionar módulo</button></form>;
}
