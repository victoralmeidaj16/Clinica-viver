'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';

export function ForcePasswordChange() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (password !== confirmation) return setError('As senhas precisam ser iguais.');
    setLoading(true);
    try {
      const response = await fetch('/api/academico/auth/trocar-senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível atualizar a senha.');
      router.replace(payload.data.destination); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a senha.'); }
    finally { setLoading(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f4eee7] p-5"><section className="w-full max-w-lg rounded-[2rem] border border-psi-darkest/10 bg-white p-7 shadow-xl shadow-psi-darkest/5 sm:p-10">
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-psi-soft text-psi-deep"><KeyRound className="h-6 w-6" /></span>
    <p className="mt-7 text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Primeiro acesso</p><h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold text-psi-darkest">Crie sua senha pessoal</h1>
    <p className="mt-3 text-sm leading-6 text-muted">Use pelo menos 10 caracteres, incluindo uma letra e um número. A senha temporária deixa de valer depois desta etapa.</p>
    <form onSubmit={submit} className="mt-7 space-y-4"><PasswordField label="Nova senha" value={password} onChange={setPassword} /><PasswordField label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} />
      {error && <p role="alert" className="rounded-xl bg-rose-100 p-3 text-sm font-bold text-rose-800">{error}</p>}
      <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-psi-deep px-5 py-3.5 text-sm font-black text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{loading ? 'Salvando…' : 'Definir senha e entrar'}</button>
    </form>
  </section></main>;
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1.5 block text-xs font-black text-psi-darkest">{label}</span><input required minLength={10} type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" className="input" /></label>; }
