'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, Search, SlidersHorizontal } from 'lucide-react';
import {
  exportFinancialReportCsv,
  exportFinancialReportPdf,
  generateFinancialReports,
  type ChargeStatus,
  type FinancialLedger,
  type FinancialReportBundle,
} from '@thats-life/core';
import { applicationRequest } from '@/lib/applicationApi';
import { demoLedger, people } from './demoLedger';
import { FinanceMetrics } from './FinanceMetrics';

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));

const statusLabel: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  partially_paid: 'Parcial',
  overdue: 'Vencido',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

const statusStyle: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-blue-50 text-blue-700',
  partially_paid: 'bg-amber-50 text-amber-700',
  overdue: 'bg-rose-50 text-rose-700',
};

function download(data: string | Uint8Array, type: string, filename: string) {
  const content: BlobPart = typeof data === 'string' ? data : new Uint8Array(data).buffer;
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FinancialDashboard() {
  const [ledger, setLedger] = useState<FinancialLedger>(demoLedger);
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [serverReport, setServerReport] = useState<FinancialReportBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    applicationRequest<FinancialReportBundle>('/financial/reports')
      .then((bundle) => {
        if (!cancelled && bundle?.summary) {
          setServerReport(bundle);
        }
      })
      .catch(() => {
        // Fallback local caso o servidor não responda
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const localReport = useMemo(
    () =>
      generateFinancialReports(
        ledger,
        {
          organizationId: 'org-demo',
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-07-31T23:59:59.999Z',
          patientIds: patientId ? [patientId] : undefined,
          professionalIds: professionalId ? [professionalId] : undefined,
          chargeStatuses: status ? [status as ChargeStatus] : undefined,
        },
        '2026-07-31T15:00:00.000Z'
      ),
    [ledger, patientId, professionalId, status]
  );

  const report = serverReport ?? localReport;

  const rows = report.receivables.filter((item) =>
    `${people.patients[item.patientId as keyof typeof people.patients] ?? item.patientId} ${item.sessionId}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const settle = (chargeId: string, amountCents: number) =>
    setLedger((current) => ({
      ...current,
      payments: [
        ...current.payments,
        {
          id: `payment-manual-${Date.now()}`,
          chargeId,
          receivedAt: '2026-07-31T15:00:00.000Z',
          amountCents,
          method: 'pix',
          status: 'confirmed',
          provider: 'manual',
        },
      ],
    }));

  const createCharge = () => {
    const id = `charge-demo-${Date.now()}`;
    setLedger((current) => ({
      ...current,
      charges: [
        ...current.charges,
        {
          id,
          organizationId: 'org-demo',
          sessionId: `session-${current.charges.length + 106}`,
          patientId: 'patient-1',
          professionalId: 'professional-1',
          issuedAt: '2026-07-31T15:00:00.000Z',
          dueAt: '2026-08-07T23:59:00.000Z',
          amountCents: 25000,
          status: 'pending',
          createdAt: '2026-07-31T15:00:00.000Z',
          updatedAt: '2026-07-31T15:00:00.000Z',
        },
      ],
    }));
    setShowForm(false);
  };

  const handleExportCsv = () => {
    const csvContent = exportFinancialReportCsv(report);
    download(csvContent, 'text/csv;charset=utf-8', 'relatorio-financeiro-julho-2026.csv');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header className="relative overflow-hidden rounded-[28px] bg-[#f0e9dc] p-7 md:p-9">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[42px] border-[#d7c8aa]/40" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary">
              Livro-caixa · Julho 2026
            </p>
            <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold tracking-tight text-[#2d2639] md:text-5xl">
              Clareza financeira, sessão por sessão.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-[#655d6b]">
              Dados calculados pelo motor financeiro. Conciliação automática de contas a receber e repasses.
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary shrink-0 text-sm">
            <Plus className="h-4 w-4" />
            Nova cobrança
          </button>
        </div>
      </header>

      <FinanceMetrics summary={report.summary} />

      {showForm && (
        <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-soft p-4">
          <div>
            <p className="font-bold text-ink">Cobrança demonstrativa</p>
            <p className="text-xs text-muted">Marina Costa · Sessão avulsa · R$ 250,00</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn-ghost text-xs">
              Cancelar
            </button>
            <button onClick={createCharge} className="btn-primary py-2 text-xs">
              Criar cobrança
            </button>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-[24px] border border-line bg-white shadow-card">
        <div className="border-b border-line p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold text-ink">Contas a receber</h2>
              <p className="text-xs text-muted">Conciliação calculada por sessão</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExportCsv} className="btn-outline px-3 py-2 text-xs">
                <Download className="h-4 w-4" />
                CSV (Excel PT-BR)
              </button>
              <button
                onClick={() => download(exportFinancialReportPdf(report), 'application/pdf', 'financeiro-julho-2026.pdf')}
                className="btn-outline px-3 py-2 text-xs"
              >
                <FileText className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input py-2.5 pl-9 text-xs"
                placeholder="Paciente ou sessão"
              />
            </label>
            <select
              className="input py-2.5 text-xs"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Todos os pacientes</option>
              {Object.entries(people.patients).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="input py-2.5 text-xs"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
            >
              <option value="">Todos os profissionais</option>
              {Object.entries(people.professionals).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <label className="relative">
              <SlidersHorizontal className="absolute left-3 top-3 h-4 w-4 text-muted" />
              <select
                className="input py-2.5 text-xs"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos os status</option>
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
                <option value="partially_paid">Parcial</option>
                <option value="overdue">Vencido</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-[#faf8f3] text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-5 py-3">Paciente / sessão</th>
                <th>Profissional</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Valor líquido</th>
                <th>Recebido</th>
                <th>Em aberto</th>
                <th className="pr-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((item) => (
                <tr key={item.chargeId} className="transition hover:bg-soft/40">
                  <td className="px-5 py-4">
                    <p className="font-bold text-ink">
                      {people.patients[item.patientId as keyof typeof people.patients] ?? item.patientId}
                    </p>
                    <p className="text-[10px] text-muted">{item.sessionId}</p>
                  </td>
                  <td>{people.professionals[item.professionalId as keyof typeof people.professionals] ?? item.professionalId}</td>
                  <td>{date(item.dueAt)}</td>
                  <td>
                    <span className={`rounded-full px-2.5 py-1 font-bold ${statusStyle[item.chargeStatus] ?? 'bg-slate-50 text-slate-600'}`}>
                      {statusLabel[item.chargeStatus]}
                    </span>
                  </td>
                  <td className="font-semibold">{money(item.netAmountCents)}</td>
                  <td>{money(item.paidAmountCents)}</td>
                  <td className={item.outstandingAmountCents > 0 ? 'font-bold text-rose-700' : 'text-emerald-700'}>
                    {money(item.outstandingAmountCents)}
                  </td>
                  <td className="pr-5 text-right">
                    {item.outstandingAmountCents > 0 && (
                      <button onClick={() => settle(item.chargeId, item.outstandingAmountCents)} className="font-bold text-primary hover:underline">
                        Dar baixa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-10 text-center text-sm text-muted">
              Nenhuma cobrança encontrada com esses filtros.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
