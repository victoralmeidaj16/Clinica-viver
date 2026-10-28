'use client';

import { Building2, CalendarDays, Check, CheckCircle2, Copy, Pencil, XCircle } from 'lucide-react';
import { reaisDeCentavos, rotuloFormaPagamento } from '@/lib/modalidadesPagamento';
import type { PaymentStatus, Receivable } from '@/lib/myFinancialModel';

interface Props {
  receivables?: Receivable[];
  pacientesMap: Map<string, { conveniado?: boolean; convenioNome?: string }>;
  linkCopiado?: string;
  onCopyPayment: (item: Receivable) => Promise<void>;
  onEditSession: (item: Receivable) => void;
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

export function MyReceivablesTable({ receivables, pacientesMap, linkCopiado, onCopyPayment, onEditSession }: Props) {
  return (
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
                <th>Forma</th>
                <th>Valor</th>
                <th>Recebido</th>
                <th>Em aberto</th>
                <th>Link de pagamento</th>
                <th className="text-right py-3 pr-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {receivables?.map((item) => {
                const patientInfo =
                  pacientesMap.get(item.appointmentId ?? '') ||
                  pacientesMap.get(item.sessionId ?? '') ||
                  pacientesMap.get(item.patientName.trim().toLowerCase());

                const isCancelado = item.attendanceStatus === 'cancelado';
                const isRealizado = item.attendanceStatus === 'realizado';

                const isConveniado = Boolean(item.conveniado || patientInfo?.conveniado);
                const convenioNome = item.convenioNome || patientInfo?.convenioNome;
                const custeado = Boolean(item.custeadoPelaEmpresa ?? isConveniado);

                return (
                  <tr key={item.chargeId} className="border-b border-line/70 hover:bg-slate-50/50 transition">
                    <td className="py-3 whitespace-nowrap">
                      {new Date(item.startsAt || item.dueAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="font-bold text-ink">{item.patientName}</td>
                    <td>
                      {isRealizado ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Realizado
                        </span>
                      ) : isCancelado ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                          <XCircle className="w-3 h-3" /> Cancelado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-extrabold text-sky-800">
                          <CalendarDays className="w-3 h-3" /> A confirmar
                        </span>
                      )}
                    </td>
                    <td>
                      {isConveniado ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-800">
                            <Building2 className="w-3 h-3 text-sky-600" />
                            {convenioNome ? `Convênio: ${convenioNome}` : 'Conveniado'}
                          </span>
                          <div className="text-[10px]">
                            {custeado ? (
                              <span className="font-bold text-emerald-700">
                                Custeado pela empresa
                              </span>
                            ) : (
                              <span className={`inline-flex rounded-full border px-1.5 py-0.5 font-bold ${paymentStatusStyle[item.status]}`}>
                                {paymentStatusLabel[item.status]}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 font-bold ${paymentStatusStyle[item.status]}`}>
                          {paymentStatusLabel[item.status]}
                        </span>
                      )}
                    </td>
                    <td className="font-semibold text-ink">
                      {item.paymentMethod ? rotuloFormaPagamento(item.paymentMethod) : '—'}
                    </td>
                    <td>{reaisDeCentavos(item.amountCents)}</td>
                    <td className="text-emerald-700 font-bold">{reaisDeCentavos(item.receivedCents)}</td>
                    <td className={item.outstandingCents > 0 ? 'font-bold text-amber-700' : 'text-muted'}>
                      {reaisDeCentavos(item.outstandingCents)}
                    </td>
                    <td>
                      {item.paymentLink && !custeado && !isCancelado && item.outstandingCents > 0 ? (
                        <button
                          type="button"
                          onClick={() => void onCopyPayment(item)}
                          className="rounded-xl border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-slate-100 hover:text-psi-deep transition inline-flex items-center gap-1 shadow-sm whitespace-nowrap"
                        >
                          {linkCopiado === item.chargeId ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Copiado!</>
                          ) : (
                            <><Copy className="w-3 h-3 text-psi-vibrant" /> Copiar link</>
                          )}
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right py-3 pr-2">
                      <button
                        type="button"
                        onClick={() => onEditSession(item)}
                        className="rounded-xl border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-slate-100 hover:text-psi-deep transition inline-flex items-center gap-1 shadow-sm"
                      >
                        <Pencil className="w-3 h-3 text-psi-vibrant" /> Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {receivables?.length === 0 && <p className="text-center text-muted py-8">Nenhuma cobrança de atendimento encontrada.</p>}
        </div>
      </section>
  );
}
