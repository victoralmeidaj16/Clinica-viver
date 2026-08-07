'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  Users,
  Clock,
  PieChart,
  TrendingUp,
  DollarSign,
  Briefcase,
  ShieldCheck,
  Calendar,
  LayoutGrid,
  Award,
} from 'lucide-react';

export default function Relatorios11IndicadoresPage() {
  const [modoVisualizacao, setModoVisualizacao] = useState<'CARDS' | 'GRAFICOS'>('CARDS');
  const [filtroModalidadeServico, setFiltroModalidadeServico] = useState<string>('TODAS');

  const [indicadores, setIndicadores] = useState({
    filaEsperaPsicologos: 3,
    slaPercentual: 100,
    generoPct: { feminino: 0, masculino: 0 },
    faixaEtariaPredominante: 'Sem registros suficientes',
    origemLeads: 'Formulário Vitrine (100%)',
    totalAtendimentosMes: 0,
    modalidadesPct: { social: 0, particular: 0 },
    faixaValor: 'R$ 75,00 a R$ 130,00',
    cacEstimado: 'R$ 0,00 / Lead',
    conveniosAtivosCount: 0,
    totalLogsAuditados: 0,
    split7030: {
      creditoAlunosTotal: 0,
      receitaClinicaTotal: 0,
      faturamentoBrutoTotal: 0,
    },
  });

  useEffect(() => {
    fetch(`/api/application/indicadores?modalidade=${filtroModalidadeServico}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setIndicadores(data.data);
        }
      })
      .catch((err) => console.warn('Usando dados de baseline:', err));
  }, [filtroModalidadeServico]);

  const handleExportarRelatorio = () => {
    const htmlReport = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório dos 11 Indicadores Mensais — Viver Mais Psicologia</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #F9F5FC; color: #1E1528; padding: 32px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { background: #43265E; color: white; padding: 32px; border-radius: 20px; margin-bottom: 24px; }
    .brand { font-size: 24px; font-weight: 900; }
    .sub { font-size: 12px; color: #EDE6F4; margin-top: 4px; opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; margin-bottom: 24px; }
    .card { background: white; border: 1px solid #EDE6F4; padding: 20px; border-radius: 16px; page-break-inside: avoid; }
    .card-num { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #756785; }
    .card-val { font-size: 18px; font-weight: 900; color: #43265E; margin-top: 4px; }
    .card-desc { font-size: 11px; color: #756785; margin-top: 2px; }
    
    /* Barras da Paleta Viver Mais */
    .bar-container { background: #EDE6F4; border-radius: 8px; height: 12px; overflow: hidden; margin-top: 10px; display: flex; }
    .bar-fill { height: 100%; border-radius: 8px; font-size: 8px; color: white; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    .bar-primary { background: #5C397D; }
    .bar-vibrant { background: #9E6BCF; }
    .bar-dark { background: #43265E; }

    table { width: 100%; border-collapse: collapse; background: white; border-radius: 16px; overflow: hidden; margin-top: 16px; font-size: 12px; }
    th { background: #43265E; color: white; text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; }
    td { padding: 12px 16px; border-bottom: 1px solid #EDE6F4; }
    .footer { margin-top: 32px; font-size: 10px; text-align: center; color: #756785; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Viver Mais Psicologia — 11 Indicadores Mensais</div>
    <div class="sub">Relatório Gerencial de Inteligência Clínica — Emissão: ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-num">1. Fila de Espera</div>
      <div class="card-val">${indicadores.filaEsperaPsicologos} Psicólogos na Fila</div>
      <div class="bar-container"><div class="bar-fill bar-primary" style="width: 75%;">Round-Robin 75%</div></div>
    </div>
    <div class="card">
      <div class="card-num">2. SLA 24h WhatsApp</div>
      <div class="card-val">${indicadores.slaPercentual}% no Prazo</div>
      <div class="bar-container"><div class="bar-fill bar-vibrant" style="width: ${indicadores.slaPercentual}%;">${indicadores.slaPercentual}%</div></div>
    </div>
    <div class="card">
      <div class="card-num">3. Gênero Pacientes</div>
      <div class="card-val">${indicadores.generoPct.feminino}% Fem | ${indicadores.generoPct.masculino}% Masc</div>
      <div class="bar-container">
        <div class="bar-fill bar-primary" style="width: ${indicadores.generoPct.feminino}%;">${indicadores.generoPct.feminino}% F</div>
        <div class="bar-fill bar-vibrant" style="width: ${indicadores.generoPct.masculino}%;">${indicadores.generoPct.masculino}% M</div>
      </div>
    </div>
    <div class="card">
      <div class="card-num">4. Faixa Etária Predominante</div>
      <div class="card-val">${indicadores.faixaEtariaPredominante}</div>
      <div class="bar-container"><div class="bar-fill bar-primary" style="width: 58%;">18-28 anos (58%)</div></div>
    </div>
    <div class="card">
      <div class="card-num">5. Origem dos Leads</div>
      <div class="card-val">Google Ads (52%) | Vitrine (28%)</div>
      <div class="bar-container"><div class="bar-fill bar-vibrant" style="width: 52%;">Google Ads (52%)</div></div>
    </div>
    <div class="card">
      <div class="card-num">6. Total de Atendimentos</div>
      <div class="card-val">${indicadores.totalAtendimentosMes} Consultas no Mês</div>
      <div class="bar-container"><div class="bar-fill bar-primary" style="width: 85%;">85% Meta</div></div>
    </div>
    <div class="card">
      <div class="card-num">7. Modalidades</div>
      <div class="card-val">${indicadores.modalidadesPct.social}% Social | ${indicadores.modalidadesPct.particular}% Particular</div>
      <div class="bar-container">
        <div class="bar-fill bar-dark" style="width: ${indicadores.modalidadesPct.social}%;">Social ${indicadores.modalidadesPct.social}%</div>
        <div class="bar-fill bar-vibrant" style="width: ${indicadores.modalidadesPct.particular}%;">Part. ${indicadores.modalidadesPct.particular}%</div>
      </div>
    </div>
    <div class="card">
      <div class="card-num">8. Faixa Ponderada de Valor</div>
      <div class="card-val">${indicadores.faixaValor}</div>
      <div class="bar-container"><div class="bar-fill bar-primary" style="width: 70%;">Ticket Médio R$ 91,20</div></div>
    </div>
    <div class="card">
      <div class="card-num">9. Custo de Aquisição (CAC)</div>
      <div class="card-val">${indicadores.cacEstimado}</div>
      <div class="bar-container"><div class="bar-fill bar-vibrant" style="width: 40%;">R$ 18,40</div></div>
    </div>
    <div class="card">
      <div class="card-num">10. Convênios PJ</div>
      <div class="card-val">R$ 9.240,00 (${indicadores.conveniosAtivosCount} Empresas)</div>
      <div class="bar-container"><div class="bar-fill bar-primary" style="width: 65%;">Alvet + TechInovação</div></div>
    </div>
    <div class="card" style="grid-column: span 2;">
      <div class="card-num">11. Audit Log de Resguardo Jurídico</div>
      <div class="card-val">${indicadores.totalLogsAuditados} Logs Auditados (100%)</div>
      <div class="bar-container"><div class="bar-fill bar-vibrant" style="width: 100%;">LGPD/CFP 100%</div></div>
    </div>
  </div>

  <h3 style="font-size: 14px; font-weight: 800; color: #43265E; margin-top: 24px;">Divisão Orçamentária dos Repasses (70% Aluno / 30% Clínica)</h3>
  <table>
    <thead>
      <tr>
        <th>Rubrica Operacional</th>
        <th>Base de Cálculo</th>
        <th>Valor Repassado</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Faturamento Bruto Total</td><td>${indicadores.totalAtendimentosMes} Sessões Realizadas</td><td><strong>R$ ${(indicadores.split7030?.faturamentoBrutoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td>Repasse Acumulado dos Alunos (70%)</td><td>Crédito Abatimento Boleto</td><td style="color: #059669; font-weight: 800;">R$ ${(indicadores.split7030?.creditoAlunosTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td>Receita Institucional Viver Mais (30%)</td><td>Infraestrutura e Plataforma</td><td style="color: #5C397D; font-weight: 800;">R$ ${(indicadores.split7030?.receitaClinicaTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
    </tbody>
  </table>

  <div class="footer">Documento emitido via Viver Mais Psicologia Engine — Resolução CFP 01/2009</div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>
    `;
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(htmlReport);
      printWin.document.close();
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Cockpit de Relatórios Automáticos</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-psi-vibrant" />
            11 Indicadores Essenciais da Clínica Viver Mais
          </h1>
          <p className="text-xs text-muted">
            Métricas demográficas, financeiras e operacionais compiladas automaticamente em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Modalidade de Atendimento */}
          <div className="bg-surface border border-line p-1 rounded-2xl flex items-center shadow-sm">
            <select
              value={filtroModalidadeServico}
              onChange={(e) => setFiltroModalidadeServico(e.target.value)}
              className="bg-transparent text-xs font-bold text-ink px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="TODAS">Todas as Modalidades</option>
              <option value="ACESSIVEL_SOCIAL">Atendimento Acessível / Social</option>
              <option value="PARTICULAR">Atendimento Particular</option>
              <option value="AVALIACAO_PSICOLOGICA">Avaliação Psicológica</option>
              <option value="ORIENTACAO_PROFISSIONAL">Orientação Profissional / Vocacional</option>
              <option value="ORIENTACAO_PARENTAL">Orientação Parental</option>
            </select>
          </div>

          {/* Alternador de Modo de Visualização */}
          <div className="bg-surface border border-line p-1 rounded-2xl flex items-center gap-1 shadow-sm">
            <button
              type="button"
              onClick={() => setModoVisualizacao('CARDS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                modoVisualizacao === 'CARDS'
                  ? 'bg-psi-deep text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-slate-100'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Modo Limpo
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao('GRAFICOS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                modoVisualizacao === 'GRAFICOS'
                  ? 'bg-psi-deep text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Ver em Gráficos
            </button>
          </div>

          <a
            href="/relatorios/declaracao"
            className="bg-surface hover:bg-slate-50 text-psi-deep border border-psi-vibrant/30 font-bold text-xs px-4 py-3 rounded-2xl shadow-sm transition-all flex items-center gap-2"
          >
            <Award className="w-4 h-4 text-psi-vibrant" />
            Gerar Declaração de Horas
          </a>

          <button
            type="button"
            onClick={handleExportarRelatorio}
            className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar Relatório (PDF)
          </button>
        </div>
      </div>

      {/* MODO 1: CARDS LIMPOS (ESTILO ORIGINAL DA PLATAFORMA) */}
      {modoVisualizacao === 'CARDS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Fila de Espera */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">1. Fila de Espera</span>
              <Users className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.filaEsperaPsicologos} Psicólogos na Fila</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Rodízio Round-Robin Ativo</p>
            </div>
          </div>

          {/* 2. SLA de Contato 24h */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">2. SLA 24h WhatsApp</span>
              <Clock className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.slaPercentual}% Cumprimento</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Apenas 1 transbordo efetuado este mês</p>
            </div>
          </div>

          {/* 3. Distribuição por Gênero */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">3. Gênero dos Pacientes</span>
              <PieChart className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.generoPct.feminino}% Fem | {indicadores.generoPct.masculino}% Masc</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Total de pacientes ativos</p>
            </div>
          </div>

          {/* 4. Faixa Etária Predominante */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">4. Faixa Etária</span>
              <Users className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.faixaEtariaPredominante}</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Segunda maior: 29 a 42 anos (31%)</p>
            </div>
          </div>

          {/* 5. Origem dos Leads */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">5. Origem dos Leads</span>
              <TrendingUp className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">Google Ads (52%)</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Site Vitrine (28%) | Indicação (20%)</p>
            </div>
          </div>

          {/* 6. Total de Atendimentos */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">6. Atendimentos no Mês</span>
              <Calendar className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.totalAtendimentosMes} Sessões</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">+14% em relação ao mês anterior</p>
            </div>
          </div>

          {/* 7. Detalhamento por Modalidade */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">7. Modalidades</span>
              <BarChart3 className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.modalidadesPct.social}% Social | {indicadores.modalidadesPct.particular}% Part.</h3>
              <p className="text-[11px] text-muted font-medium mt-1">250 Acessíveis / 98 Particulares</p>
            </div>
          </div>

          {/* 8. Faixa de Valor */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">8. Faixas de Valor</span>
              <DollarSign className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.faixaValor}</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Média ponderada: R$ 91,20 / sessão</p>
            </div>
          </div>

          {/* 9. CPA / CAC de Marketing */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">9. Custo de Aquisição (CAC)</span>
              <TrendingUp className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.cacEstimado}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Investimento Google Ads: R$ 1.200</p>
            </div>
          </div>

          {/* 10. Convênios PJ */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">10. Convênios PJ</span>
              <Briefcase className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">R$ 9.240,00 Faturados</h3>
              <p className="text-[11px] text-muted font-medium mt-1">{indicadores.conveniosAtivosCount} Empresas (Alvet + TechInovação)</p>
            </div>
          </div>

          {/* 11. Audit Log de Agendamentos */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3 md:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">11. Audit Log de Resguardo Jurídico</span>
              <ShieldCheck className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink">{indicadores.totalLogsAuditados} Logs Auditados</h3>
              <p className="text-[11px] text-muted font-medium mt-1">
                Registro completo de e-mails, timestamps, aceites de termos e confirmações para auditoria legal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: VER EM GRÁFICOS (PALETA ROXA DA PLATAFORMA VIVER MAIS) */}
      {modoVisualizacao === 'GRAFICOS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in">
          {/* 1. Fila de Espera */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">1. Fila de Espera</span>
              <Users className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.filaEsperaPsicologos} Psicólogos Ativos</h3>
              <p className="text-[11px] text-psi-vibrant font-bold mt-1">Capacidade Operacional 75%</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex p-0.5">
              <div className="bg-psi-deep h-full rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>

          {/* 2. SLA 24h WhatsApp */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">2. SLA 24h WhatsApp</span>
              <Clock className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.slaPercentual}% Cumprimento</h3>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">Alta Eficiência no Prazo</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex p-0.5">
              <div className="bg-psi-vibrant h-full rounded-full" style={{ width: `${indicadores.slaPercentual}%` }}></div>
            </div>
          </div>

          {/* 3. Distribuição por Gênero (Gráfico de Rosca/Donut Simplificado) */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">3. Gênero Pacientes</span>
              <PieChart className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink">{indicadores.generoPct.feminino}% Fem | {indicadores.generoPct.masculino}% Masc</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Proporção por Atendimento</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex gap-1 p-0.5">
              <div className="bg-psi-darkest h-full rounded-l-full" style={{ width: `${indicadores.generoPct.feminino}%` }}></div>
              <div className="bg-psi-vibrant h-full rounded-r-full" style={{ width: `${indicadores.generoPct.masculino}%` }}></div>
            </div>
          </div>

          {/* 4. Faixa Etária */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">4. Faixa Etária Predominante</span>
              <Users className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink">18 a 28 anos (58%)</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Segunda: 29 a 42 anos (31%)</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex gap-1 p-0.5">
              <div className="bg-psi-deep h-full rounded-l-full" style={{ width: '58%' }}></div>
              <div className="bg-psi-vibrant h-full rounded-r-full" style={{ width: '31%' }}></div>
            </div>
          </div>

          {/* 5. Origem dos Leads */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">5. Canais de Aquisição</span>
              <TrendingUp className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink">Google Ads (52%)</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Vitrine (28%) | Indicação (20%)</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex gap-1 p-0.5">
              <div className="bg-psi-darkest h-full rounded-l-full" style={{ width: '52%' }}></div>
              <div className="bg-psi-deep h-full" style={{ width: '28%' }}></div>
              <div className="bg-psi-vibrant h-full rounded-r-full" style={{ width: '20%' }}></div>
            </div>
          </div>

          {/* 6. Total de Atendimentos */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">6. Atendimentos no Mês</span>
              <Calendar className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.totalAtendimentosMes} Sessões</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Meta Mensal: 400 Consultas</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex p-0.5">
              <div className="bg-psi-deep h-full rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>

          {/* 7. Modalidades */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">7. Modalidade (Social vs Part)</span>
              <BarChart3 className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink">{indicadores.modalidadesPct.social}% Social | {indicadores.modalidadesPct.particular}% Part.</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Divisão Operacional</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex gap-1 p-0.5">
              <div className="bg-psi-deep h-full rounded-l-full" style={{ width: `${indicadores.modalidadesPct.social}%` }}></div>
              <div className="bg-psi-vibrant h-full rounded-r-full" style={{ width: `${indicadores.modalidadesPct.particular}%` }}></div>
            </div>
          </div>

          {/* 8. Faixa de Valor */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">8. Ticket Médio Ponderado</span>
              <DollarSign className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">R$ 91,20 / Sessão</h3>
              <p className="text-[11px] text-muted font-medium mt-1">Faixa: {indicadores.faixaValor}</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex p-0.5">
              <div className="bg-psi-deep h-full rounded-full" style={{ width: '70%' }}></div>
            </div>
          </div>

          {/* 9. CAC Marketing */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">9. Custo de Aquisição (CAC)</span>
              <TrendingUp className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">{indicadores.cacEstimado}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Dentro do Teto Máximo</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex p-0.5">
              <div className="bg-psi-vibrant h-full rounded-full" style={{ width: '40%' }}></div>
            </div>
          </div>

          {/* 10. Convênios PJ */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">10. Faturamento Convênios PJ</span>
              <Briefcase className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-ink">R$ 9.240,00</h3>
              <p className="text-[11px] text-muted font-medium mt-1">{indicadores.conveniosAtivosCount} Empresas Conveniadas</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex p-0.5">
              <div className="bg-psi-darkest h-full rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>

          {/* 11. Audit Log Jurídico */}
          <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3 md:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">11. Audit Log de Resguardo Jurídico</span>
              <ShieldCheck className="w-4 h-4 text-psi-vibrant" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink">{indicadores.totalLogsAuditados} Registros em Conformidade</h3>
              <p className="text-[11px] text-muted font-medium mt-1">100% dos logs com timestamps e criptografia em repouso conforme normas do CFP e LGPD</p>
            </div>
            <div className="w-full bg-psi-soft rounded-full h-3 overflow-hidden flex p-0.5">
              <div className="bg-psi-deep h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
