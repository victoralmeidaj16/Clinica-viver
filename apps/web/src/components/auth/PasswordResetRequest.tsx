'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';

export function PasswordResetRequest() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/solicitar-redefinicao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Não foi possível solicitar o link. Tente novamente.');
      setMessage(payload.data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível solicitar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return <>
    <h1 className="mt-3 font-display text-4xl tracking-[-0.04em] sm:text-5xl">Esqueceu sua senha?</h1>
    <p className="mt-4 text-sm leading-6 text-white/60">Informe o e-mail usado no seu cadastro profissional para receber um link de recuperação.</p>
    {message ? <div className="mt-8 space-y-5">
      <p role="status" className="rounded-xl border border-white/20 bg-white/10 p-4 text-sm leading-6">{message}</p>
      <p className="text-xs leading-5 text-white/60">O link vale por duas horas. Se precisar de outro, aguarde ao menos um minuto antes de solicitar novamente.</p>
      <button type="button" onClick={() => setMessage('')} className="text-sm font-bold text-[#c38cff] hover:underline">Solicitar outro link ou corrigir e-mail</button>
    </div> : <form onSubmit={submit} className="mt-9 space-y-5">
      <label className="block"><span className="mb-2 block text-xs font-bold text-white/75">E-mail profissional</span>
        <input className="w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3.5 text-sm text-white outline-none focus:border-[#c38cff]" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" />
      </label>
      {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100">{error}</p>}
      <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c38cff] px-5 py-4 text-sm font-black text-[#21152d] transition hover:bg-white disabled:opacity-50">{loading ? 'Solicitando link…' : 'Enviar link de recuperação'}<ArrowRight className="h-4 w-4" /></button>
    </form>}
  </>;
}
