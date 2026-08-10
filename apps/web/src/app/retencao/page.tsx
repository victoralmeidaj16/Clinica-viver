'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  TrendingDown,
  AlertTriangle,
  UserX,
  PhoneCall,
  CheckCircle2,
  Plus,
} from 'lucide-react';

interface DesistenciaItem {
  id: string;
  pacienteNome: string;
  psicologoNome: string;
  motivo: string;
  descricaoDetalhada?: string;
  acaoSugestao?: string;
  reengajado: boolean;
  dataDesistencia: string;
}

export default function RetencaoPage() {
  const [desistencias, setDesistencias] = useState<DesistenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNovaDesistencia, setModalNovaDesistencia] = useState(false);

  const [formNovo, setFormNovo] = useState({
    pacienteNome: '',
    psicologoNome: '',
    motivo: 'FINANCEIRO',
    descricaoDetalhada: '',
    acaoSugestao: '',
  });

  const carregarDesistencias = useCallback(() => {
    fetch('/api/application/desistencias')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setDesistencias(data.data);
        }
      })
      .catch((err) => console.error('Erro ao carregar desistências:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregarDesistencias();
  }, [carregarDesistencias]);

  const handleMarcarReengajado = async (item: DesistenciaItem) => {
    try {
      const res = await fetch('/api/application/desistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MARCAR_REENGAJADO',
          id: item.id,
          pacienteNome: item.pacienteNome,
          psicologoNome: item.psicologoNome,
          motivo: item.motivo,
          descricao: item.descricaoDetalhada,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDesistencias((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, reengajado: true } : d))
        );
      }
    } catch (err) {
      console.error('Erro ao marcar reengajado:', err);
    }
  };

  const handleCriarDesistencia = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/application/desistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNovo),
      });
      const data = await res.json();
      if (data.success) {
        setModalNovaDesistencia(false);
        setFormNovo({ pacienteNome: '', psicologoNome: '', motivo: 'FINANCEIRO', descricaoDetalhada: '', acaoSugestao: '' });
        carregarDesistencias();
      }
    } catch (err) {
      console.error('Erro ao criar desistencia:', err);
    }
  };

  // Cálculos dinâmicos de KPI
  const totalDesistencias = desistencias.length;
  const totalReengajados = desistencias.filter((d) => d.reengajado).length;
  const taxaReengajamento = totalDesistencias > 0
    ? Math.round((totalReengajados / totalDesistencias) * 100)
    : 0;

  // Motivo mais frequente
  const motivosCount: Record<string, number> = {};
  desistencias.forEach((d) => {
    motivosCount[d.motivo] = (motivosCount[d.motivo] || 0) + 1;
  });
  let motivoPredominante = 'Nenhum';
  let maiorQtd = 0;
  Object.entries(motivosCount).forEach(([mot, count]) => {
    if (count > maiorQtd) {
      maiorQtd = count;
      motivoPredominante = mot === 'FINANCEIRO' ? 'Financeiro' : mot === 'INSATISFACAO_CONDUTA' ? 'Conduta' : mot;
    }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Qualidade & Retenção de Pacientes</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-rose-500" />
            Auditoria de Desistências & Reengajamento
          </h1>
          <p className="text-xs text-muted">
            Identifique as causas de abandono do tratamento, avalie a conduta clínica e execute reengajamento estratégico.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalNovaDesistencia(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Registrar Nova Desistência
        </button>
      </div>

      {/* Modal de Nova Desistência */}
      {modalNovaDesistencia && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">Registrar Auditoria de Desistência</h2>
              <button
                type="button"
                onClick={() => setModalNovaDesistencia(false)}
                className="text-muted hover:text-ink text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCriarDesistencia} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Nome do Paciente <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formNovo.pacienteNome}
                  onChange={(e) => setFormNovo({ ...formNovo, pacienteNome: e.target.value })}
                  placeholder="Nome do paciente"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Psicólogo Responsável <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formNovo.psicologoNome}
                  onChange={(e) => setFormNovo({ ...formNovo, psicologoNome: e.target.value })}
                  placeholder="Nome do psicólogo"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Motivo Principal <span className="text-rose-500">*</span></label>
                <select
                  value={formNovo.motivo}
                  onChange={(e) => setFormNovo({ ...formNovo, motivo: e.target.value })}
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink font-bold outline-none focus:border-rose-500"
                >
                  <option value="FINANCEIRO">Financeiro / Valor da Sessão</option>
                  <option value="INSATISFACAO_CONDUTA">Insatisfação com Conduta Clínica</option>
                  <option value="TROCA_ABORDAGEM">Busca por Outra Abordagem</option>
                  <option value="MOTIVOS_PESSOAIS">Motivos Pessoais / Mudança de Rotina</option>
                  <option value="OUTRO">Outro Motivo</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Detalhes da Saída</label>
                <textarea
                  rows={2}
                  value={formNovo.descricaoDetalhada}
                  onChange={(e) => setFormNovo({ ...formNovo, descricaoDetalhada: e.target.value })}
                  placeholder="Descreva o feedback ou motivo relatado pelo paciente..."
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-rose-500"
                ></textarea>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Ação Sugerida de Reengajamento</label>
                <input
                  type="text"
                  value={formNovo.acaoSugestao}
                  onChange={(e) => setFormNovo({ ...formNovo, acaoSugestao: e.target.value })}
                  placeholder="Ex: Ofertar modalidade social / trocar de profissional"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-rose-600 text-white font-extrabold py-3 rounded-2xl shadow-md hover:bg-rose-700 transition-all"
              >
                REGISTRAR EM AUDITORIA
              </button>
            </form>
          </div>
        </div>
      )}

      {/* KPI Cards Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Total de Desistências</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{totalDesistencias} Registros</h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Motivo Predominante</span>
            <h3 className="text-2xl font-black text-ink mt-1">{motivoPredominante} ({totalDesistencias > 0 ? Math.round((maiorQtd / totalDesistencias) * 100) : 0}%)</h3>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Taxa de Reengajamento</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{taxaReengajamento}% Sucesso</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Lista de Fila de Auditoria */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line">
          <h3 className="font-extrabold text-base text-ink">Fila de Ação de Reengajamento & Controle de Qualidade</h3>
          <p className="text-xs text-muted">Acompanhe os feedbacks dos pacientes desistentes para tomada de decisão</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Psicólogo</th>
                <th className="px-6 py-4">Motivo da Saída</th>
                <th className="px-6 py-4">Detalhes da Abordagem</th>
                <th className="px-6 py-4">Ação Sugerida</th>
                <th className="px-6 py-4 text-right">Status / Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted font-semibold">
                    Carregando registros de retenção...
                  </td>
                </tr>
              ) : desistencias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted font-semibold">
                    Nenhuma desistência auditada até o momento.
                  </td>
                </tr>
              ) : (
                desistencias.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-extrabold text-ink">{item.pacienteNome}</td>
                    <td className="px-6 py-4 font-bold text-psi-vibrant">{item.psicologoNome}</td>
                    <td className="px-6 py-4">
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-rose-200">
                        {item.motivo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted max-w-xs">{item.descricaoDetalhada || 'Sem observações adicionais'}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{item.acaoSugestao || 'Contato via WhatsApp'}</td>
                    <td className="px-6 py-4 text-right">
                      {item.reengajado ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Reengajado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarcarReengajado(item)}
                          className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-md transition-all inline-flex items-center gap-1"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          Marcar como Reengajado
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
