'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, CreditCard, Loader2, QrCode } from 'lucide-react';
import { sessionBatchPaymentRule, sessionPaymentMonth } from '@/lib/sessionBatchPayment';
import { reaisDeCentavos } from '@/lib/modalidadesPagamento';

interface Session { inicio: string; linkPagamento: string; }
interface PaymentResult { valor: number; descontoCentavos?: number; subtotalCentavos?: number; pixQrCode?: string; pixCopiaECola?: string; invoiceUrl?: string; }

const label = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
}).format(new Date(value));

const tokenFromLink = (link: string) => link.split('/').filter(Boolean).at(-1) ?? '';

export function BookedSessionsPayment({ sessions, cpf }: { sessions: readonly Session[]; cpf: string }) {
  const [selected, setSelected] = useState(() => new Set(sessions.filter((session) => sessionPaymentMonth(session.inicio) === sessionPaymentMonth(new Date())).map((session) => session.linkPagamento)));
  const [method, setMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [payment, setPayment] = useState<PaymentResult>();
  const [copied, setCopied] = useState(false);
  const selectedSessions = useMemo(() => sessions.filter((session) => selected.has(session.linkPagamento)), [selected, sessions]);

  const rule = sessionBatchPaymentRule(selectedSessions.map((session) => session.inicio));

  const toggle = (link: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(link)) next.delete(link); else next.add(link);
    return next;
  });

  const pay = async () => {
    if (!selectedSessions.length || rule.error) return;
    setLoading(true); setError(undefined);
    try {
      const grouped = selectedSessions.length > 1;
      const response = await fetch(grouped ? '/api/pagamento/sessoes/gerar' : '/api/pagamento/sessao/gerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grouped
          ? { tokens: selectedSessions.map((session) => tokenFromLink(session.linkPagamento)), cpf, paymentMethod: method }
          : { token: tokenFromLink(selectedSessions[0].linkPagamento), cpf, paymentMethod: method }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível gerar o pagamento.');
      setPayment(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o pagamento.');
    } finally { setLoading(false); }
  };

  if (payment) return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="font-black text-emerald-950">{selectedSessions.length > 1 ? `Pagamento agrupado de ${selectedSessions.length} sessões` : 'Pagamento da sessão selecionada'}</p>
      {!!payment.descontoCentavos && <p className="text-sm text-emerald-900">Subtotal: {reaisDeCentavos(payment.subtotalCentavos!)} · Desconto de 10%: −{reaisDeCentavos(payment.descontoCentavos)}</p>}
      <p className="text-2xl font-black text-ink">{reaisDeCentavos(Math.round(payment.valor * 100))}</p>
      {payment.pixQrCode && <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-sm"><Image src={payment.pixQrCode} alt="QR Code Pix" width={176} height={176} unoptimized /></div>}
      {payment.pixCopiaECola && <button type="button" onClick={() => { void navigator.clipboard.writeText(payment.pixCopiaECola!); setCopied(true); }} className="btn-accent w-full py-3 text-xs">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Código copiado' : 'Copiar Pix Copia e Cola'}
      </button>}
      {payment.invoiceUrl && <a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="btn-accent w-full py-3 text-xs">Pagar todas no cartão <CreditCard className="h-4 w-4" /></a>}
    </div>
  );

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-black text-ink">Quais sessões deseja pagar agora?</p><p className="text-[10px] text-muted">Pague 4 ou mais sessões do mês vigente juntas, em 1x, e ganhe 10% de desconto.</p></div>
        <button type="button" onClick={() => setSelected(new Set(sessions.filter((item) => sessionPaymentMonth(item.inicio) === sessionPaymentMonth(new Date())).map((item) => item.linkPagamento)))} className="text-[10px] font-black text-psi-deep hover:underline">Selecionar mês vigente</button>
      </div>
      <div className="space-y-2">
        {sessions.map((session) => {
          const active = selected.has(session.linkPagamento);
          return <button key={session.linkPagamento} type="button" onClick={() => toggle(session.linkPagamento)} aria-pressed={active}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${active ? 'border-psi-vibrant bg-psi-light text-psi-deep' : 'border-line bg-white text-muted'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${active ? 'border-psi-vibrant bg-psi-vibrant text-white' : 'border-line'}`}>{active && <Check className="h-3 w-3" />}</span>
            <span className="capitalize">{label(session.inicio)}</span>
          </button>;
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMethod('PIX')} className={`rounded-xl border p-3 text-xs font-black ${method === 'PIX' ? 'border-psi-vibrant bg-psi-light text-psi-deep' : 'border-line text-muted'}`}><QrCode className="mr-1 inline h-4 w-4" /> Pix</button>
        <button type="button" onClick={() => setMethod('CREDIT_CARD')} className={`rounded-xl border p-3 text-xs font-black ${method === 'CREDIT_CARD' ? 'border-psi-vibrant bg-psi-light text-psi-deep' : 'border-line text-muted'}`}><CreditCard className="mr-1 inline h-4 w-4" /> Cartão em 1x</button>
      </div>
      {rule.discountPercent === 10 && <p className="text-xs font-semibold text-emerald-800">10% de desconto no total das sessões selecionadas, em pagamento único.</p>}
      {rule.error && <p role="alert" className="text-xs font-semibold text-rose-800">{rule.error}</p>}
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
      <button type="button" disabled={loading || selectedSessions.length === 0 || !!rule.error} onClick={() => void pay()} className="btn-accent w-full justify-center py-3 text-xs disabled:opacity-40">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {selectedSessions.length > 1 ? `Pagar ${selectedSessions.length} sessões juntas` : 'Pagar sessão selecionada'}
      </button>
    </div>
  );
}
