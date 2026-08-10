'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle2,
  Download,
  Percent,
  FileSpreadsheet,
  Building2,
  Clock,
  Filter,
  Search,
} from 'lucide-react';

export default function MeuFinanceiroPage() {
  const [dataInicio, setDataInicio] = useState('2026-08-01');
  const [dataFim, setDataFim] = useState('2026-08-31');

  const [extrato] = useState({
    alunoNome: 'Dr. Lucas Silva (Pós-Graduação)',
    saldoAcumulado70: 441.00,
    proximaMensalidadeBruta: 890.00,
    proximaMensalidadeLiquida: 449.00,
    dataVencimentoBoleto: '10/08/2026',
    historicoTransacoes: [
      {
        id: 'PAY-89312',
        paciente: 'João Pedro Severo',
        data: '05/08/2026',
        valorSessao: 75.00,
        credito70: 52.50,
        receitaClinica30: 22.50,
        status: 'PAGO',
        formaPagamento: 'Pix Dynamic QR Code',
      },
      {
        id: 'PAY-89210',
        paciente: 'Camila Fernandes',
        data: '04/08/2026',
        valorSessao: 130.00,
        credito70: 91.00,
        receitaClinica30: 39.00,
        status: 'PAGO',
        formaPagamento: 'Cartão de Crédito 2x',
      },
      {
        id: 'PAY-88941',
        paciente: 'Roberto Mendes',
        data: '01/08/2026',
        valorSessao: 130.00,
        credito70: 91.00,
        receitaClinica30: 39.00,
        status: 'PAGO',
        formaPagamento: 'Pix Copia e Cola',
      },
      {
        id: 'PAY-88402',
        paciente: 'Ana Paula Rocha',
        data: '28/07/2026',
        valorSessao: 75.00,
        credito70: 52.50,
        receitaClinica30: 22.50,
        status: 'PAGO',
        formaPagamento: 'Pix Dynamic QR Code',
      },
      {
        id: 'PAY-88119',
        paciente: 'Fernando Souza',
        data: '25/07/2026',
        valorSessao: 220.00,
        credito70: 154.00,
        receitaClinica30: 66.00,
        status: 'PAGO',
        formaPagamento: 'Cartão de Crédito 3x',
      },
    ],
  });

  const handleFiltrarPeriodo = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Filtrando relatórios de atendimentos para o período de ${dataInicio} a ${dataFim}.`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Extrato Financeiro do Aluno</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-psi-vibrant" />
            Meu Financeiro & Relatório de Atendimentos
          </h1>
          <p className="text-xs text-muted">
            Acompanhe o registro de 70% de crédito das suas consultas para o demonstrativo de abatimento da mensalidade por período.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert('Exportando extrato filtrado por período em formato CSV...')}
          className="bg-surface hover:bg-slate-50 text-ink border border-line font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-card transition-all flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Exportar Relatório (CSV)
        </button>
      </div>

      {/* FILTRO DE PERÍODO COM DATAS (SOLICITADO POR GIULIANA) */}
      <form onSubmit={handleFiltrarPeriodo} className="bg-surface p-5 rounded-3xl border border-line shadow-card flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
          <div className="w-full sm:w-auto">
            <label className="font-bold text-ink block mb-1">Data Inicial</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-slate-50 border border-line rounded-xl p-2.5 text-ink font-semibold focus:outline-none focus:border-psi-vibrant w-full"
            />
          </div>

          <div className="w-full sm:w-auto">
            <label className="font-bold text-ink block mb-1">Data Final</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-slate-50 border border-line rounded-xl p-2.5 text-ink font-semibold focus:outline-none focus:border-psi-vibrant w-full"
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-psi-vibrant text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-md hover:bg-psi-vibrant/90 transition-all flex items-center justify-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtrar Período
        </button>
      </form>

      {/* KPI Card de Saldo de Crédito */}
      <div className="grid grid-cols-1 gap-5">
        <div className="bg-gradient-to-br from-psi-darkest to-slate-900 text-white rounded-3xl p-6 shadow-contrast relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-psi-soft/80">Saldo de Crédito de Atendimentos (70%)</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-black text-white">
              R$ {extrato.saldoAcumulado70.toFixed(2).replace('.', ',')}
            </h2>
            <p className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Acumulado no período selecionado para registro de controle
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de Atendimentos & Split */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-ink">Histórico de Atendimentos no Período</h3>
            <p className="text-xs text-muted">Transações conciliadas automaticamente via Asaas no intervalo selecionado</p>
          </div>
          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200">
            {extrato.historicoTransacoes.length} Atendimentos no Período
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">ID Transação</th>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Forma de Pgto</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4 text-emerald-700">Seu Crédito (70%)</th>
                <th className="px-6 py-4 text-slate-500">Clínica (30%)</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {extrato.historicoTransacoes.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-ink">{item.id}</td>
                  <td className="px-6 py-4 font-extrabold text-ink">{item.paciente}</td>
                  <td className="px-6 py-4 text-muted">{item.data}</td>
                  <td className="px-6 py-4 text-muted">{item.formaPagamento}</td>
                  <td className="px-6 py-4 font-bold text-ink">R$ {item.valorSessao.toFixed(2).replace('.', ',')}</td>
                  <td className="px-6 py-4 font-black text-emerald-600 bg-emerald-50/50">
                    R$ {item.credito70.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-500">
                    R$ {item.receitaClinica30.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.status}
                    </span>
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
