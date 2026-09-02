'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CreditCard, FileSpreadsheet, Pencil, XCircle } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import { reaisDeCentavos } from '@/lib/modalidadesPagamento';
import { EditSessionModal, type SessionEditableData } from '@/components/scheduling/EditSessionModal';

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
  appointmentId?: string;
  patientName: string;
  dueAt: string;
  startsAt?: string;
  endsAt?: string;
  status: PaymentStatus;
  attendanceStatus?: 'agendado' | 'realizado' | 'cancelado';
  modalidade?: 'online' | 'presencial' | 'telefone';
  amountCents: number;
  receivedCents: number;
  outstandingCents: number;
}

interface FinancialData {
  receivedCents: number;
  professionalCreditCents: number;
  transactions: Transaction[];
  receivables: Receivable[];
}

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

/** O mês corrente como `AAAA-MM`, no fuso em que a clínica atende. */
function mesAtual(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((item) => item.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}`;
}

/**
 * Primeiro e último dia do mês escolhido.
 *
 * A API continua recebendo um intervalo; quem deixou de existir foi a escolha
 * de datas soltas. O extrato do psicólogo é lido por competência — "quanto
 * entrou em agosto" —, e permitir 12/07 a 03/09 só produzia períodos que não
 * fecham com nada. `Date.UTC(ano, mes, 0)` cai no último dia do mês pedido.
 */
function periodoDoMes(mes: string): { start: string; end: string } {
  const [ano, numeroDoMes] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numeroDoMes, 0)).getUTCDate();
  return { start: `${mes}-01`, end: `${mes}-${String(ultimoDia).padStart(2, '0')}` };
}

const MES_POR_EXTENSO = new Intl.DateTimeFormat('pt-BR', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

export default function MeuFinanceiroPage() {
  const [mes, setMes] = useState(mesAtual);
  const [data, setData] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string>();
  const [editingSession, setEditingSession] = useState<SessionEditableData>();

  const load = useCallback(() => {
    const { start, end } = periodoDoMes(mes);
    return applicationRequest<FinancialData>(
      `/financial/me?startDate=${start}&endDate=${end}`
    ).then((result) => { setData(result); setError(undefined); })
      .catch((cause) => setError(
        cause instanceof Error ? cause.message : 'Não foi possível carregar o financeiro.'
      ));
  }, [mes]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Data', 'Paciente', 'Valor', 'Crédito 70%', 'Método'], ...data.transactions.map((item) => [
      item.receivedAt, item.patientName, (item.amountCents / 100).toFixed(2),
      (item.professionalCreditCents / 100).toFixed(2), item.method,
    ])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `meu-financeiro-${mes}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const handleEditSession = (item: Receivable) => {
    setEditingSession({
      id: item.appointmentId || item.sessionId,
      pacienteNome: item.patientName,
      inicio: item.startsAt || item.dueAt,
      fim: item.endsAt,
      modalidade: item.modalidade || 'online',
      status: item.attendanceStatus || 'agendado',
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-psi-vibrant" /> Meu Financeiro
          </h1>
          <p className="text-xs text-muted">Valores conciliados pelo Asaas. As cobranças são geradas por agendamento.</p>
        </div>
        <button onClick={exportCsv} disabled={!data} className="rounded-2xl border border-line bg-surface px-4 py-2.5 font-bold flex items-center gap-2 text-xs disabled:opacity-50">
          <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="bg-surface border border-line rounded-3xl p-5 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold">Mês<input type="month" value={mes} onChange={(e) => setMes(e.target.value || mesAtual())} className="block mt-1 input" /></label>
          <button onClick={() => void load()} className="btn-primary text-xs">Atualizar</button>
          <div className="sm:ml-auto"><p className="text-xs text-muted">Crédito de {MES_POR_EXTENSO.format(new Date(`${mes}-01T12:00:00Z`))} (70%)</p><p className="text-2xl font-black text-emerald-600">{reaisDeCentavos(data?.professionalCreditCents ?? 0)}</p></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted border-b border-line"><th className="py-3">Data</th><th>Paciente</th><th>Pagamento</th><th>Crédito 70%</th><th>Forma</th></tr></thead>
          <tbody>{data?.transactions.map((item) => <tr key={item.id} className="border-b border-line/70"><td className="py-3">{new Date(item.receivedAt).toLocaleDateString('pt-BR')}</td><td className="font-bold">{item.patientName}</td><td>{reaisDeCentavos(item.amountCents)}</td><td className="text-emerald-700 font-bold">{reaisDeCentavos(item.professionalCreditCents)}</td><td>{item.method}</td></tr>)}</tbody></table>
          {data?.transactions.length === 0 && <p className="text-center text-muted py-8">Nenhum pagamento conciliado neste mês.</p>}
        </div>
      </section>

      <section className="bg-surface border border-line rounded-3xl p-5 space-y-4">
        <div>
          <h2 className="font-black text-ink">Status dos atendimentos</h2>
          <p className="text-xs text-muted mt-1">Acompanhe as cobranças das suas sessões e identifique o que já foi atendido ou ainda está em aberto.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-3">Sessão</th>
                <th>Paciente</th>
                <th>Atendimento</th>
                <th>Pagamento</th>
                <th>Valor</th>
                <th>Recebido</th>
                <th>Em aberto</th>
                <th className="text-right py-3 pr-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.receivables.map((item) => (
                <tr key={item.chargeId} className="border-b border-line/70 hover:bg-slate-50/50 transition">
                  <td className="py-3 whitespace-nowrap">
                    {new Date(item.startsAt || item.dueAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="font-bold text-ink">{item.patientName}</td>
                  <td>
                    {item.attendanceStatus === 'realizado' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Realizado
                      </span>
                    ) : item.attendanceStatus === 'cancelado' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                        <XCircle className="w-3 h-3" /> Cancelado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-extrabold text-sky-800">
                        <CalendarDays className="w-3 h-3" /> Agendado
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 font-bold ${paymentStatusStyle[item.status]}`}>
                      {paymentStatusLabel[item.status]}
                    </span>
                  </td>
                  <td>{reaisDeCentavos(item.amountCents)}</td>
                  <td className="text-emerald-700 font-bold">{reaisDeCentavos(item.receivedCents)}</td>
                  <td className={item.outstandingCents > 0 ? 'font-bold text-amber-700' : 'text-muted'}>
                    {reaisDeCentavos(item.outstandingCents)}
                  </td>
                  <td className="text-right py-3 pr-2">
                    <button
                      type="button"
                      onClick={() => handleEditSession(item)}
                      className="rounded-xl border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-slate-100 hover:text-psi-deep transition inline-flex items-center gap-1 shadow-sm"
                    >
                      <Pencil className="w-3 h-3 text-psi-vibrant" /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.receivables.length === 0 && <p className="text-center text-muted py-8">Nenhuma cobrança de atendimento encontrada.</p>}
        </div>
      </section>

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          isOpen={Boolean(editingSession)}
          onClose={() => setEditingSession(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}
