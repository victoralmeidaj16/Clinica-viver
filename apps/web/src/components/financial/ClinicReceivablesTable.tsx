'use client';
import { FileText } from 'lucide-react';
import { rotuloFormaPagamento } from '@/lib/modalidadesPagamento';
import { nfseRowAction, nfseRowTone, type NfseRowStatus } from './nfsePresentation';
import { ManualPaymentButton } from './ManualPaymentButton';
export interface Atendimento {
  chargeId: string;
  patientId: string;
  sessionId: string;
  pacienteNome: string;
  psicologoId: string;
  psicologoNome: string;
  vencimentoEm: string;
  status: 'draft' | 'paid' | 'pending' | 'partially_paid' | 'overdue' | 'refunded' | 'cancelled';
  valorLiquidoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  creditoPsicologoCents: number;
  receitaClinicaCents: number;
  nfseStatus: NfseRowStatus;
  nfseNumero?: string;
  convenioNome?: string;
  custeadoPelaEmpresa: boolean;
  faturaConvenioId?: string;
  formaPagamento?: string;
}

const dinheiro = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
const dataBr = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

const rotuloStatus: Record<Atendimento['status'], string> = {
  draft: 'Rascunho',
  paid: 'Pago',
  pending: 'Pendente',
  partially_paid: 'Parcial',
  overdue: 'Vencido',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

const estiloStatus: Record<Atendimento['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-sky-100 text-sky-800 border-sky-200',
  partially_paid: 'bg-amber-100 text-amber-800 border-amber-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-200',
  refunded: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function ClinicReceivablesTable({ atendimentos, eAdmin, abrirPreviaNfse, onPaymentSaved }: {
  atendimentos: Atendimento[]; eAdmin: boolean | null;
  abrirPreviaNfse: (id: string) => void; onPaymentSaved: () => void;
}) {
  return (
          <table className="w-full min-w-[56rem] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Convênio</th>
                <th className="px-6 py-4">Psicólogo</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Recebido</th>
                <th className="px-6 py-4 text-emerald-700">Crédito (70%)</th>
                <th className="px-6 py-4 text-psi-deep">Clínica (30%)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Forma</th>
                <th className="px-6 py-4 text-right">NFS-e</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {atendimentos.map((item) => {
                const acaoNfse = nfseRowAction({
                  paymentStatus: item.status,
                  nfseStatus: item.nfseStatus,
                  isAdmin: eAdmin === true,
                  numero: item.nfseNumero,
                  custeadoPelaEmpresa: item.custeadoPelaEmpresa,
                  faturaConvenioId: item.faturaConvenioId,
                  paymentMethod: item.formaPagamento,
                });
                return (
                <tr key={item.chargeId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-ink">{item.pacienteNome}</p>
                    <p className="text-[10px] text-muted font-mono">{item.sessionId}</p>
                  </td>
                  <td className="px-6 py-4">
                    {item.custeadoPelaEmpresa ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800">
                        {item.convenioNome ?? 'Custeado pela empresa'}
                      </span>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink">{item.psicologoNome}</td>
                  <td className="px-6 py-4 text-muted">{dataBr(item.vencimentoEm)}</td>
                  <td className="px-6 py-4 font-bold text-ink">{dinheiro(item.valorLiquidoCents)}</td>
                  <td className="px-6 py-4 font-semibold text-emerald-700">
                    {dinheiro(item.recebidoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-emerald-600 bg-emerald-50/50">
                    {dinheiro(item.creditoPsicologoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-psi-deep">
                    {dinheiro(item.receitaClinicaCents)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${estiloStatus[item.status]}`}
                    >
                      {rotuloStatus[item.status]}
                    </span>
                    {eAdmin && item.emAbertoCents > 0 && ['pending', 'overdue', 'partially_paid'].includes(item.status)
                      && !item.custeadoPelaEmpresa && !item.faturaConvenioId && (
                      <ManualPaymentButton chargeId={item.chargeId} patientName={item.pacienteNome}
                        outstandingCents={item.emAbertoCents} onSaved={onPaymentSaved} />
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink whitespace-nowrap">
                    {item.formaPagamento ? rotuloFormaPagamento(item.formaPagamento) : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {acaoNfse.clickable ? (
                      <button
                        type="button"
                        onClick={() => void abrirPreviaNfse(item.chargeId)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-extrabold transition-colors ${nfseRowTone[acaoNfse.tone]}`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {acaoNfse.label}
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted">{acaoNfse.label}</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
  );
}
