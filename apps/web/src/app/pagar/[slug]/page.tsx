'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ArrowRight, Loader2, UserRound } from 'lucide-react';
import { reaisDeCentavos, type ModalidadePagamentoSlug } from '@/lib/modalidadesPagamento';

interface Profile {
  professionalName: string;
  modalities: Record<ModalidadePagamentoSlug, number>;
}

const rotulos = { social: 'Sessão Social', particular: 'Sessão Particular' } as const;

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

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-psi-vibrant" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-psi-soft flex items-center justify-center shrink-0">
          <UserRound className="w-8 h-8 text-psi-deep" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-psi-vibrant font-black">
            Profissional habilitado
          </p>
          <h2 className="text-xl text-ink font-black">{profile.professionalName}</h2>
          <p className="text-xs text-muted">Clínica Viver Mais Psicologia</p>
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h3 className="font-black text-ink">Qual sessão você vai pagar?</h3>
          <p className="text-xs text-muted">Confirme o valor combinado com seu psicólogo.</p>
        </div>

        {(['social', 'particular'] as const).map((kind) => (
          <Link
            key={kind}
            href={`/pagar/${slug}/${kind}`}
            className="flex justify-between items-center gap-4 rounded-2xl border border-line bg-soft/40 p-4 transition-all hover:border-psi-vibrant hover:bg-psi-soft/60"
          >
            <div>
              <p className="text-[11px] text-psi-deep font-bold uppercase tracking-wider">
                {rotulos[kind]}
              </p>
              <p className="text-lg text-ink font-black">
                {reaisDeCentavos(profile.modalities[kind])}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-psi-vibrant shrink-0" />
          </Link>
        ))}
      </section>
    </div>
  );
}
