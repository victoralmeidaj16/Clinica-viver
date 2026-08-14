'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, CreditCard, ExternalLink, FileSpreadsheet, Share2 } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import { reaisDeCentavos, type ModalidadePagamentoSlug } from '@/lib/modalidadesPagamento';

interface Transaction {
  id: string;
  patientName: string;
  receivedAt: string;
  amountCents: number;
  professionalCreditCents: number;
  clinicRevenueCents: number;
  method: string;
}

type PaymentStatus = 'draft' | 'paid' | 'pending' | 'partially_paid' | 'overdue' | 'refunded' | 'cancelled';

interface Receivable {
  chargeId: string;
  sessionId: string;
  patientName: string;
  dueAt: string;
  status: PaymentStatus;
  amountCents: number;
  receivedCents: number;
  outstandingCents: number;
}

interface FinancialData {
  professionalName: string;
  paymentToken: string;
  modalities: Record<ModalidadePagamentoSlug, number>;
  receivedCents: number;
  professionalCreditCents: number;
  transactions: Transaction[];
  receivables: Receivable[];
}

const labels = { social: 'Sessão Social', particular: 'Sessão Particular' } as const;

const paymentStatusLabel: Record<PaymentStatus, string> = {
  draft: 'Rascunho',
  paid: 'Pago',
  pending: 'Pendente',
  partially_paid: 'Parcial',
  overdue: 'Vencido',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

const paymentStatusStyle: Record<PaymentStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-sky-100 text-sky-800 border-sky-200',
  partially_paid: 'bg-amber-100 text-amber-900 border-amber-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-200',
  refunded: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

function initialDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}` };
}

export default function MeuFinanceiroPage() {
  const initial = initialDates();
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [data, setData] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState<ModalidadePagamentoSlug>();

  const load = useCallback(() => applicationRequest<FinancialData>(
    `/financial/me?startDate=${startDate}&endDate=${endDate}`
  ).then((result) => { setData(result); setError(undefined); })
    .catch((cause) => setError(
      cause instanceof Error ? cause.message : 'Não foi possível carregar o financeiro.'
    )), [startDate, endDate]);

  useEffect(() => { void load(); }, [load]);

  const link = (modality: ModalidadePagamentoSlug) =>
    `${window.location.origin}/pagar/${data?.paymentToken}/${modality}`;

  const copy = async (modality: ModalidadePagamentoSlug) => {
    await navigator.clipboard.writeText(link(modality));
    setCopied(modality);
    window.setTimeout(() => setCopied(undefined), 2500);
  };

  const share = (modality: ModalidadePagamentoSlug) => {
    if (!data) return;
    const text = encodeURIComponent(
      `Olá! Segue o link seguro para pagamento da consulta (${labels[modality]} — ${reaisDeCentavos(data.modalities[modality])}):\n${link(modality)}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Data', 'Paciente', 'Valor', 'Crédito 70%', 'Método'], ...data.transactions.map((item) => [
      item.receivedAt, item.patientName, (item.amountCents / 100).toFixed(2),
      (item.professionalCreditCents / 100).toFixed(2), item.method,
    ])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `meu-financeiro-${startDate}-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-psi-vibrant" /> Meu Financeiro
          </h1>
          <p className="text-xs text-muted">Links de pagamento e valores conciliados pelo Asaas.</p>
        </div>
        <button onClick={exportCsv} disabled={!data} className="rounded-2xl border border-line bg-surface px-4 py-2.5 font-bold flex items-center gap-2 text-xs disabled:opacity-50">
          <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="bg-slate-900 text-white p-6 rounded-3xl space-y-5">
        <div>
          <h2 className="font-black">Links permanentes de {data?.professionalName ?? 'pagamento'}</h2>
          <p className="text-xs text-slate-300 mt-1">O paciente precisa apenas estar cadastrado e vinculado ao seu perfil; não é necessário ter consulta agendada.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {(['social', 'particular'] as const).map((modality) => (
            <div key={modality} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div><p className="text-xs text-emerald-400 font-bold">{labels[modality]}</p>
                  <p className="text-xl font-black">{data ? reaisDeCentavos(data.modalities[modality]) : '—'}</p></div>
                {data && <a href={link(modality)} target="_blank" rel="noreferrer" aria-label="Abrir link"><ExternalLink className="w-4 h-4" /></a>}
              </div>
              <div className="truncate rounded-xl border border-slate-700 px-3 py-2 text-[11px] font-mono text-emerald-300">{data ? link(modality) : 'Carregando…'}</div>
              <div className="flex gap-2">
                <button disabled={!data} onClick={() => void copy(modality)} className="flex-1 rounded-xl bg-emerald-500 p-2.5 text-xs font-black text-slate-950 flex justify-center gap-1">
                  {copied === modality ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied === modality ? 'Copiado' : 'Copiar'}
                </button>
                <button disabled={!data} onClick={() => share(modality)} className="flex-1 rounded-xl bg-slate-700 p-2.5 text-xs font-bold flex justify-center gap-1"><Share2 className="w-4 h-4" /> WhatsApp</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface border border-line rounded-3xl p-5 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold">Início<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block mt-1 input" /></label>
          <label className="text-xs font-bold">Fim<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block mt-1 input" /></label>
          <button onClick={() => void load()} className="btn-primary text-xs">Atualizar</button>
          <div className="sm:ml-auto"><p className="text-xs text-muted">Crédito do período (70%)</p><p className="text-2xl font-black text-emerald-600">{reaisDeCentavos(data?.professionalCreditCents ?? 0)}</p></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted border-b border-line"><th className="py-3">Data</th><th>Paciente</th><th>Pagamento</th><th>Crédito 70%</th><th>Forma</th></tr></thead>
          <tbody>{data?.transactions.map((item) => <tr key={item.id} className="border-b border-line/70"><td className="py-3">{new Date(item.receivedAt).toLocaleDateString('pt-BR')}</td><td className="font-bold">{item.patientName}</td><td>{reaisDeCentavos(item.amountCents)}</td><td className="text-emerald-700 font-bold">{reaisDeCentavos(item.professionalCreditCents)}</td><td>{item.method}</td></tr>)}</tbody></table>
          {data?.transactions.length === 0 && <p className="text-center text-muted py-8">Nenhum pagamento conciliado no período.</p>}
        </div>
      </section>

      <section className="bg-surface border border-line rounded-3xl p-5 space-y-4">
        <div>
          <h2 className="font-black text-ink">Status dos atendimentos</h2>
          <p className="text-xs text-muted mt-1">Acompanhe as cobranças das suas sessões e identifique o que ainda está em aberto.</p>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted border-b border-line"><th className="py-3">Vencimento</th><th>Paciente</th><th>Status</th><th>Valor</th><th>Recebido</th><th>Em aberto</th></tr></thead>
          <tbody>{data?.receivables.map((item) => <tr key={item.chargeId} className="border-b border-line/70"><td className="py-3">{new Date(item.dueAt).toLocaleDateString('pt-BR')}</td><td className="font-bold">{item.patientName}</td><td><span className={`inline-flex rounded-full border px-2 py-1 font-bold ${paymentStatusStyle[item.status]}`}>{paymentStatusLabel[item.status]}</span></td><td>{reaisDeCentavos(item.amountCents)}</td><td className="text-emerald-700 font-bold">{reaisDeCentavos(item.receivedCents)}</td><td className={item.outstandingCents > 0 ? 'font-bold text-amber-700' : 'text-muted'}>{reaisDeCentavos(item.outstandingCents)}</td></tr>)}</tbody></table>
          {data?.receivables.length === 0 && <p className="text-center text-muted py-8">Nenhuma cobrança de atendimento encontrada.</p>}
        </div>
      </section>
    </div>
  );
}
