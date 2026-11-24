'use client';
import { AlertTriangle, CheckCircle2, Circle, Clock3, FileText, RotateCcw, XCircle, type LucideIcon } from 'lucide-react';
import { TagStatus, type COR_ICONE } from '@/components/gestao/TagStatus';
import { rotuloFormaPagamento } from '@/lib/modalidadesPagamento';
import { nfseRowAction, nfseRowTone, type NfseRowStatus } from './nfsePresentation';
import { ManualPaymentButton } from './ManualPaymentButton';
import { ChargeDueButton } from './ChargeDueButton';
export interface Atendimento {
  chargeId: string;
  patientId: string;
  sessionId: string;
  pacienteNome: string;
  psicologoId: string;
  psicologoNome: string;
  vencimentoEm: string;
  prazoSolicitado?: string;
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
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle:'short', timeStyle:'short' }).format(new Date(iso));

const rotuloStatus: Record<Atendimento['status'], string> = {
  draft: 'Rascunho',
  paid: 'Pago',
  pending: 'Pendente',
  partially_paid: 'Parcial',
  overdue: 'Vencido',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

// Tag neutra com a cor só no ícone (design.md).
const iconeStatus: Record<Atendimento['status'], { icone: LucideIcon; cor: keyof typeof COR_ICONE }> = {
  draft: { icone: Circle, cor: 'neutro' },
  paid: { icone: CheckCircle2, cor: 'positivo' },
  pending: { icone: Clock3, cor: 'neutro' },
  partially_paid: { icone: AlertTriangle, cor: 'atencao' },
  overdue: { icone: XCircle, cor: 'negativo' },
  refunded: { icone: RotateCcw, cor: 'neutro' },
  cancelled: { icone: Circle, cor: 'neutro' },
};

/** Após qualquer recebimento o prazo fica travado; sessão do convênio segue o prazo da fatura. */
export const podeEditarVencimento = (item: Atendimento) =>
  ['draft', 'pending', 'overdue', 'partially_paid'].includes(item.status) && item.emAbertoCents > 0
  && !item.custeadoPelaEmpresa && !item.faturaConvenioId;

export function ClinicReceivablesTable({ atendimentos, eAdmin, abrirPreviaNfse, onPaymentSaved }: {
  atendimentos: Atendimento[]; eAdmin: boolean | null;
  abrirPreviaNfse: (id: string) => void; onPaymentSaved: () => void;
}) {
  return (
          <table className="w-full min-w-[56rem] text-left text-xs">
            <thead className="border-b border-psi-soft/60 bg-psi-soft/30 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Convênio</th>
                <th className="px-6 py-4">Psicólogo</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Recebido</th>
                <th className="px-6 py-4">Crédito (70%)</th>
                <th className="px-6 py-4">Clínica (30%)</th>
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
                <tr key={item.chargeId} className="transition-colors hover:bg-psi-soft/30">
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-ink">{item.pacienteNome}</p>
                    <p className="text-[10px] text-muted font-mono">{item.sessionId}</p>
                  </td>
                  <td className="px-6 py-4">
                    {item.custeadoPelaEmpresa ? (
                      <TagStatus>{item.convenioNome ?? 'Custeado pela empresa'}</TagStatus>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink">{item.psicologoNome}</td>
                  <td className="px-6 py-4 text-muted">
                    {dataBr(item.vencimentoEm)}
                    {item.prazoSolicitado && <p>Aguardando confirmação bancária para {dataBr(item.prazoSolicitado)}</p>}
                    {eAdmin && podeEditarVencimento(item) && (
                      <ChargeDueButton chargeId={item.chargeId} patientName={item.pacienteNome}
                        dueAt={item.vencimentoEm} onSaved={onPaymentSaved} />
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-ink">{dinheiro(item.valorLiquidoCents)}</td>
                  <td className="px-6 py-4 font-semibold text-ink">
                    {dinheiro(item.recebidoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-ink">
                    {dinheiro(item.creditoPsicologoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-psi-deep">
                    {dinheiro(item.receitaClinicaCents)}
                  </td>
                  <td className="px-6 py-4">
                    <TagStatus icone={iconeStatus[item.status].icone} cor={iconeStatus[item.status].cor}>
                      {rotuloStatus[item.status]}
                    </TagStatus>
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
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <FileText aria-hidden className={`h-3.5 w-3.5 ${nfseRowTone[acaoNfse.tone]}`} />
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
