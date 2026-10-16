'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export function CadastroExistenteNotice({ email }: { email: string }) {
  const notice = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { notice.current?.focus(); }, []);

  async function recuperar() {
    if (loading || message) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/solicitar-redefinicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Não foi possível solicitar o link. Tente novamente.');
      setMessage(payload.data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível solicitar o link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section ref={notice} tabIndex={-1} aria-label="Cadastro existente" className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-950">
      <p role="alert" className="font-bold">Já existe um cadastro com este e-mail ou WhatsApp.</p>
      <p>Se o cadastro é seu e você esqueceu a senha, recupere seu acesso. Não é necessário fazer outro cadastro.</p>
      <p className="text-xs">O link será solicitado para o e-mail que você informou. Se o cadastro ainda está em análise, você não criou sua senha ou precisa corrigir os contatos, fale com a gestão.</p>
      {message ? <p role="status">{message}</p> : <button
        type="button"
        onClick={() => void recuperar()}
        disabled={loading}
        className="rounded-xl bg-purple-700 px-4 py-3 font-bold text-white hover:bg-purple-800 disabled:opacity-60"
      >{loading ? 'Solicitando link…' : 'Recuperar acesso por e-mail'}</button>}
      {error && <p role="alert" className="text-rose-800">{error}</p>}
      <Link href="/login" className="block font-bold underline">Já sei minha senha — entrar</Link>
    </section>
  );
}
