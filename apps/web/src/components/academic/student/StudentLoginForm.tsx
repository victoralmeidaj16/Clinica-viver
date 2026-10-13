'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpenCheck, LockKeyhole, Mail } from 'lucide-react';

export function StudentLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await fetch('/api/academico/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível entrar.');
      router.replace(payload.data.destination);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'); }
    finally { setLoading(false); }
  }

  return <main className="relative grid min-h-screen overflow-hidden bg-[#f4eee7] lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden min-h-screen overflow-hidden bg-psi-darkest p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-28 top-12 h-96 w-96 rounded-full border border-white/10" />
      <div className="absolute -right-10 top-36 h-72 w-72 rounded-full bg-psi-vibrant/15 blur-3xl" />
      <Image src="/logo-viver-mais.png" alt="Viver Mais" width={170} height={58} className="relative h-auto w-40 brightness-0 invert" priority />
      <div className="relative max-w-xl pb-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold"><BookOpenCheck className="h-4 w-4 text-psi-vibrant" />Ambiente de aprendizagem</span>
        <h1 className="mt-7 font-[var(--font-display)] text-6xl leading-[.98] tracking-tight">Conhecimento que acompanha sua prática.</h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-white/60">Retome suas aulas, acompanhe sua evolução e mantenha seus dados em um espaço só seu.</p>
      </div>
      <p className="relative text-xs text-white/35">Viver Mais Psicologia · Formação contínua</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-md">
        <Image src="/logo-viver-mais.png" alt="Viver Mais" width={150} height={52} className="mb-10 h-auto w-36 lg:hidden" priority />
        <p className="text-[11px] font-black uppercase tracking-[.22em] text-psi-vibrant">Portal do Aluno</p>
        <h2 className="mt-3 font-[var(--font-display)] text-4xl font-semibold text-psi-darkest">Entre para continuar</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Acesse seus cursos e acompanhe cada etapa do seu aprendizado.</p>
        <form onSubmit={submit} className="mt-9 space-y-5">
          <Field icon={<Mail className="h-4 w-4" />} label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Field icon={<LockKeyhole className="h-4 w-4" />} label="Senha" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          {error && <p role="alert" className="rounded-xl bg-rose-100 px-4 py-3 text-sm font-bold text-rose-800">{error}</p>}
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-psi-deep px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-psi-deep/15 transition hover:bg-psi-darkest disabled:opacity-50">{loading ? 'Entrando…' : 'Entrar no portal'}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-8 border-t border-psi-darkest/10 pt-5 text-xs leading-5 text-muted">Seu primeiro acesso usa a senha temporária criada pela gestão. Você poderá definir uma nova senha em seguida.</p>
      </div>
    </section>
  </main>;
}

function Field({ icon, label, type, value, onChange, autoComplete }: { icon: React.ReactNode; label: string; type: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-black text-psi-darkest">{label}</span><span className="flex items-center gap-3 rounded-xl border border-psi-darkest/10 bg-white px-4 text-muted shadow-sm focus-within:border-psi-vibrant focus-within:ring-4 focus-within:ring-psi-vibrant/10">{icon}<input required type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-psi-darkest outline-none" /></span></label>;
}
