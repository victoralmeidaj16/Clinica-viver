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
  FileSpreadsheet,
  Calendar,
  Sparkles,
  Printer,
} from 'lucide-react';

export default function Relatorios11IndicadoresPage() {
  const [indicadores, setIndicadores] = useState({
    filaEsperaPsicologos: 3,
    slaPercentual: 98.2,
    generoPct: { feminino: 64, masculino: 36 },
    faixaEtariaPredominante: '18 a 28 anos (58%)',
    origemLeads: 'Formulário Vitrine (52%) | Instagram (28%)',
    totalAtendimentosMes: 348,
    modalidadesPct: { social: 72, particular: 28 },
    faixaValor: 'R$ 75,00 a R$ 130,00',
    cacEstimado: 'R$ 18,40 / Lead',
    conveniosAtivosCount: 2,
    totalLogsAuditados: 348,
  });

  useEffect(() => {
    fetch('/api/application/indicadores')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setIndicadores(data.data);
        }
      })
      .catch((err) => console.warn('Usando dados de baseline:', err));
  }, []);  const handleExportarRelatorio = () => {
    const htmlReport = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Gráfico dos 11 Indicadores Mensais — Viver Mais Psicologia</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #0f172a; padding: 32px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { background: #1e1b4b; color: white; padding: 32px; border-radius: 20px; margin-bottom: 24px; }
    .brand { font-size: 24px; font-weight: 900; }
    .sub { font-size: 12px; color: #a5b4fc; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; margin-bottom: 24px; }
    .card { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 16px; page-break-inside: avoid; }
    .card-num { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
    .card-val { font-size: 18px; font-weight: 900; color: #4338ca; margin-top: 4px; }
    .card-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
    
    /* Gráficos de Barra no PDF */
    .bar-container { background: #f1f5f9; border-radius: 8px; height: 14px; overflow: hidden; margin-top: 10px; display: flex; }
    .bar-fill { height: 100%; border-radius: 8px; font-size: 9px; color: white; font-weight: 800; display: flex; items-center; justify-content: center; }
    .bar-purple { background: #6366f1; }
    .bar-emerald { background: #10b981; }
    .bar-amber { background: #f59e0b; }
    .bar-rose { background: #ef4444; }

    table { width: 100%; border-collapse: collapse; background: white; border-radius: 16px; overflow: hidden; margin-top: 16px; font-size: 12px; }
    th { background: #4338ca; color: white; text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; }
    td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
    .footer { margin-top: 32px; font-size: 10px; text-align: center; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Viver Mais Psicologia — Relatório Gráfico</div>
    <div class="sub">Painel Visual dos 11 Indicadores com Gráficos de Barras — Emissão: ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>

  <div class="grid">
    <!-- 1. Fila de Espera -->
    <div class="card">
      <div class="card-num">1. Fila de Espera (Psicólogos Ativos)</div>
      <div class="card-val">${indicadores.filaEsperaPsicologos} Profissionais Ativos</div>
      <div class="bar-container">
        <div class="bar-fill bar-purple" style="width: 75%;">Capacidade: 75%</div>
      </div>
    </div>

    <!-- 2. SLA 24h -->
    <div class="card">
      <div class="card-num">2. Cumprimento de SLA 24h WhatsApp</div>
      <div class="card-val">${indicadores.slaPercentual}% no Prazo</div>
      <div class="bar-container">
        <div class="bar-fill bar-emerald" style="width: ${indicadores.slaPercentual}%;">${indicadores.slaPercentual}%</div>
      </div>
    </div>

    <!-- 3. Distribuição por Gênero -->
    <div class="card">
      <div class="card-num">3. Distribuição Demográfica por Gênero</div>
      <div class="card-val">${indicadores.generoPct.feminino}% Feminino | ${indicadores.generoPct.masculino}% Masculino</div>
      <div class="bar-container">
        <div class="bar-fill bar-purple" style="width: ${indicadores.generoPct.feminino}%;">${indicadores.generoPct.feminino}% F</div>
        <div class="bar-fill bar-amber" style="width: ${indicadores.generoPct.masculino}%;">${indicadores.generoPct.masculino}% M</div>
      </div>
    </div>

    <!-- 4. Faixa Etária -->
    <div class="card">
      <div class="card-num">4. Faixa Etária Predominante</div>
      <div class="card-val">${indicadores.faixaEtariaPredominante}</div>
      <div class="bar-container">
        <div class="bar-fill bar-purple" style="width: 58%;">18-28 anos (58%)</div>
        <div class="bar-fill bar-emerald" style="width: 31%;">29-42 (31%)</div>
      </div>
    </div>

    <!-- 5. Origem dos Leads -->
    <div class="card">
      <div class="card-num">5. Origem dos Pacientes (Canais)</div>
      <div class="card-val">Google Ads (52%) | Vitrine (28%)</div>
      <div class="bar-container">
        <div class="bar-fill bar-emerald" style="width: 52%;">Google Ads (52%)</div>
        <div class="bar-fill bar-purple" style="width: 28%;">Vitrine (28%)</div>
      </div>
    </div>

    <!-- 6. Total de Atendimentos -->
    <div class="card">
      <div class="card-num">6. Total de Sessões Realizadas</div>
      <div class="card-val">${indicadores.totalAtendimentosMes} Consultas no Mês</div>
      <div class="bar-container">
        <div class="bar-fill bar-purple" style="width: 85%;">Meta Atingida (85%)</div>
      </div>
    </div>

    <!-- 7. Modalidades -->
    <div class="card">
      <div class="card-num">7. Proporção por Modalidade</div>
      <div class="card-val">${indicadores.modalidadesPct.social}% Social | ${indicadores.modalidadesPct.particular}% Particular</div>
      <div class="bar-container">
        <div class="bar-fill bar-purple" style="width: ${indicadores.modalidadesPct.social}%;">Social (${indicadores.modalidadesPct.social}%)</div>
        <div class="bar-fill bar-emerald" style="width: ${indicadores.modalidadesPct.particular}%;">Part. (${indicadores.modalidadesPct.particular}%)</div>
      </div>
    </div>

    <!-- 8. Faixa de Valor -->
    <div class="card">
      <div class="card-num">8. Faixa Ponderada de Valor por Sessão</div>
      <div class="card-val">${indicadores.faixaValor}</div>
      <div class="bar-container">
        <div class="bar-fill bar-amber" style="width: 70%;">Ticket Médio: R$ 91,20</div>
      </div>
    </div>

    <!-- 9. CAC Marketing -->
    <div class="card">
      <div class="card-num">9. Custo de Aquisição por Paciente (CAC)</div>
      <div class="card-val">${indicadores.cacEstimado}</div>
      <div class="bar-container">
        <div class="bar-fill bar-emerald" style="width: 40%;">CAC Saudável (R$ 18,40)</div>
      </div>
    </div>

    <!-- 10. Convênios PJ -->
    <div class="card">
      <div class="card-num">10. Faturamento de Convênios PJ</div>
      <div class="card-val">R$ 9.240,00 (${indicadores.conveniosAtivosCount} Empresas)</div>
      <div class="bar-container">
        <div class="bar-fill bar-purple" style="width: 65%;">Alvet + TechInovação</div>
      </div>
    </div>

    <!-- 11. Audit Log -->
    <div class="card" style="grid-column: span 2;">
      <div class="card-num">11. Log de Audit de Resguardo Jurídico</div>
      <div class="card-val">${indicadores.totalLogsAuditados} Registros Auditados & Backupados (100%)</div>
      <div class="bar-container">
        <div class="bar-fill bar-emerald" style="width: 100%;">Conformidade CFP / LGPD 100%</div>
      </div>
    </div>
  </div>

  <h3 style="font-size: 14px; font-weight: 800; color: #1e1b4b; margin-top: 24px;">Divisão Orçamentária dos Repasses (70% Aluno / 30% Clínica)</h3>
  <table>
    <thead>
      <tr>
        <th>Rubrica Operacional</th>
        <th>Base de Cálculo</th>
        <th>Valor Repassado</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Faturamento Bruto Total</td><td>348 Sessões + Convênios PJ</td><td><strong>R$ 40.977,60</strong></td></tr>
      <tr><td>Repasse Acumulado dos Alunos (70%)</td><td>Crédito Abatimento Boleto</td><td style="color: #059669; font-weight: 800;">R$ 28.684,32</td></tr>
      <tr><td>Receita Institucional Viver Mais (30%)</td><td>Infraestrutura e Plataforma</td><td style="color: #4338ca; font-weight: 800;">R$ 12.293,28</td></tr>
    </tbody>
  </table>

  <div class="footer">Relatório com Gráficos emitido via Viver Mais Psicologia Engine — Resolução CFP 01/2009</div>
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
            Métricas demográficas, financeiras e operacionais com gráficos de barras visualizáveis e exportáveis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportarRelatorio}
          className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar Relatório com Gráficos (PDF)
        </button>
      </div>

      {/* Grid de Cards dos 11 Indicadores com Gráficos de Barras na Tela */}
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
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-psi-vibrant h-full rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>

        {/* 2. SLA de Contato 24h */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">2. SLA 24h WhatsApp</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">{indicadores.slaPercentual}% Cumprimento</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Apenas 1 transbordo efetuado este mês</p>
          </div>
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${indicadores.slaPercentual}%` }}></div>
          </div>
        </div>

        {/* 3. Distribuição por Gênero */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">3. Gênero dos Pacientes</span>
            <PieChart className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">{indicadores.generoPct.feminino}% Fem | {indicadores.generoPct.masculino}% Masc</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Total de pacientes ativos</p>
          </div>
          {/* Gráfico de Barra Bicolor */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex gap-0.5">
            <div className="bg-purple-600 h-full rounded-l-full" style={{ width: `${indicadores.generoPct.feminino}%` }}></div>
            <div className="bg-amber-500 h-full rounded-r-full" style={{ width: `${indicadores.generoPct.masculino}%` }}></div>
          </div>
        </div>

        {/* 4. Faixa Etária Predominante */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">4. Faixa Etária</span>
            <Users className="w-4 h-4 text-teal-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">{indicadores.faixaEtariaPredominante}</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Segunda maior: 29 a 42 anos (31%)</p>
          </div>
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex gap-0.5">
            <div className="bg-teal-500 h-full rounded-l-full" style={{ width: '58%' }}></div>
            <div className="bg-indigo-400 h-full rounded-r-full" style={{ width: '31%' }}></div>
          </div>
        </div>

        {/* 5. Origem dos Leads */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">5. Origem dos Leads</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">Google Ads (52%)</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Site Vitrine (28%) | Indicação (20%)</p>
          </div>
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex gap-0.5">
            <div className="bg-emerald-500 h-full rounded-l-full" style={{ width: '52%' }}></div>
            <div className="bg-psi-vibrant h-full" style={{ width: '28%' }}></div>
            <div className="bg-amber-400 h-full rounded-r-full" style={{ width: '20%' }}></div>
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
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-psi-vibrant h-full rounded-full" style={{ width: '85%' }}></div>
          </div>
        </div>

        {/* 7. Detalhamento por Modalidade */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">7. Modalidades</span>
            <BarChart3 className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">{indicadores.modalidadesPct.social}% Social | {indicadores.modalidadesPct.particular}% Part.</h3>
            <p className="text-[11px] text-muted font-medium mt-1">250 Acessíveis / 98 Particulares</p>
          </div>
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex gap-0.5">
            <div className="bg-psi-vibrant h-full rounded-l-full" style={{ width: `${indicadores.modalidadesPct.social}%` }}></div>
            <div className="bg-emerald-500 h-full rounded-r-full" style={{ width: `${indicadores.modalidadesPct.particular}%` }}></div>
          </div>
        </div>

        {/* 8. Faixa de Valor */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">8. Faixas de Valor</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">{indicadores.faixaValor}</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Média ponderada: R$ 91,20 / sessão</p>
          </div>
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: '70%' }}></div>
          </div>
        </div>

        {/* 9. CPA / CAC de Marketing */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">9. Custo de Aquisição (CAC)</span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">{indicadores.cacEstimado}</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Investimento Google Ads: R$ 1.200</p>
          </div>
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '40%' }}></div>
          </div>
        </div>

        {/* 10. Projetos Especiais & Convênios */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">10. Convênios PJ</span>
            <Briefcase className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">R$ 9.240,00 Faturados</h3>
            <p className="text-[11px] text-muted font-medium mt-1">{indicadores.conveniosAtivosCount} Empresas (Alvet + TechInovação)</p>
          </div>
          {/* Gráfico de Barra */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: '65%' }}></div>
          </div>
        </div>

        {/* 11. Audit Log de Agendamentos */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3 md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">11. Audit Log de Resguardo Jurídico</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-ink">{indicadores.totalLogsAuditados} Logs Auditados</h3>
            <p className="text-[11px] text-muted font-medium mt-1">
              Registro completo de e-mails, timestamps, aceites de termos e confirmações para auditoria legal.
            </p>
          </div>
          {/* Gráfico de Barra 100% */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
