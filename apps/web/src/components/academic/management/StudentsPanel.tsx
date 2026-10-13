'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import type { AcademicStudent } from '@thats-life/core';
import { StudentForm } from './StudentForm';
import { ConfirmButton } from './ConfirmButton';
import { errorMessage, sendJson } from './managementRequest';

export function StudentsPanel() {
  const [students, setStudents] = useState<AcademicStudent[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/academico/gestao/alunos', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Falha ao carregar alunos.');
      setStudents(payload.data ?? []); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar alunos.'); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/academico/gestao/alunos', { cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok) setError(payload.error?.message ?? 'Falha ao carregar alunos.');
        else { setStudents(payload.data ?? []); setError(''); }
      })
      .catch(() => { if (!cancelled) setError('Falha ao carregar alunos.'); });
    return () => { cancelled = true; };
  }, []);

  async function toggle(student: AcademicStudent) {
    try {
      await sendJson(`/api/academico/gestao/alunos/${student.id}`, 'PATCH', { ...student, status: student.status === 'active' ? 'disabled' : 'active' });
      await load();
    } catch (cause) { setError(errorMessage(cause)); }
  }

  async function resetPassword(student: AcademicStudent) {
    const temporaryPassword = window.prompt(`Nova senha temporária para ${student.fullName}:`);
    if (!temporaryPassword) return;
    const response = await fetch(`/api/academico/gestao/alunos/${student.id}/senha`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ temporaryPassword }),
    });
    if (!response.ok) setError(((await response.json()).error?.message) ?? 'Falha ao redefinir senha.');
  }

  const visible = students.filter((student) => `${student.fullName} ${student.email}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
    <section className="min-w-0 rounded-3xl border border-psi-soft bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-psi-darkest">Alunos cadastrados</h2><p className="text-xs text-muted">{students.length} contas acadêmicas</p></div><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno" className="w-full rounded-xl border border-psi-soft bg-psi-light py-2.5 pl-9 pr-3 text-xs outline-none sm:w-60" /></label></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      <div className="mt-5 space-y-2">{visible.length === 0 ? <p className="rounded-2xl border border-dashed border-psi-soft p-8 text-center text-sm text-muted">Nenhum aluno encontrado.</p> : visible.map((student) => <article key={student.id} className="flex flex-col gap-3 rounded-2xl border border-psi-soft/80 bg-psi-light/60 p-4 sm:flex-row sm:items-center">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black ${student.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{student.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-psi-darkest">{student.fullName}</h3><p className="truncate text-xs text-muted">{student.email}</p></div>
        <span className="text-[10px] font-black uppercase tracking-wider text-muted">{student.mustChangePassword ? 'Troca pendente' : 'Senha definida'}</span>
        <button onClick={() => void resetPassword(student)} className="rounded-xl border border-psi-soft p-2 text-psi-deep" title="Redefinir senha"><KeyRound className="h-4 w-4" /></button>
        {student.status === 'active'
          ? <ConfirmButton message={`Desativar ${student.fullName}? O acesso ao portal é bloqueado na hora; o histórico é mantido.`} onConfirm={() => void toggle(student)} className="rounded-xl border border-psi-soft p-2 text-psi-deep" title="Desativar"><ShieldOff className="h-4 w-4" /></ConfirmButton>
          : <button onClick={() => void toggle(student)} className="rounded-xl border border-psi-soft p-2 text-psi-deep" title="Ativar"><ShieldCheck className="h-4 w-4" /></button>}
      </article>)}</div>
    </section>
    <StudentForm onSaved={() => void load()} />
  </div>;
}
