import { CalendarDays, CircleDollarSign, UserRound } from 'lucide-react';
import type { FinancialReportBundle } from '@thats-life/core';
import { people } from './demoLedger';

type Receivable = FinancialReportBundle['receivables'][number];

interface ReceivablesLedgerProps {
  rows: readonly Receivable[];
  onSettle: (chargeId: string, amountCents: number) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));

const statusLabel: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', partially_paid: 'Parcial', overdue: 'Vencido',
  refunded: 'Estornado', cancelled: 'Cancelado',
};

const statusStyle: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700', pending: 'bg-blue-50 text-blue-700',
  partially_paid: 'bg-amber-50 text-amber-700', overdue: 'bg-rose-50 text-rose-700',
};

const patientName = (item: Receivable) =>
  people.patients[item.patientId as keyof typeof people.patients] ?? item.patientId;

const professionalName = (item: Receivable) =>
  people.professionals[item.professionalId as keyof typeof people.professionals] ?? item.professionalId;

export function ReceivablesLedger({ rows, onSettle }: ReceivablesLedgerProps) {
  if (rows.length === 0) {
    return <p className="p-10 text-center text-sm text-muted">Nenhuma cobrança encontrada com esses filtros.</p>;
  }

  return (
    <>
      <div className="space-y-3 bg-canvas/50 p-3 md:hidden">
        {rows.map((item) => (
          <article key={item.chargeId} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-line bg-[#faf8f3] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{patientName(item)}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted">{item.sessionId}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusStyle[item.chargeStatus] ?? 'bg-slate-50 text-slate-600'}`}>
                {statusLabel[item.chargeStatus]}
              </span>
            </div>

            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Detail icon={UserRound} label="Profissional" value={professionalName(item)} />
                <Detail icon={CalendarDays} label="Vencimento" value={date(item.dueAt)} />
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3 text-xs">
                <Amount label="Líquido" value={money(item.netAmountCents)} />
                <Amount label="Recebido" value={money(item.paidAmountCents)} tone="text-emerald-700" />
                <Amount label="Em aberto" value={money(item.outstandingAmountCents)} tone={item.outstandingAmountCents > 0 ? 'text-rose-700' : 'text-emerald-700'} />
              </div>
              {item.outstandingAmountCents > 0 && (
                <button type="button" onClick={() => onSettle(item.chargeId, item.outstandingAmountCents)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-psi-darkest px-4 py-3 text-xs font-black text-white transition hover:bg-psi-deep">
                  <CircleDollarSign className="h-4 w-4 text-psi-vibrant" /> Dar baixa em {money(item.outstandingAmountCents)}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-[#faf8f3] text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr><th className="px-5 py-3">Paciente / sessão</th><th>Profissional</th><th>Vencimento</th><th>Status</th><th>Valor líquido</th><th>Recebido</th><th>Em aberto</th><th className="pr-5 text-right">Ação</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((item) => (
              <tr key={item.chargeId} className="transition hover:bg-soft/40">
                <td className="px-5 py-4"><p className="font-bold text-ink">{patientName(item)}</p><p className="text-[10px] text-muted">{item.sessionId}</p></td>
                <td>{professionalName(item)}</td><td>{date(item.dueAt)}</td>
                <td><span className={`rounded-full px-2.5 py-1 font-bold ${statusStyle[item.chargeStatus] ?? 'bg-slate-50 text-slate-600'}`}>{statusLabel[item.chargeStatus]}</span></td>
                <td className="font-semibold">{money(item.netAmountCents)}</td><td>{money(item.paidAmountCents)}</td>
                <td className={item.outstandingAmountCents > 0 ? 'font-bold text-rose-700' : 'text-emerald-700'}>{money(item.outstandingAmountCents)}</td>
                <td className="pr-5 text-right">{item.outstandingAmountCents > 0 && <button onClick={() => onSettle(item.chargeId, item.outstandingAmountCents)} className="font-bold text-primary hover:underline">Dar baixa</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="min-w-0"><p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted"><Icon className="h-3 w-3" />{label}</p><p className="mt-1 truncate font-bold text-ink">{value}</p></div>;
}

function Amount({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-bold uppercase text-muted">{label}</p><p className={`mt-1 break-words text-[11px] font-black ${tone}`}>{value}</p></div>;
}
