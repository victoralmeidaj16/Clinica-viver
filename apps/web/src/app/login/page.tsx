'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Brain, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Não foi possível entrar.');
      const me = await fetch('/api/auth/me', { cache: 'no-store' }).then((result) => result.json()) as { data: { role: 'admin' | 'psicologo' } };
      router.replace(me.data.role === 'admin' ? '/gestao/cockpit' : '/cockpit');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page min-h-screen overflow-hidden bg-[#21152d] text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden px-12 py-14 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-24 top-24 h-96 w-96 rounded-full bg-[#a779e8]/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[32rem] w-[32rem] rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c38cff] text-[#21152d]"><Brain className="h-6 w-6" /></div>
            <div><p className="font-black tracking-tight">Viver Mais <span className="rounded bg-[#c38cff] px-1.5 py-0.5 text-[#21152d]">Psi</span></p><p className="text-xs text-white/50">Clínica & cuidado contínuo</p></div>
          </div>
          <div className="relative max-w-xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-[#c38cff]">Acesso seguro à clínica</p>
            <h1 className="font-display text-6xl leading-[0.95] tracking-[-0.04em]">Cada cuidado no lugar certo.</h1>
            <p className="mt-7 max-w-md text-base leading-7 text-white/60">Um espaço reservado para gestão e psicólogos trabalharem com clareza, sigilo e continuidade.</p>
          </div>
          <div className="relative flex items-center gap-3 text-xs text-white/50"><ShieldCheck className="h-4 w-4 text-[#c38cff]" /> Sessão protegida • CFP & LGPD</div>
        </section>
        <section className="flex items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="mb-9 lg:hidden"><p className="font-black">Viver Mais <span className="rounded bg-[#c38cff] px-1.5 py-0.5 text-[#21152d]">Psi</span></p></div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c38cff]">Bem-vindo de volta</p>
            <h2 className="mt-3 font-display text-4xl tracking-[-0.04em]">Entrar na clínica</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">Use suas credenciais profissionais para acessar seu espaço de trabalho.</p>
            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block"><span className="mb-2 block text-xs font-bold text-white/75">E-mail</span><div className="relative"><Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3.5 pl-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#c38cff]" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required autoComplete="email" /></div></label>
              <label className="block"><span className="mb-2 block text-xs font-bold text-white/75">Senha</span><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input className="w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3.5 pl-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#c38cff]" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required autoComplete="current-password" /></div></label>
              {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-xs font-semibold text-rose-100">{error}</p>}
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c38cff] px-5 py-3.5 text-sm font-black text-[#21152d] transition hover:bg-white disabled:cursor-wait disabled:opacity-60" disabled={loading}>{loading ? 'Validando…' : 'Entrar com segurança'}<ArrowRight className="h-4 w-4" /></button>
            </form>
            <p className="mt-8 text-center text-[11px] leading-5 text-white/35">O acesso é individual. Não compartilhe sua senha nem o conteúdo clínico.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
