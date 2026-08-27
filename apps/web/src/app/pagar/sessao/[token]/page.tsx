'use client';

import { use, useEffect, useState } from 'react';
import {
  ArrowRight, CalendarClock, Check, Copy, CreditCard, FileText, Loader2, QrCode,
} from 'lucide-react';
import { reaisDeCentavos } from '@/lib/modalidadesPagamento';
import { dataHoraSessao } from '@/lib/sessionReference';

interface Profile {
  professionalName: string;
  sessionStart: string;
  amountCents: number;
  modality: 'social' | 'particular';
  fundedByCompany: boolean;
  companyName?: string;
  dueAt: string;
}

interface Payment {
  pacienteNome: string;
  sessaoInicio: string;
  valor?: number;
  pixQrCode?: string;
  pixCopiaECola?: string;
  invoiceUrl?: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  provider: 'inter' | 'asaas';
}

export default function SessionPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [profile, setProfile] = useState<Profile>();
  const [cpf, setCpf] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [payment, setPayment] = useState<Payment>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/pagamento/sessao/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Link de pagamento inválido.');
        setProfile(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Link inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch('/api/pagamento/sessao/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf, paymentMethod }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível gerar a cobrança.');
      setPayment(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar a cobrança.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-psi-vibrant" /></div>;
  }
  if (!profile) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">{error || 'Link inválido.'}</div>;
  }

  if (profile.fundedByCompany) {
    return (
      <div className="space-y-5">
        <section className="card-contrast overflow-hidden rounded-3xl p-6 text-white">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-psi-vibrant">Sessão sem cobrança individual</p>
          <h1 className="mt-2 text-xl font-black">{profile.professionalName}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-psi-soft">
            <CalendarClock className="h-4 w-4" /> {dataHoraSessao(profile.sessionStart)}
          </p>
        </section>
        <section className="card space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-black text-ink">Não há nada a pagar</h2>
          <p className="text-sm text-muted">
            Esta sessão é custeada por {profile.companyName ?? 'sua empresa'}. A clínica fará o faturamento diretamente com ela.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="card-contrast overflow-hidden rounded-3xl p-6 text-white">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-psi-vibrant">Cobrança vinculada à sessão</p>
        <h1 className="mt-2 text-xl font-black">{profile.professionalName}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-psi-soft">
          <CalendarClock className="h-4 w-4" /> {dataHoraSessao(profile.sessionStart)}
        </p>
        <p className="mt-1 text-2xl font-black">{reaisDeCentavos(profile.amountCents)}</p>
        <p className="mt-2 text-xs font-semibold text-psi-soft">Pagamento disponível até {dataHoraSessao(profile.dueAt)}</p>
      </section>

      {!payment ? (
        <form onSubmit={generate} className="card space-y-5">
          <div>
            <h2 className="flex items-center gap-2 font-black text-ink"><CreditCard className="h-5 w-5 text-psi-vibrant" /> Pagamento desta sessão</h2>
            <p className="mt-1 text-xs text-muted">Escolha a forma de pagamento e confirme o CPF do paciente.</p>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-bold text-ink">Forma de pagamento</legend>
            <button
              type="button"
              aria-pressed={paymentMethod === 'PIX'}
              onClick={() => setPaymentMethod('PIX')}
              className={`rounded-2xl border p-4 text-left transition ${paymentMethod === 'PIX' ? 'border-psi-vibrant bg-psi-soft/20 ring-2 ring-psi-vibrant/20' : 'border-line bg-white'}`}
            >
              <span className="flex items-center gap-2 font-black text-ink"><QrCode className="h-5 w-5 text-psi-vibrant" /> Pix</span>
              <span className="mt-1 block text-xs text-muted">QR Code e Pix Copia e Cola pelo Banco Inter.</span>
            </button>
            <button
              type="button"
              aria-pressed={paymentMethod === 'CREDIT_CARD'}
              onClick={() => setPaymentMethod('CREDIT_CARD')}
              className={`rounded-2xl border p-4 text-left transition ${paymentMethod === 'CREDIT_CARD' ? 'border-psi-vibrant bg-psi-soft/20 ring-2 ring-psi-vibrant/20' : 'border-line bg-white'}`}
            >
              <span className="flex items-center gap-2 font-black text-ink"><CreditCard className="h-5 w-5 text-psi-vibrant" /> Cartão de crédito</span>
              <span className="mt-1 block text-xs text-muted">Pagamento seguro processado pelo Asaas.</span>
            </button>
          </fieldset>
          {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
          <label className="block text-xs font-bold text-ink">
            CPF do paciente
            <span className="relative mt-1 block">
              <FileText className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
              <input required inputMode="numeric" autoComplete="off" value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" className="input pl-10" />
            </span>
          </label>
          <button type="submit" disabled={loading} className="btn-accent w-full py-4 text-sm">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{paymentMethod === 'PIX' ? 'Gerar Pix' : 'Continuar com cartão'} <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
      ) : (
        <section className="card space-y-5 text-center">
          <div className="chip-accent text-xs"><Check className="h-4 w-4" /> Cobrança de {payment.pacienteNome}</div>
          <p className="text-3xl font-black text-ink">{reaisDeCentavos(Math.round((payment.valor ?? profile.amountCents / 100) * 100))}</p>
          <p className="text-xs font-bold text-muted">
            {payment.provider === 'inter' ? 'Pix Cobrança emitido pelo Banco Inter' : 'Cartão de crédito processado pelo Asaas'}
          </p>
          {payment.pixQrCode && (
            <div className="inline-block rounded-3xl border border-line bg-white p-4 shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment.pixQrCode} alt="QR Code Pix" className="h-48 w-48" />
            </div>
          )}
          {payment.pixCopiaECola && (
            <button type="button" onClick={() => { void navigator.clipboard.writeText(payment.pixCopiaECola!); setCopied(true); }} className="btn-accent w-full py-3 text-sm">
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}{copied ? 'Código copiado' : 'Copiar código Pix'}
            </button>
          )}
          {payment.invoiceUrl && <a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="btn-accent w-full py-3 text-sm">Pagar com cartão no Asaas <ArrowRight className="h-5 w-5" /></a>}
        </section>
      )}
    </div>
  );
}
