'use client';

import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  User,
  AlertTriangle,
  XCircle,
  RefreshCw,
  CheckCircle2,
  Send,
  DollarSign,
  Lock,
  MessageSquare,
  Filter,
} from 'lucide-react';

export default function AgendaPage() {
  const [sessoes, setSessoes] = useState([
    {
      id: 'sessao-1',
      paciente: 'João Pedro Severo',
      dataHora: '06/08/2026 às 14:00',
      dataIso: '2026-08-06T14:00:00',
      modalidade: 'Social (R$ 75,00)',
      duracao: '50 min',
      modoCobranca: 'PRE_SESSAO_24H', // Cobrar 24h Antes
      statusPagamento: 'PAGO',
      statusSessao: 'AGENDADA',
      vencimentoCobranca: '05/08/2026 14:00',
    },
    {
      id: 'sessao-2',
      paciente: 'Camila Fernandes',
      dataHora: '07/08/2026 às 15:00',
      dataIso: '2026-08-07T15:00:00',
      modalidade: 'Particular (R$ 130,00)',
      duracao: '50 min',
      modoCobranca: 'POS_SESSAO', // Cobrança Pós-Atendimento
      statusPagamento: 'PENDENTE',
      statusSessao: 'AGENDADA',
      vencimentoCobranca: 'Após realização',
    },
    {
      id: 'sessao-3',
      paciente: 'Roberto Mendes',
      dataHora: '04/08/2026 às 16:00',
      dataIso: '2026-08-04T16:00:00',
      modalidade: 'Social (R$ 75,00)',
      duracao: '50 min',
      modoCobranca: 'PRE_SESSAO_24H',
      statusPagamento: 'ATRASADO',
      statusSessao: 'AGENDADA',
      vencimentoCobranca: '03/08/2026 16:00 (Atrasado)',
    },
  ]);

  // Modal Cancelar / Reagendar
  const [modalAcao, setModalAcao] = useState<{
    tipo: 'CANCELAR' | 'REAGENDAR';
    sessaoId: string;
    pacienteNome: string;
  } | null>(null);

  const [motivoObrigatorio, setMotivoObrigatorio] = useState('');
  const [erroMotivo, setErroMotivo] = useState(false);

  const handleConfirmarAcaoAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoObrigatorio.trim()) {
      setErroMotivo(true);
      return;
    }

    if (!modalAcao) return;

    if (modalAcao.tipo === 'CANCELAR') {
      setSessoes((prev) =>
        prev.map((s) =>
          s.id === modalAcao.sessaoId
            ? { ...s, statusSessao: 'CANCELADA', motivoCancelamento: motivoObrigatorio }
            : s
        )
      );
      alert(`Sessão com ${modalAcao.pacienteNome} foi CANCELADA. Motivo registrado: "${motivoObrigatorio}".`);
    } else {
      setSessoes((prev) =>
        prev.map((s) =>
          s.id === modalAcao.sessaoId
            ? { ...s, statusSessao: 'REAGENDADA', motivoReagendamento: motivoObrigatorio }
            : s
        )
      );
      alert(`Sessão com ${modalAcao.pacienteNome} foi REAGENDADA. Motivo registrado: "${motivoObrigatorio}".`);
    }

    setModalAcao(null);
    setMotivoObrigatorio('');
    setErroMotivo(false);
  };

  const handleAlternarModoCobranca = (sessaoId: string) => {
    setSessoes((prev) =>
      prev.map((s) =>
        s.id === sessaoId
          ? {
              ...s,
              modoCobranca: s.modoCobranca === 'PRE_SESSAO_24H' ? 'POS_SESSAO' : 'PRE_SESSAO_24H',
            }
          : s
      )
    );
  };

  const handleEnviarDisparoCobrancaAtraso = (pacienteNome: string) => {
    alert(`Mensagem da Régua de Cobrança enviada com sucesso para o WhatsApp de ${pacienteNome}!`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <span className="chip-accent text-[11px] mb-1">Agenda & Regras de Atendimento</span>
        <h1 className="text-2xl font-black text-ink flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-psi-vibrant" />
          Agenda Clinica & Cobrança Pré/Pós-Sessão
        </h1>
        <p className="text-xs text-muted">
          Reagende ou cancele sessões com motivo obrigatório, configure o vencimento da cobrança (24h antes ou pós-sessão) e envie réguas de inadimplência.
        </p>
      </div>

      {/* MODAL DE CANCELAMENTO / REAGENDAMENTO COM MOTIVO OBRIGATÓRIO */}
      {modalAcao && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">
                {modalAcao.tipo === 'CANCELAR' ? 'Cancelar Atendimento' : 'Reagendar Atendimento'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalAcao(null);
                  setErroMotivo(false);
                }}
                className="text-muted hover:text-ink text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleConfirmarAcaoAgenda} className="space-y-4 text-xs">
              <p className="text-muted">
                Paciente: <span className="font-bold text-ink">{modalAcao.pacienteNome}</span>
              </p>

              <div>
                <label className="font-bold text-ink block mb-1">
                  Motivo da {modalAcao.tipo === 'CANCELAR' ? 'Exclusão/Cancelamento' : 'Remarcação'} <span className="text-rose-500">* (Obrigatório)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={motivoObrigatorio}
                  onChange={(e) => {
                    setMotivoObrigatorio(e.target.value);
                    if (e.target.value.trim()) setErroMotivo(false);
                  }}
                  placeholder="Descreva a justificativa (Ex: Paciente solicitou remarcação por conflito de horário...)"
                  className={`w-full bg-slate-50 border rounded-xl p-3 text-ink focus:outline-none ${
                    erroMotivo ? 'border-rose-500 bg-rose-50' : 'border-line focus:border-psi-vibrant'
                  }`}
                />
                {erroMotivo && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">
                    É obrigatório preencher a justificativa do cancelamento/remarcação.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className={`w-full font-extrabold py-3 rounded-2xl text-white transition-all ${
                  modalAcao.tipo === 'CANCELAR'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-psi-vibrant hover:bg-psi-vibrant/90'
                }`}
              >
                {modalAcao.tipo === 'CANCELAR' ? 'CONFIRMAR CANCELAMENTO' : 'CONFIRMAR REAGENDAMENTO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tabela da Agenda */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-ink">Sessões Agendadas & Regras de Pagamento</h3>
            <p className="text-xs text-muted">Valores e duração de 50 min travados pelo sistema para resguardo do profissional</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Data & Horário</th>
                <th className="px-6 py-4">Modalidade / Duração</th>
                <th className="px-6 py-4">Modo de Cobrança</th>
                <th className="px-6 py-4">Status Pgto</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sessoes.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-ink">{item.paciente}</td>
                  <td className="px-6 py-4 font-bold text-ink">{item.dataHora}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-ink flex items-center gap-1">
                      {item.modalidade}
                      <span title="Valor e tempo travados pela gestão">
                        <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                      </span>
                    </div>
                    <div className="text-[10px] text-muted">{item.duracao} (Fixo)</div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleAlternarModoCobranca(item.id)}
                      className={`text-[10px] font-extrabold px-3 py-1 rounded-full border transition-all ${
                        item.modoCobranca === 'PRE_SESSAO_24H'
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                          : 'bg-teal-100 text-teal-800 border-teal-200'
                      }`}
                    >
                      {item.modoCobranca === 'PRE_SESSAO_24H' ? 'Cobrar 24h Antes' : 'Cobrança Pós-Sessão'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    {item.statusPagamento === 'PAGO' ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        PAGO
                      </span>
                    ) : item.statusPagamento === 'ATRASADO' ? (
                      <div className="space-y-1">
                        <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          EM ATRASO
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEnviarDisparoCobrancaAtraso(item.paciente)}
                          className="block text-[10px] font-bold text-psi-vibrant hover:underline"
                        >
                          📲 Cobrar via Wpp
                        </button>
                      </div>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        PENDENTE
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {item.statusSessao === 'CANCELADA' ? (
                      <span className="text-[11px] font-extrabold text-rose-600">CANCELADA</span>
                    ) : item.statusSessao === 'REAGENDADA' ? (
                      <span className="text-[11px] font-extrabold text-amber-600">REAGENDADA</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setModalAcao({ tipo: 'REAGENDAR', sessaoId: item.id, pacienteNome: item.paciente })
                          }
                          className="bg-surface hover:bg-slate-100 border border-line text-ink font-bold text-[11px] px-3 py-1 rounded-xl transition-all"
                        >
                          Reagendar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setModalAcao({ tipo: 'CANCELAR', sessaoId: item.id, pacienteNome: item.paciente })
                          }
                          className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[11px] px-3 py-1 rounded-xl transition-all"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
