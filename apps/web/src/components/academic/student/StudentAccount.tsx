'use client';

import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Save, UserRound } from 'lucide-react';

type EditableStudent = { fullName: string; email: string; phone?: string };

export function StudentAccount() {
  const [student, setStudent] = useState<EditableStudent | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/academico/aluno/perfil', { cache: 'no-store' }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível carregar sua conta.'); return payload.data; }).then((data) => { if (!cancelled) setStudent(data); }).catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <p className="rounded-2xl bg-rose-50 p-5 text-sm font-bold text-rose-800">{error}</p>;
  if (!student) return <div className="h-96 animate-pulse rounded-3xl bg-white/60" />;
  return <div className="space-y-7"><header><p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Preferências</p><h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold sm:text-5xl">Minha conta</h1><p className="mt-3 text-sm text-muted">Mantenha seus dados de contato atualizados.</p></header><div className="grid gap-6 lg:grid-cols-2"><StudentAccountForm student={student} /><PasswordForm /></div></div>;
}

export function StudentAccountForm({ student }: { student: EditableStudent }) {
  const [fullName, setFullName] = useState(student.fullName);
  const [phone, setPhone] = useState(student.phone ?? '');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch('/api/academico/aluno/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName, phone }) });
    const payload = await response.json(); setMessage(response.ok ? 'Dados atualizados.' : payload.error?.message ?? 'Falha ao salvar.');
  }
  return <form onSubmit={submit} className="rounded-3xl border border-psi-darkest/10 bg-white p-6 sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-psi-soft text-psi-deep"><UserRound className="h-5 w-5" /></span><h2 className="mt-5 text-lg font-black">Dados pessoais</h2><div className="mt-5 space-y-4"><Field label="Nome completo" value={fullName} onChange={setFullName} /><Field label="E-mail de acesso" value={student.email} disabled /><Field label="Telefone" value={phone} onChange={setPhone} /></div>{message && <p className="mt-4 text-xs font-bold text-psi-deep">{message}</p>}<button className="mt-5 flex items-center gap-2 rounded-xl bg-psi-deep px-5 py-3 text-xs font-black text-white"><Save className="h-4 w-4" />Salvar dados</button></form>;
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [message, setMessage] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(''); if (password !== confirmation) return setMessage('As senhas precisam ser iguais.'); const response = await fetch('/api/academico/auth/trocar-senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, password }) }); const payload = await response.json(); setMessage(response.ok ? 'Senha atualizada.' : payload.error?.message ?? 'Falha ao atualizar senha.'); if (response.ok) { setCurrentPassword(''); setPassword(''); setConfirmation(''); } }
  return <form onSubmit={submit} className="rounded-3xl border border-psi-darkest/10 bg-psi-darkest p-6 text-white sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-psi-vibrant"><KeyRound className="h-5 w-5" /></span><h2 className="mt-5 text-lg font-black">Alterar senha</h2><p className="mt-2 text-xs leading-5 text-white/50">Use no mínimo 10 caracteres, com letra e número.</p><div className="mt-5 space-y-4"><DarkField label="Senha atual" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><DarkField label="Nova senha" value={password} onChange={setPassword} /><DarkField label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} /></div>{message && <p className="mt-4 text-xs font-bold text-psi-vibrant">{message}</p>}<button className="mt-5 rounded-xl bg-white px-5 py-3 text-xs font-black text-psi-darkest">Atualizar senha</button></form>;
}

function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange?: (value: string) => void; disabled?: boolean }) { return <label className="block"><span className="mb-1.5 block text-xs font-black">{label}</span><input required={!disabled} disabled={disabled} value={value} onChange={(event) => onChange?.(event.target.value)} className="input disabled:bg-psi-light disabled:text-muted" /></label>; }
function DarkField({ label, value, onChange, autoComplete = 'new-password' }: { label: string; value: string; onChange: (value: string) => void; autoComplete?: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-black">{label}</span><input required minLength={10} type="password" autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-psi-vibrant" /></label>; }
