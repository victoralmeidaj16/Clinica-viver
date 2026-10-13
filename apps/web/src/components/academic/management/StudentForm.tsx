'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff, KeyRound, UserPlus } from 'lucide-react';

export function StudentForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', temporaryPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/academico/gestao/alunos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const payload = await response.json() as { ok?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Não foi possível criar o aluno.');
      setForm({ fullName: '', email: '', phone: '', temporaryPassword: '' });
      setMessage('Conta criada. Entregue a senha temporária ao aluno por um canal seguro.');
      onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-psi-soft bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-psi-deep text-white"><UserPlus className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-black text-psi-darkest">Novo aluno</h2><p className="text-xs leading-5 text-muted">Crie um acesso acadêmico independente.</p></div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} required />
        <Field label="E-mail do aluno" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
        <Field label="Telefone (opcional)" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        <label className="block"><span className="mb-1.5 block text-xs font-black text-psi-darkest">Senha temporária</span><span className="relative block"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input type={showPassword ? 'text' : 'password'} minLength={10} required value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} className="w-full rounded-xl border border-psi-soft bg-psi-light py-3 pl-10 pr-10 text-sm outline-none focus:border-psi-deep focus:ring-4 focus:ring-psi-soft" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Mostrar senha">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
      </div>
      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Use 10 caracteres, letra e número. O aluno fará a troca no primeiro acesso.</p>
      {message && <p role="status" className="mt-3 text-xs font-bold text-psi-deep">{message}</p>}
      <button disabled={busy} className="mt-5 rounded-xl bg-psi-deep px-5 py-3 text-xs font-black text-white transition hover:bg-psi-darkest disabled:opacity-50">{busy ? 'Criando…' : 'Criar conta de aluno'}</button>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-psi-darkest">{label}</span><input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-psi-soft bg-psi-light px-3 py-3 text-sm outline-none focus:border-psi-deep focus:ring-4 focus:ring-psi-soft" /></label>;
}
