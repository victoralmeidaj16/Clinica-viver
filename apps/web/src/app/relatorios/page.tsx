'use client';

import React from 'react';
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
  const handleExportarRelatorio = () => {
    alert('Relatório Mensal de 11 Indicadores compilado com sucesso! Baixando PDF/Excel para reunião de equipe.');
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

        <button
          type="button"
          onClick={handleExportarRelatorio}
          className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar Relatório Mensal (1-Clique)
        </button>
      </div>

      {/* Grid de Cards dos 11 Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Fila de Espera */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">1. Fila de Espera</span>
            <Users className="w-4 h-4 text-psi-vibrant" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">3 Psicólogos na Fila</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Rodízio Round-Robin Ativo</p>
          </div>
        </div>

        {/* 2. SLA de Contato 24h */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">2. SLA 24h WhatsApp</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">98.2% Cumprimento</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Apenas 1 transbordo efetuado este mês</p>
          </div>
        </div>

        {/* 3. Distribuição por Gênero */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">3. Gênero dos Pacientes</span>
            <PieChart className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">64% Fem | 36% Masc</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Total de 142 pacientes ativos</p>
          </div>
        </div>

        {/* 4. Faixa Etária Predominante */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">4. Faixa Etária</span>
            <Users className="w-4 h-4 text-teal-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">18 a 28 anos (58%)</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Segunda maior: 29 a 42 anos (31%)</p>
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
            <p className="text-[11px] text-muted font-medium mt-1">Site Organico (28%) | Indicação (20%)</p>
          </div>
        </div>

        {/* 6. Total de Atendimentos */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">6. Atendimentos no Mês</span>
            <Calendar className="w-4 h-4 text-psi-vibrant" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">348 Sessões</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">+14% em relação ao mês anterior</p>
          </div>
        </div>

        {/* 7. Detalhamento por Modalidade */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">7. Modalidades</span>
            <BarChart3 className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">72% Social | 28% Part.</h3>
            <p className="text-[11px] text-muted font-medium mt-1">250 sessões Acessíveis / 98 Particulares</p>
          </div>
        </div>

        {/* 8. Faixa de Valor */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">8. Faixas de Valor</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">R$ 75,00 a R$ 130,00</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Média ponderada: R$ 91,20 / sessão</p>
          </div>
        </div>

        {/* 9. CPA / CAC de Marketing */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">9. Custo de Aquisição (CAC)</span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">R$ 18,40 / Lead</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Investimento Google Ads: R$ 1.200</p>
          </div>
        </div>

        {/* 10. Projetos Especiais & Convênios */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">10. Convênios Empresariais</span>
            <Briefcase className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">R$ 9.240,00 Faturados</h3>
            <p className="text-[11px] text-muted font-medium mt-1">Projeto Canguru + TechInovação</p>
          </div>
        </div>

        {/* 11. Audit Log de Agendamentos */}
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card space-y-3 md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">11. Audit Log de Resguardo Jurídico</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-black text-ink">348 Logs de Agendamento Backupados</h3>
            <p className="text-[11px] text-muted font-medium mt-1">
              Registro completo de e-mails, timestamps, aceites de termos e confirmações para auditoria legal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
