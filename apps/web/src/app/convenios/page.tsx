'use client';

import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  FileText,
  Calendar,
  DollarSign,
  Plus,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default function ConveniosPage() {
  const [projetos] = useState([
    {
      id: 'PROJ-ALVET-2026',
      empresa: 'Alvet Hospital Veterinário',
      cnpj: '12.345.678/0001-90',
      pacoteSessoes: 6,
      pacientesAtendidos: 8,
      totalSessoesEfetuadas: 48,
      valorPorSessao: 130.00,
      faturamentoTotal: 6240.00,
      dataEmissaoNF: '01/08/2026',
      numeroNF: 'NF-e 004812',
      vencimentoBoleto: '15/08/2026',
      status: 'NF_EMITIDA',
    },
    {
      id: 'PROJ-TECH-2026',
      empresa: 'TechInovação Soluções em TI',
      cnpj: '98.765.432/0001-11',
      pacoteSessoes: 4,
      pacientesAtendidos: 5,
      totalSessoesEfetuadas: 20,
      valorPorSessao: 150.00,
      faturamentoTotal: 3000.00,
      dataEmissaoNF: '25/07/2026',
      numeroNF: 'NF-e 004750',
      vencimentoBoleto: '05/08/2026',
      status: 'PAGO',
    },
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Restrito à Giuliana & Financeiro</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-psi-vibrant" />
            Convênios Empresariais & Projetos PJ
          </h1>
          <p className="text-xs text-muted">
            Gestão de faturamento corporativo consolidado, emissão de Notas Fiscais e controle de boletos PJ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert('Abrir modal de novo projeto empresarial')}
          className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Projeto Corporativo
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Projetos PJ Ativos</span>
            <h3 className="text-2xl font-black text-ink mt-1">2 Empresas</h3>
          </div>
          <div className="p-3 bg-psi-vibrant/10 text-psi-vibrant rounded-2xl">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Pacientes Conveniados</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">13 Pacientes</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Faturamento PJ no Mês</span>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">R$ 9.240,00</h3>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabela de Projetos PJ */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line">
          <h3 className="font-extrabold text-base text-ink">Empresas Parceiras & Faturamento Consolidado</h3>
          <p className="text-xs text-muted">Controle de emissão de NF e liquidação de boletos corporativos</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Empresa / CNPJ</th>
                <th className="px-6 py-4">Pacote</th>
                <th className="px-6 py-4">Sessões Realizadas</th>
                <th className="px-6 py-4">Faturamento</th>
                <th className="px-6 py-4">Nota Fiscal</th>
                <th className="px-6 py-4">Vencimento Boleto</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {projetos.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-extrabold text-ink">{item.empresa}</div>
                    <div className="text-[10px] text-muted font-mono">{item.cnpj}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-ink">{item.pacoteSessoes} Sessões / Paciente</td>
                  <td className="px-6 py-4 font-bold text-psi-vibrant">
                    {item.totalSessoesEfetuadas} sessões ({item.pacientesAtendidos} pacientes)
                  </td>
                  <td className="px-6 py-4 font-black text-ink">
                    R$ {item.faturamentoTotal.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-ink">{item.numeroNF}</div>
                    <div className="text-[10px] text-muted">Emitida em {item.dataEmissaoNF}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-muted">{item.vencimentoBoleto}</td>
                  <td className="px-6 py-4">
                    {item.status === 'PAGO' ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        PAGO
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        NF EMITIDA (Aguardando Boleto)
                      </span>
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
