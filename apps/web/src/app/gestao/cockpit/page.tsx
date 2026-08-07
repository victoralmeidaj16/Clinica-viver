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

/** Linha da fila de alocação, já resolvida para exibição na tabela. */
interface LeadFila {
  id: string;
  paciente: string;
  telefone: string;
  modalidade: string;
  turno: string;
  psicologo: string;
  alocadoEm?: string;
  horasDecorridas: number;
  status: string;
  slaStatus: 'VERDE' | 'AMARELO' | 'VERMELHO';
}

/** Candidatura de credenciamento aguardando decisão da gestão. */
interface PsicologoPendente {
  id: string;
  nomeCompleto: string;
  crp: string;
  whatsapp: string;
  cidadeUf?: string;
  especialidade?: string;
  modalidadeAtendimento?: string;
  minibio?: string;
  status: 'EM_ANALISE' | 'APROVADO' | 'RECUSADO';
interface PsicologoCadastrado {
  id: string;
  nome: string;
  nomeSocial?: string;
  crp: string;
  whatsapp: string;
  email: string;
  fotoUrl?: string;
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  exibirNaVitrine: boolean;
  motivoDesativacao?: string;
  pacientesAtivosCount: number;
}

export default function GestaoCockpitPage() {
  const [abaAtiva, setAbaAtiva] = useState<'FILA' | 'CREDENCIAMENTOS' | 'PROFISSIONAIS'>('FILA');

  const [psicologosPendentes, setPsicologosPendentes] = useState<PsicologoPendente[]>([]);
  const [leads, setLeads] = useState<LeadFila[]>([]);
  const [profissionais, setProfissionais] = useState<PsicologoCadastrado[]>([
    {
      id: 'psi-1',
      nome: 'Dra. Camila Santos',
      nomeSocial: 'Camila Santos',
      crp: 'CRP 06/148293',
      whatsapp: '(51) 99888-7766',
      email: 'camila.santos@vivermais.com.br',
      turmaViverMais: '23A',
      posGraduacaoViverMais: 'Especialização em Psicoterapia Cognitivo-Comportamental',
      exibirNaVitrine: true,
      pacientesAtivosCount: 4,
    },
    {
      id: 'psi-2',
      nome: 'Dr. Lucas Silva',
      crp: 'CRP 06/152341',
      whatsapp: '(51) 99777-6655',
      email: 'lucas.silva@vivermais.com.br',
      turmaViverMais: '24B',
      posGraduacaoViverMais: 'Especialização em Avaliação Psicológica',
      exibirNaVitrine: false,
      motivoDesativacao: 'Limite de Pacientes Atingido (5/5)',
      pacientesAtivosCount: 5,
    },
  ]);

  const [modalEdicaoPsi, setModalEdicaoPsi] = useState<PsicologoCadastrado | null>(null);

  const toggleAtivoPsicologo = (id: string, motivoDefault: string = 'Desativação Manual') => {
    setProfissionais((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const novoStatus = !p.exibirNaVitrine;
          return {
            ...p,
            exibirNaVitrine: novoStatus,
            motivoDesativacao: novoStatus ? undefined : motivoDefault,
          };
        }
        return p;
      })
    );
  };

  const [filtroModalidade, setFiltroModalidade] = useState<string>('TODAS');
  const [filtroTurno, setFiltroTurno] = useState<string>('TODOS');
  const [filtroBusca, setFiltroBusca] = useState<string>('');

  const leadsFiltrados = leads.filter((item) => {
    const matchModalidade =
      filtroModalidade === 'TODAS' ||
      (filtroModalidade === 'SOCIAL' && item.modalidade.toLowerCase().includes('social')) ||
      (filtroModalidade === 'PARTICULAR' && item.modalidade.toLowerCase().includes('particular')) ||
      (filtroModalidade === 'AVALIACAO' && item.modalidade.toLowerCase().includes('avaliação'));

    const matchTurno =
      filtroTurno === 'TODOS' ||
      item.turno.toLowerCase().includes(filtroTurno.toLowerCase());

    const matchBusca =
      !filtroBusca.trim() ||
      item.paciente.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      item.psicologo.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      item.telefone.includes(filtroBusca);

    return matchModalidade && matchTurno && matchBusca;
  });

  const [novoLeadModal, setNovoLeadModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    nome: '',
    telefone: '',
    modalidade: 'ACESSIVEL_SOCIAL',
    turno: 'TARDE',
  });

  const handleAprovarPsicologo = (id: string) => {
    setPsicologosPendentes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'APROVADO' } : item))
    );
    alert('Psicólogo aprovado com sucesso! Acesso liberado no sistema.');
  };

  const handleRecusarPsicologo = (id: string) => {
    setPsicologosPendentes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'RECUSADO' } : item))
    );
  };

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
    const novo: LeadFila = {
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
            <span className="text-xs font-bold text-muted">Credenciamentos em Análise</span>
            <h3 className="text-2xl font-black text-purple-600 mt-1">
              {psicologosPendentes.filter((p) => p.status === 'EM_ANALISE').length} Psicólogos
            </h3>
          </div>
          <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">SLA Estourado (&gt; 24h)</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">0 Transbordos</h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setAbaAtiva('FILA')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            abaAtiva === 'FILA'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'bg-surface text-muted hover:text-ink hover:bg-slate-100 border border-line'
          }`}
        >
          <Clock className="w-4 h-4" />
          Fila de Triagem & SLA 24h
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('PROFISSIONAIS')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            abaAtiva === 'PROFISSIONAIS'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'bg-surface text-muted hover:text-ink hover:bg-slate-100 border border-line'
          }`}
        >
          <Users className="w-4 h-4" />
          Gestão de Psicólogos (Ativar/Desativar)
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('CREDENCIAMENTOS')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            abaAtiva === 'CREDENCIAMENTOS'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'bg-surface text-muted hover:text-ink hover:bg-slate-100 border border-line'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Aprovação de Psicólogos (Vitrine)
          {psicologosPendentes.filter((p) => p.status === 'EM_ANALISE').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {psicologosPendentes.filter((p) => p.status === 'EM_ANALISE').length}
            </span>
          )}
        </button>
      </div>

      {/* Conteúdo da Aba 1: Fila de Triagem */}
      {abaAtiva === 'FILA' && (
        <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden space-y-4">
          <div className="p-6 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-base text-ink">Monitoramento da Fila de Atribuição (SLA 24h)</h3>
              <p className="text-xs text-muted">Leads em andamento e contagem regressiva para confirmação via WhatsApp</p>
            </div>

            {/* Barra de Filtros Rápida */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Busca */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar paciente ou psi..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-slate-50 border border-line rounded-xl text-ink focus:outline-none focus:border-psi-vibrant w-44"
                />
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-3" />
              </div>

              {/* Filtro por Modalidade */}
              <select
                value={filtroModalidade}
                onChange={(e) => setFiltroModalidade(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-line rounded-xl font-bold text-ink focus:outline-none focus:border-psi-vibrant"
              >
                <option value="TODAS">Todas Modalidades</option>
                <option value="SOCIAL">Atendimento Social</option>
                <option value="PARTICULAR">Particular</option>
                <option value="AVALIACAO">Avaliação Psicológica</option>
              </select>

              {/* Filtro por Turno */}
              <select
                value={filtroTurno}
                onChange={(e) => setFiltroTurno(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-line rounded-xl font-bold text-ink focus:outline-none focus:border-psi-vibrant"
              >
                <option value="TODOS">Todos Turnos</option>
                <option value="MANHA">Manhã</option>
                <option value="TARDE">Tarde</option>
                <option value="NOITE">Noite</option>
              </select>
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
                {leadsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted font-semibold">
                      Nenhum lead encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  leadsFiltrados.map((item) => (
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
                        ) : (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            Atenção (21h)
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Credenciamentos de Psicólogos */}
      {abaAtiva === 'CREDENCIAMENTOS' && (
        <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden space-y-4">
          <div className="p-6 border-b border-line flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-ink">Solicitações de Credenciamento da Vitrine</h3>
              <p className="text-xs text-muted">Psicólogos que se cadastraram no site aguardando conferência do CRP e liberação de acesso</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
                <tr>
                  <th className="px-6 py-4">Psicólogo(a)</th>
                  <th className="px-6 py-4">CRP</th>
                  <th className="px-6 py-4">Contato / Localidade</th>
                  <th className="px-6 py-4">Especialidade / Modalidade</th>
                  <th className="px-6 py-4">Status do Acesso</th>
                  <th className="px-6 py-4 text-right">Ações da Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {psicologosPendentes.map((psi) => (
                  <tr key={psi.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-ink">{psi.nomeCompleto}</div>
                      <div className="text-[10px] text-muted italic line-clamp-1">{psi.minibio}</div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-psi-vibrant">{psi.crp}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-ink">{psi.whatsapp}</div>
                      <div className="text-[10px] text-muted">{psi.cidadeUf}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-ink">{psi.especialidade}</div>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {psi.modalidadeAtendimento}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {psi.status === 'EM_ANALISE' ? (
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                          Acesso em Conferência
                        </span>
                      ) : psi.status === 'APROVADO' ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                          Aprovado & Credenciado
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                          Recusado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {psi.status === 'EM_ANALISE' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleAprovarPsicologo(psi.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aprovar Acesso
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRecusarPsicologo(psi.id)}
                            className="bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 border border-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all"
                          >
                            Recusar
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400">Concluído</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      {/* Conteúdo da Aba 3: Gestão de Profissionais & Toggle Manual */}
      {abaAtiva === 'PROFISSIONAIS' && (
        <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden space-y-4">
          <div className="p-6 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-base text-ink">Psicólogos da Clínica (Visibilidade & Rodízio)</h3>
              <p className="text-xs text-muted">Ative ou desative manualmente a exibição no carrossel e no rodízio de novos pacientes</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
                <tr>
                  <th className="px-6 py-4">Psicólogo(a)</th>
                  <th className="px-6 py-4">CRP</th>
                  <th className="px-6 py-4">Turma / Pós-Graduação</th>
                  <th className="px-6 py-4">Pacientes Ativos</th>
                  <th className="px-6 py-4">Status no Rodízio</th>
                  <th className="px-6 py-4 text-right">Ação / Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {profissionais.map((psi) => (
                  <tr key={psi.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-ink">{psi.nomeSocial || psi.nome}</div>
                      <div className="text-[10px] text-muted">{psi.email} • {psi.whatsapp}</div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-psi-vibrant">{psi.crp}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-ink">Turma {psi.turmaViverMais || '24A'}</div>
                      <div className="text-[10px] text-muted line-clamp-1">{psi.posGraduacaoViverMais}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-extrabold text-ink">{psi.pacientesAtivosCount} / 5 pacientes</span>
                    </td>
                    <td className="px-6 py-4">
                      {psi.exibirNaVitrine ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                          ● Ativo na Vitrine
                        </span>
                      ) : (
                        <div>
                          <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-block">
                            ○ Desativado do Rodízio
                          </span>
                          {psi.motivoDesativacao && (
                            <p className="text-[10px] text-rose-600 font-semibold mt-1">{psi.motivoDesativacao}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleAtivoPsicologo(psi.id, 'Pausa Solicitada pela Gestão')}
                        className={`font-extrabold text-[11px] px-4 py-2 rounded-xl transition-all shadow-sm ${
                          psi.exibirNaVitrine
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {psi.exibirNaVitrine ? 'Desativar Perfil' : 'Ativar no Rodízio'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
