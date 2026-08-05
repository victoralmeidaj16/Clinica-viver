'use client';

import React, { useState } from 'react';
import {
  Shield,
  Clock,
  UserCheck,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Search,
  Filter,
  Users,
  Building2,
  ArrowRightLeft,
} from 'lucide-react';

export default function GestaoCockpitPage() {
  const [leads, setLeads] = useState([
    {
      id: 'lead-101',
      paciente: 'João Pedro Severo',
      telefone: '(51) 99823-4411',
      modalidade: 'Atendimento Acessível (Social)',
      turno: 'Tarde',
      psicologo: 'Dr. Lucas Silva',
      alocadoEm: '05/08/2026 08:30',
      horasDecorridas: 3.5,
      status: 'AGUARDANDO_CONTATO',
      slaStatus: 'VERDE', // VERDE (< 12h), AMARELO (12h-20h), VERMELHO (> 20h)
    },
    {
      id: 'lead-102',
      paciente: 'Camila Fernandes',
      telefone: '(51) 99711-2233',
      modalidade: 'Atendimento Particular',
      turno: 'Manhã',
      psicologo: 'Dra. Mariana Costa',
      alocadoEm: '04/08/2026 14:00',
      horasDecorridas: 21.5,
      status: 'AGUARDANDO_CONTATO',
      slaStatus: 'AMARELO',
    },
    {
      id: 'lead-103',
      paciente: 'Roberto Mendes',
      telefone: '(51) 99123-9988',
      modalidade: 'Avaliação Psicológica',
      turno: 'Noite',
      psicologo: 'Dr. Gabriel Souza',
      alocadoEm: '04/08/2026 08:00',
      horasDecorridas: 27.5,
      status: 'TRANSBORDADO',
      slaStatus: 'VERMELHO',
    },
  ]);

  const [novoLeadModal, setNovoLeadModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    nome: '',
    telefone: '',
    modalidade: 'ACESSIVEL_SOCIAL',
    turno: 'TARDE',
  });

  const handleForcarTransbordo = (leadId: string) => {
    setLeads((prev) =>
      prev.map((item) =>
        item.id === leadId
          ? {
              ...item,
              psicologo: 'Dra. Patricia Lima (Transbordado)',
              status: 'AGUARDANDO_CONTATO',
              horasDecorridas: 0.1,
              slaStatus: 'VERDE',
            }
          : item
      )
    );
  };

  const handleCadastrarLeadManual = (e: React.FormEvent) => {
    e.preventDefault();
    const novo = {
      id: `lead-manual-${Date.now()}`,
      paciente: manualForm.nome,
      telefone: manualForm.telefone,
      modalidade: manualForm.modalidade === 'ACESSIVEL_SOCIAL' ? 'Atendimento Acessível' : 'Particular',
      turno: manualForm.turno,
      psicologo: 'Dr. Lucas Silva (Fila Circular)',
      alocadoEm: 'Hoje (Manual)',
      horasDecorridas: 0.1,
      status: 'AGUARDANDO_CONTATO',
      slaStatus: 'VERDE',
    };
    setLeads([novo, ...leads]);
    setNovoLeadModal(false);
    setManualForm({ nome: '', telefone: '', modalidade: 'ACESSIVEL_SOCIAL', turno: 'TARDE' });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Cockpit da Gestão — Giuliana & Diretoria</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <Shield className="w-6 h-6 text-psi-vibrant" />
            Fila Inteligente & Monitoramento de SLA 24h
          </h1>
          <p className="text-xs text-muted">
            Acompanhe a distribuição circular de novos pacientes, alertas de estouro de prazo e transbordo em tempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNovoLeadModal(true)}
          className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Cadastro Manual de Lead (WhatsApp)
        </button>
      </div>

      {/* Modal de Cadastrar Lead Manual */}
      {novoLeadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">Inserção Manual de Lead</h2>
              <button
                type="button"
                onClick={() => setNovoLeadModal(false)}
                className="text-muted hover:text-ink text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCadastrarLeadManual} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Nome do Paciente</label>
                <input
                  type="text"
                  required
                  value={manualForm.nome}
                  onChange={(e) => setManualForm({ ...manualForm, nome: e.target.value })}
                  placeholder="Ex: Pedro Henrique"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">WhatsApp</label>
                <input
                  type="text"
                  required
                  value={manualForm.telefone}
                  onChange={(e) => setManualForm({ ...manualForm, telefone: e.target.value })}
                  placeholder="(51) 99999-9999"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Modalidade</label>
                  <select
                    value={manualForm.modalidade}
                    onChange={(e) => setManualForm({ ...manualForm, modalidade: e.target.value })}
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  >
                    <option value="ACESSIVEL_SOCIAL">Acessível / Social</option>
                    <option value="PARTICULAR">Particular</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-ink block mb-1">Turno</label>
                  <select
                    value={manualForm.turno}
                    onChange={(e) => setManualForm({ ...manualForm, turno: e.target.value })}
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  >
                    <option value="MANHA">Manhã</option>
                    <option value="TARDE">Tarde</option>
                    <option value="NOITE">Noite</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-psi-vibrant text-white font-extrabold py-3 rounded-2xl shadow-md hover:bg-psi-vibrant/90 transition-all"
              >
                ALOCAR NA FILA ROUND-ROBIN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* KPI Cards SLA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Aguardando Contato (&lt; 12h)</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">1 Lead</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Alerta de Prazo (12h - 20h)</span>
            <h3 className="text-2xl font-black text-amber-600 mt-1">1 Lead</h3>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">SLA Estourado (&gt; 24h)</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">1 Transbordo</h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabela da Fila */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-ink">Monitoramento da Fila de Atribuição (SLA 24h)</h3>
            <p className="text-xs text-muted">Leads em andamento e contagem regressiva para confirmação via WhatsApp</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Telefone</th>
                <th className="px-6 py-4">Modalidade / Turno</th>
                <th className="px-6 py-4">Psicólogo Alocado</th>
                <th className="px-6 py-4">Tempo Decorrido</th>
                <th className="px-6 py-4">SLA Status</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-ink">{item.paciente}</td>
                  <td className="px-6 py-4 text-muted">{item.telefone}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-ink">{item.modalidade}</div>
                    <div className="text-[10px] text-muted">{item.turno}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-psi-vibrant">{item.psicologo}</td>
                  <td className="px-6 py-4 font-mono font-bold text-ink">{item.horasDecorridas}h</td>
                  <td className="px-6 py-4">
                    {item.slaStatus === 'VERDE' ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                        Normal (&lt; 12h)
                      </span>
                    ) : item.slaStatus === 'AMARELO' ? (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                        Atenção (21h)
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                        Transbordado (&gt; 24h)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleForcarTransbordo(item.id)}
                      className="bg-surface hover:bg-slate-100 border border-line text-ink font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-psi-vibrant" />
                      Forçar Transbordo
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
