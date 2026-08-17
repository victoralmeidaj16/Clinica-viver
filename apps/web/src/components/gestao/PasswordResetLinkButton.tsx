'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';

export function PasswordResetLinkButton() {
  const [loading, setLoading] = useState(false);

  async function generate() {
    const email = window.prompt('E-mail do psicólogo que receberá o link de redefinição:');
    if (!email?.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/application/gestao/redefinicao-senha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const body = await response.json() as { success: boolean; data?: { url: string }; error?: string };
      if (!response.ok || !body.success || !body.data?.url) throw new Error(body.error ?? 'Não foi possível gerar o link.');
      await navigator.clipboard?.writeText(body.data.url);
      window.prompt('Link gerado (válido por 2 horas). Copie e envie ao psicólogo:', body.data.url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível gerar o link.');
    } finally {
      setLoading(false);
    }
  }

  return <button onClick={() => void generate()} disabled={loading} className="flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs font-extrabold text-purple-900 transition hover:bg-purple-100 disabled:opacity-50"><KeyRound className="h-4 w-4 text-purple-600" />{loading ? 'Gerando link…' : 'Redefinir senha'}</button>;
}
