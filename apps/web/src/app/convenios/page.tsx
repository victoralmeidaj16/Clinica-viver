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
  const [modalNovoProjeto, setModalNovoProjeto] = useState(false);
  const [formNovoProjeto, setFormNovoProjeto] = useState({
    empresa: '',
    cnpj: '',
    pacoteSessoes: 4,
    valorPorSessao: 130,
  });

  const [projetos, setProjetos] = useState([
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

  const handleExportarFaturaConvenioPDF = (projeto: typeof projetos[0]) => {
    const htmlFatura = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Fatura Corporativa PJ — ${projeto.empresa}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
    body { font-family: 'Inter', sans-serif; padding: 40px; background: #fff; color: #1e293b; }
    .header { border-bottom: 3px solid #4338ca; padding-bottom: 20px; margin-bottom: 30px; flex-direction: row; justify-content: space-between; display: flex; }
    .title { font-size: 22px; font-weight: 900; color: #4338ca; }
    .meta { font-size: 11px; text-align: right; color: #64748b; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 16px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th { background: #4338ca; color: white; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; }
    .total-row { font-size: 16px; font-weight: 900; color: #059669; text-align: right; margin-top: 20px; }
    .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Viver Mais Psicologia</div>
      <div style="font-size: 12px; color: #64748b;">Relatório Consolidado de Atendimentos Corporativos (PJ)</div>
    </div>
    <div class="meta">
      <div><strong>Data de Emissão:</strong> ${projeto.dataEmissaoNF}</div>
      <div><strong>Nota Fiscal:</strong> ${projeto.numeroNF}</div>
    </div>
  </div>

  <div class="box">
    <div style="font-size: 14px; font-weight: 800;">Dados da Empresa Parceira</div>
    <div style="font-size: 12px; color: #475569; margin-top: 4px;"><strong>Razão Social:</strong> ${projeto.empresa}</div>
    <div style="font-size: 12px; color: #475569;"><strong>CNPJ:</strong> ${projeto.cnpj}</div>
  </div>

  <div style="font-size: 14px; font-weight: 800; margin-bottom: 8px;">Detalhamento das Sessões Beneficiárias</div>
  <table>
    <thead>
      <tr>
        <th>Descrição do Serviço</th>
        <th>Pacote por Colaborador</th>
        <th>Sessões Efetuadas</th>
        <th>Valor Unitário</th>
        <th style="text-align: right;">Total Faturado</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Psicoterapia Individual para Colaboradores</strong></td>
        <td>${projeto.pacoteSessoes} Sessões/Mês</td>
        <td>${projeto.totalSessoesEfetuadas} sessões (${projeto.pacientesAtendidos} colaboradores)</td>
        <td>R$ ${projeto.valorPorSessao.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 800;">R$ ${projeto.faturamentoTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-row">Valor Total Consolidado a Pagar: R$ ${projeto.faturamentoTotal.toFixed(2)}</div>

  <div class="footer">
    Documento emitido para fins de faturamento e comprovação fiscal — Viver Mais Psicologia (CNPJ 19.440.737/0001-53)
  </div>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlFatura);
      win.document.close();
    }
  };

  const handleCadastrarNovoProjeto = (e: React.FormEvent) => {
    e.preventDefault();
    const novo = {
      id: `PROJ-${Date.now()}`,
      empresa: formNovoProjeto.empresa,
      cnpj: formNovoProjeto.cnpj,
      pacoteSessoes: formNovoProjeto.pacoteSessoes,
      pacientesAtendidos: 0,
      totalSessoesEfetuadas: 0,
      valorPorSessao: formNovoProjeto.valorPorSessao,
      faturamentoTotal: 0,
      dataEmissaoNF: 'Hoje',
      numeroNF: `NF-e 00${Math.floor(1000 + Math.random() * 9000)}`,
      vencimentoBoleto: 'A definir',
      status: 'NF_EMITIDA',
    };
    setProjetos([novo, ...projetos]);
    setModalNovoProjeto(false);
    setFormNovoProjeto({ empresa: '', cnpj: '', pacoteSessoes: 4, valorPorSessao: 130 });
    alert(`Projeto corporativo para ${novo.empresa} cadastrado com sucesso!`);
  };

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
          onClick={() => setModalNovoProjeto(true)}
          className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Projeto Corporativo
        </button>
      </div>

      {/* Modal de Novo Projeto PJ */}
      {modalNovoProjeto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">Novo Projeto Corporativo PJ</h2>
              <button
                type="button"
                onClick={() => setModalNovoProjeto(false)}
                className="text-muted hover:text-ink text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCadastrarNovoProjeto} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Razão Social da Empresa</label>
                <input
                  type="text"
                  required
                  value={formNovoProjeto.empresa}
                  onChange={(e) => setFormNovoProjeto({ ...formNovoProjeto, empresa: e.target.value })}
                  placeholder="Ex: Weg Equipamentos Elétricos"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">CNPJ</label>
                <input
                  type="text"
                  required
                  value={formNovoProjeto.cnpj}
                  onChange={(e) => setFormNovoProjeto({ ...formNovoProjeto, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Pacote (Sessões/Mês)</label>
                  <input
                    type="number"
                    required
                    value={formNovoProjeto.pacoteSessoes}
                    onChange={(e) => setFormNovoProjeto({ ...formNovoProjeto, pacoteSessoes: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Valor / Sessão (R$)</label>
                  <input
                    type="number"
                    required
                    value={formNovoProjeto.valorPorSessao}
                    onChange={(e) => setFormNovoProjeto({ ...formNovoProjeto, valorPorSessao: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-psi-vibrant text-white font-extrabold py-3 rounded-2xl shadow-md hover:bg-psi-vibrant/90 transition-all"
              >
                CADASTRAR CONVÊNIO PJ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Projetos PJ Ativos</span>
            <h3 className="text-2xl font-black text-ink mt-1">{projetos.length} Empresas</h3>
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
        <div className="p-6 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-ink">Empresas Parceiras & Faturamento Consolidado</h3>
            <p className="text-xs text-muted">Controle de emissão de NF, boletos e exportação de fatura gerencial em PDF</p>
          </div>
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
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ação</th>
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
                  <td className="px-6 py-4">
                    {item.status === 'PAGO' ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        PAGO
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        NF EMITIDA (Boleto Venc. {item.vencimentoBoleto})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleExportarFaturaConvenioPDF(item)}
                      className="bg-surface hover:bg-slate-100 border border-line text-ink font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-psi-vibrant" />
                      Gerar Fatura PDF
                    </button>
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
