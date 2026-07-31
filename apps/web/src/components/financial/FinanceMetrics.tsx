import { AlertTriangle, ArrowDownToLine, Banknote, WalletCards } from 'lucide-react';
import type { FinancialSummaryReport } from '@thats-life/core';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

export function FinanceMetrics({ summary }: { summary: FinancialSummaryReport }) {
  const metrics = [
    { label: 'Faturamento líquido', value: money(summary.netBilledCents), detail: `${summary.chargeCount} cobranças no período`, icon: WalletCards, tone: 'bg-[#2f2550] text-white' },
    { label: 'Recebido', value: money(summary.receivedCents), detail: `${summary.settledChargeCount} sessões liquidadas`, icon: ArrowDownToLine, tone: 'bg-white text-ink' },
    { label: 'Em aberto', value: money(summary.outstandingCents), detail: `${summary.overdueChargeCount} cobranças vencidas`, icon: Banknote, tone: 'bg-white text-ink' },
    { label: 'Inadimplência', value: `${(summary.delinquencyRate * 100).toFixed(1)}%`, detail: money(summary.overdueCents), icon: AlertTriangle, tone: 'bg-[#fff5df] text-amber-950' },
  ];
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article key={label} className={`rounded-2xl border border-black/5 p-5 shadow-sm ${tone}`}><div className="flex items-start justify-between"><p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-65">{label}</p><Icon className="h-4 w-4 opacity-70" /></div><p className="mt-5 font-serif text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs opacity-65">{detail}</p></article>)}</div>;
}
