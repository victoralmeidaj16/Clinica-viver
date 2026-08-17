'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function RedefinirSenhaPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#21152d]" />}><ResetForm /></Suspense>;
}

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) return setError('As duas senhas precisam ser iguais.');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/redefinir-senha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }),
      });
      const payload = await response.json() as { ok?: boolean; data?: { destination?: string }; error?: { message?: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Não foi possível redefinir a senha.');
      router.replace(payload.data?.destination ?? '/cockpit');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-[#21152d] px-6 py-12 text-white"><div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-5xl place-items-center"><section className="w-full max-w-2xl rounded-[2.25rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl sm:p-12"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c38cff] text-[#21152d]"><KeyRound className="h-6 w-6" /></div><p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-[#c38cff]">Acesso do psicólogo</p><h1 className="mt-3 font-display text-4xl tracking-[-0.04em] sm:text-5xl">Defina uma nova senha.</h1><p className="mt-4 text-sm leading-6 text-white/60">Este link é individual, vale por duas horas e pode ser usado uma única vez.</p><form onSubmit={submit} className="mt-9 space-y-5"><PasswordField label="Nova senha" value={password} onChange={setPassword} /><PasswordField label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} /><p className="text-xs text-white/55">Use ao menos 10 caracteres, incluindo letras e números.</p>{error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100">{error}</p>}<button disabled={loading || !token} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c38cff] px-5 py-4 text-sm font-black text-[#21152d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Salvando nova senha…' : 'Salvar senha e acessar'} <ArrowRight className="h-4 w-4" /></button></form><p className="mt-7 flex items-center gap-2 text-xs text-white/40"><ShieldCheck className="h-4 w-4" /> A senha é protegida e nunca é exibida à gestão.</p></section></div></main>;
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-white/75">{label}</span><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3.5 pl-11 text-sm text-white outline-none focus:border-[#c38cff]" type="password" value={value} onChange={(event) => onChange(event.target.value)} minLength={10} required autoComplete="new-password" /></div></label>;
}
