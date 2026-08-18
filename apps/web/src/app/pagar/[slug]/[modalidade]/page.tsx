'use client';

import { use, useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, CreditCard, FileText, Loader2, UserRound } from 'lucide-react';
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

  const aviso = (mensagem: string) => (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">
      {mensagem}
    </div>
  );

  if (!validModality) return aviso('Link de pagamento inválido.');
  if (loading && !profile) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-psi-vibrant" /></div>;
  }
  if (!profile) return aviso(error || 'Link de pagamento inválido.');

  const kind = modalidade as ModalidadePagamentoSlug;
  const amount = profile.modalities[kind];

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

      {!payment ? (
        <form onSubmit={generate} className="card space-y-5">
          <div>
            <h3 className="font-black text-ink flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-psi-vibrant" />
              Pagamento da consulta
            </h3>
            <p className="text-xs text-muted mt-1">
              Identifique seu cadastro pelo CPF para gerar o pagamento.
            </p>
          </div>

          {/* O valor é informado, não escolhido: quem decidiu foi o link. */}
          <div className="rounded-2xl border border-psi-vibrant/30 bg-psi-soft/70 p-4">
            <p className="text-[11px] text-psi-deep font-bold uppercase tracking-wider">{labels[kind]}</p>
            <p className="text-2xl text-ink font-black">{reaisDeCentavos(amount)}</p>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <label className="text-xs font-bold text-ink block">
            CPF do paciente
            <div className="relative mt-1">
              <FileText className="absolute left-3 top-3.5 w-4 h-4 text-muted" />
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="input pl-10"
              />
            </div>
          </label>

          <button type="submit" disabled={loading} className="btn-accent w-full py-4 text-sm">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>Gerar pagamento <ArrowRight className="w-5 h-5" /></>
            )}
          </button>

          <p className="text-[11px] text-muted text-center">
            Não é necessário possuir consulta agendada. O CPF é usado para localizar seu cadastro
            com o psicólogo.
          </p>
        </form>
      ) : (
        <section className="card text-center space-y-5">
          <div className="chip-accent text-xs">
            <Check className="w-4 h-4" />
            Cobrança gerada
          </div>

          <p className="text-3xl text-ink font-black">
            {reaisDeCentavos(Math.round((payment.valor ?? amount / 100) * 100))}
          </p>

          {payment.pixQrCode && (
            <div className="inline-block rounded-3xl bg-white p-4 border border-line shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment.pixQrCode} alt="QR Code Pix" className="w-48 h-48" />
            </div>
          )}

          {payment.pixCopiaECola && (
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(payment.pixCopiaECola!); setCopied(true); }}
              className="btn-accent w-full py-3 text-sm"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Código copiado' : 'Copiar código Pix'}
            </button>
          )}

          {payment.invoiceUrl && (
            <a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="btn-outline w-full py-3 text-sm">
              Abrir opções de pagamento
            </a>
          )}
        </section>
      )}
    </div>
  );
}
