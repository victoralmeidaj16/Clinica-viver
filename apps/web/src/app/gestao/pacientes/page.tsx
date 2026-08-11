'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Brain,
  ShieldCheck,
  Building2,
  Clock,
  ChevronRight,
  FileText
} from 'lucide-react';
import NewPatientModal from '@/components/patients/NewPatientModal';

interface PacienteItem {
  id: string;
  nome: string;
  cpf: string;
  whatsapp: string;
  email: string;
  idade: string | number;
  rua: string;
  numeroResidencia?: string;
  bairro: string;
  cidade: string;
  estadoUf: string;
  cep: string;
  psicologoId?: string;
  psicologoNome?: string;
  servicoKey?: string;
  servicoNome?: string;
  modalidade?: string;
  paraQuemE?: string;
  opcaoAvaliacaoPsicologica?: string;
  especificarNecessidades?: boolean;
  necessidadesPaciente?: string[];
  status: 'EM_TRIAGEM' | 'ATIVO' | 'ALTA' | 'DESISTENTE';
  createdAt: string;
}

interface PsicologoSimple {
  id: string;
  nome: string;
}

export default function GestaoPacientesPage() {
  const [pacientes, setPacientes] = useState<PacienteItem[]>([]);
  const [psicologos, setPsicologos] = useState<PsicologoSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'EM_TRIAGEM' | 'ATIVO' | 'ALTA' | 'DESISTENTE'>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      // Carrega lista de pacientes da triagem / persistência
      const [respPacientes, respPsicologos] = await Promise.all([
        fetch('/api/application/patients', { cache: 'no-store' }),
        fetch('/api/application/professionals', { cache: 'no-store' }),
      ]);

      if (respPacientes.ok) {
        const bodyP = await respPacientes.json();
        const rawList = bodyP.data || bodyP;
        if (Array.isArray(rawList)) {
          setPacientes(rawList);
        }
      }

      if (respPsicologos.ok) {
        const bodyPsi = await respPsicologos.json();
        const rawPsi = bodyPsi.data || bodyPsi;
        if (Array.isArray(rawPsi)) {
          setPsicologos(rawPsi.map((p: any) => ({ id: p.id, nome: p.nome || p.displayName })));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar pacientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = pacientes.filter((p) => {
    const matchesSearch =
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.cpf?.includes(search) ||
      p.psicologoNome?.toLowerCase().includes(search.toLowerCase()) ||
      p.cidade?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'TODOS' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPacientes = pacientes.length;
  const emTriagemCount = pacientes.filter((p) => p.status === 'EM_TRIAGEM').length;
  const ativosCount = pacientes.filter((p) => p.status === 'ATIVO').length;
  const altaCount = pacientes.filter((p) => p.status === 'ALTA').length;

  const handleReatribuirPsicologo = async (pacienteId: string, novoPsicologoId: string) => {
    try {
      const resp = await fetch(`/api/application/patients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pacienteId, psicologoId: novoPsicologoId }),
      });
      if (resp.ok) {
        void loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-purple-600 font-extrabold text-xs uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Painel Administrativo da Clínica</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Gestão de Pacientes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualize o diretório completo de pacientes, status da triagem, solicitações e atribuições de psicólogo.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition-all shadow-md flex items-center gap-2 active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo Agendamento / Paciente</span>
        </button>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Registrados</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{totalPacientes}</span>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">Diretório</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Em Triagem (Aguardando)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">{emTriagemCount}</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">SLA Pendente</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Atendimentos Ativos</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600">{ativosCount}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Em Acompanhamento</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Altas Clínicas</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-indigo-600">{altaCount}</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">Concluídos</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF ou psicólogo..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-purple-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600">Status:</span>
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
            {(['TODOS', 'EM_TRIAGEM', 'ATIVO', 'ALTA', 'DESISTENTE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  statusFilter === st
                    ? 'bg-white text-purple-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'EM_TRIAGEM' ? 'Triagem' : st === 'TODOS' ? 'Todos' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Pacientes */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center text-xs text-slate-400 border border-slate-200">
          Carregando pacientes do sistema...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-xs text-slate-500 border border-slate-200 space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold">Nenhum paciente encontrado.</p>
          <p className="text-[11px] text-slate-400">Tente alterar os termos da busca ou filtro de status.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Paciente / CPF</th>
                  <th className="p-4">Contato & Endereço</th>
                  <th className="p-4">Serviço / Público</th>
                  <th className="p-4">Psicólogo Responsável</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Paciente / CPF */}
                    <td className="p-4">
                      <div className="font-extrabold text-slate-900 text-sm">{p.nome}</div>
                      <div className="text-[11px] text-slate-400">CPF: {p.cpf || 'Não informado'} | {p.idade ? `${p.idade} anos` : ''}</div>
                    </td>

                    {/* Contato & Endereço */}
                    <td className="p-4 space-y-0.5">
                      <div className="text-slate-900 font-bold">{p.whatsapp}</div>
                      <div className="text-[11px] text-slate-500">
                        {[p.rua, p.numeroResidencia ? `Nº ${p.numeroResidencia}` : '', p.bairro, p.cidade ? `${p.cidade}/${p.estadoUf}` : '']
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </td>

                    {/* Serviço / Público */}
                    <td className="p-4 space-y-1">
                      <span className="text-[11px] font-extrabold bg-purple-50 text-purple-900 px-2.5 py-0.5 rounded-md border border-purple-200 inline-block">
                        {p.servicoNome || p.servicoKey || 'Psicoterapia'}
                      </span>
                      {p.paraQuemE && (
                        <div className="text-[10px] text-slate-500 font-semibold">
                          Público: {p.paraQuemE}
                        </div>
                      )}
                      {p.opcaoAvaliacaoPsicologica && (
                        <div className="text-[10px] text-purple-700 font-bold">
                          {p.opcaoAvaliacaoPsicologica}
                        </div>
                      )}
                    </td>

                    {/* Psicólogo Responsável com Reatribuição */}
                    <td className="p-4">
                      {p.psicologoNome ? (
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>{p.psicologoNome}</span>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Aguardando Alocação
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          p.status === 'ATIVO'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'EM_TRIAGEM'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : p.status === 'ALTA'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {p.status === 'EM_TRIAGEM' ? 'Triagem' : p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para Adicionar Novo Paciente */}
      <NewPatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPatientCreated={() => {
          setIsModalOpen(false);
          void loadData();
        }}
      />
    </div>
  );
}
