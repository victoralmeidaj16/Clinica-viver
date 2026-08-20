'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, Search, SlidersHorizontal } from 'lucide-react';
import {
  exportFinancialReportCsv,
  generateFinancialReports,
  type ChargeStatus,
  type FinancialLedger,
  type FinancialReportBundle,
} from '@thats-life/core';
import { applicationRequest } from '@/lib/applicationApi';
import { demoLedger, people } from './demoLedger';
import { FinanceMetrics } from './FinanceMetrics';
import { exportBrandedFinancialPdf } from '@/lib/financialPdfReportBuilder';
import { ReceivablesLedger } from './ReceivablesLedger';

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
      <header className="relative overflow-hidden rounded-2xl bg-psi-darkest p-7 md:p-9 text-white shadow-contrast">
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-psi-vibrant">
              Livro-caixa · Julho 2026
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
              Clareza financeira, sessão por sessão.
            </h1>
            <p className="mt-3 max-w-xl text-xs text-psi-soft/80">
              Dados calculados pelo motor financeiro. Conciliação automática de contas a receber e repasses.
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-accent shrink-0 text-xs">
            <Plus className="h-4 w-4" />
            Nova cobrança
          </button>
        </div>
      </header>

      <FinanceMetrics summary={report.summary} />

      {showForm && (
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-ink">Cobrança demonstrativa</p>
            <p className="text-xs text-muted">Marina Costa · Sessão avulsa · R$ 250,00</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button onClick={() => setShowForm(false)} className="btn-ghost min-h-11 justify-center text-xs">
              Cancelar
            </button>
            <button onClick={createCharge} className="btn-primary min-h-11 justify-center py-2 text-xs">
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
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <button onClick={handleExportCsv} className="btn-outline min-h-11 justify-center px-3 py-2 text-xs">
                <Download className="h-4 w-4" />
                CSV (Excel PT-BR)
              </button>
              <button
                onClick={() => exportBrandedFinancialPdf(report)}
                className="btn-accent min-h-11 justify-center px-4 py-2 text-xs shadow-md"
              >
                <FileText className="h-4 w-4" />
                Exportar PDF Estilizado ⚡
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

        <ReceivablesLedger rows={rows} onSettle={settle} />
      </section>
    </div>
  );
}
