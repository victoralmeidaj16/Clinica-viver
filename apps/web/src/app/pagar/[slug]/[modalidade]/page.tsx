'use client';

import { use, useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, CreditCard, FileText, Loader2, User } from 'lucide-react';
import { reaisDeCentavos, type ModalidadePagamentoSlug } from '@/lib/modalidadesPagamento';

interface Props { params: Promise<{ slug: string; modalidade: string }> }
interface Profile { professionalName: string; modalities: Record<ModalidadePagamentoSlug, number> }
interface Payment { pixQrCode?: string; pixCopiaECola?: string; invoiceUrl?: string; valor?: number }

const labels = { social: 'Sessão Social', particular: 'Sessão Particular' } as const;

export default function PaymentPage({ params }: Props) {
  const { slug, modalidade } = use(params);
  const validModality = modalidade === 'social' || modalidade === 'particular';
  const [profile, setProfile] = useState<Profile>();
  const [cpf, setCpf] = useState('');
  const [payment, setPayment] = useState<Payment>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!validModality) return;
    fetch(`/api/pagamento/perfil/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Link de pagamento inválido.');
        setProfile(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Link de pagamento inválido.'))
      .finally(() => setLoading(false));
  }, [slug, validModality]);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(undefined);
    try {
      const response = await fetch('/api/pagamento/gerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psicologoId: slug, modalidade, pacienteCpf: cpf }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível gerar a cobrança.');
      setPayment(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar a cobrança.');
    } finally { setLoading(false); }
  };

  if (!validModality) return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">Link de pagamento inválido.</div>;
  if (loading && !profile) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-400" /></div>;
  if (!profile || !validModality) return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error || 'Link de pagamento inválido.'}</div>;
  const kind = modalidade as ModalidadePagamentoSlug;
  const amount = profile.modalities[kind];

  return <div className="space-y-6">
    <section className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center"><User className="w-8 h-8 text-emerald-400" /></div>
      <div><p className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">Profissional habilitado</p><h1 className="text-xl text-white font-black">{profile.professionalName}</h1><p className="text-xs text-slate-400">Clínica Viver Mais</p></div>
    </section>

    {!payment ? <form onSubmit={generate} className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 space-y-5">
      <div><h2 className="font-black text-white flex gap-2"><CreditCard className="w-5 h-5 text-emerald-400" /> Pagamento da consulta</h2><p className="text-xs text-slate-400 mt-1">Identifique a sessão pendente pelo CPF do paciente.</p></div>
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4"><p className="text-xs text-emerald-400 font-bold">{labels[kind]}</p><p className="text-2xl text-white font-black">{reaisDeCentavos(amount)}</p></div>
      {error && <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300">{error}</div>}
      <label className="text-xs font-bold text-slate-300 block">CPF do paciente
        <div className="relative mt-1"><FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input required inputMode="numeric" autoComplete="off" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full rounded-2xl bg-slate-900 border border-slate-700 py-2.5 pl-10 pr-4 text-white" /></div>
      </label>
      <button disabled={loading} className="w-full rounded-2xl bg-emerald-500 p-4 text-sm font-black text-slate-950 flex justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Gerar pagamento <ArrowRight className="w-5 h-5" /></>}</button>
      <p className="text-[11px] text-slate-500 text-center">O CPF é usado apenas para localizar a cobrança já registrada e identificar o pagamento.</p>
    </form> : <section className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 text-center space-y-5">
      <div className="inline-flex gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400"><Check className="w-4 h-4" /> Cobrança gerada</div>
      <p className="text-3xl text-white font-black">{reaisDeCentavos(Math.round((payment.valor ?? amount / 100) * 100))}</p>
      {payment.pixQrCode && <div className="inline-block rounded-3xl bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={payment.pixQrCode} alt="QR Code Pix" className="w-48 h-48" />
      </div>}
      {payment.pixCopiaECola && <button onClick={() => { void navigator.clipboard.writeText(payment.pixCopiaECola!); setCopied(true); }} className="w-full rounded-2xl bg-emerald-500 p-3 text-sm font-black text-slate-950 flex justify-center gap-2">{copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />} {copied ? 'Código copiado' : 'Copiar código Pix'}</button>}
      {payment.invoiceUrl && <a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="block w-full rounded-2xl border border-slate-600 p-3 text-sm font-bold text-white">Abrir opções de pagamento</a>}
    </section>}
  </div>;
}
