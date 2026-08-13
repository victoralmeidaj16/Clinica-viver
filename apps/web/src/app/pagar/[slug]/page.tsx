'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ArrowRight, Loader2, User } from 'lucide-react';
import { reaisDeCentavos, type ModalidadePagamentoSlug } from '@/lib/modalidadesPagamento';

interface Profile {
  professionalName: string;
  modalities: Record<ModalidadePagamentoSlug, number>;
}

export default function ChoosePayment({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    fetch(`/api/pagamento/perfil/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Link de pagamento inválido.');
        setProfile(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Link inválido.'));
  }, [slug]);
  if (error) return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>;
  if (!profile) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-400" /></div>;
  return <div className="space-y-6">
    <section className="bg-slate-800 border border-slate-700 rounded-3xl p-6 flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center"><User className="w-8 h-8 text-emerald-400" /></div>
      <div><p className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">Profissional habilitado</p><h1 className="text-xl text-white font-black">{profile.professionalName}</h1></div>
    </section>
    <section className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 space-y-4">
      <div><h2 className="font-black text-white">Qual sessão você vai pagar?</h2><p className="text-xs text-slate-400">Confirme o valor combinado com seu psicólogo.</p></div>
      {(['social', 'particular'] as const).map((kind) => <Link key={kind} href={`/pagar/${slug}/${kind}`} className="flex justify-between items-center rounded-2xl border border-slate-700 bg-slate-900/50 p-4 hover:border-emerald-500">
        <div><p className="text-xs text-emerald-400 font-bold">{kind === 'social' ? 'Sessão Social' : 'Sessão Particular'}</p><p className="text-lg text-white font-black">{reaisDeCentavos(profile.modalities[kind])}</p></div><ArrowRight className="w-5 h-5 text-emerald-400" />
      </Link>)}
    </section>
  </div>;
}
