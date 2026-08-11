'use client';

import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  Search,
  UserPlus,
  Brain,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  Sparkles,
  Filter,
  GraduationCap,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { LISTA_NECESSIDADES } from '@/app/vitrine/page';
import { BrazilLocationFields } from '@/components/forms/BrazilLocationFields';
import { GenderFields } from '@/components/forms/GenderFields';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { validateGender } from '@/lib/gender';

interface PsicologoItem {
  id: string;
  nome: string;
  crp: string;
  whatsapp: string;
  email: string;
  cidade: string;
  estadoUf: string;
  genero: string;
  generoOutro?: string;
  turma: string;
  atendimentoPreferencia: 'PARTICULAR' | 'SOCIAL' | 'AMBOS';
  servicosPrestados: string[];
  publicoAlvo: string[];
  publicoAlvoOutro?: string;
  especificarNecessidades?: boolean;
  necessidadesAtendidas?: string[];
  necessidadesOutro?: string;
  imagemUrl?: string;
  limitePacientesAtivos: number;
  pacientesAtivosCount: number;
  exibirNaVitrine: boolean;
  createdAt: string;
}

export default function GestaoPsicologosPage() {
  const [psicologos, setPsicologos] = useState<PsicologoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ATIVOS' | 'INATIVOS'>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form de novo psicólogo (Admin)
  const [form, setForm] = useState({
    nome: '',
    crp: '',
    whatsapp: '',
    email: '',
    cidade: '',
    estadoUf: 'SC',
    genero: 'Feminino',
    generoOutro: '',
    turma: '24A',
    atendimentoPreferencia: 'AMBOS' as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
    servicosPrestados: ['Atendimento Psicológico'],
    publicoAlvo: ['Adulto'],
    publicoAlvoOutro: '',
    especificarNecessidades: false,
    necessidadesAtendidas: [] as string[],
    necessidadesOutro: '',
    imagemUrl: '',
    limitePacientesAtivos: 10,
    exibirNaVitrine: true,
  });

  const loadPsicologos = async () => {
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo/public', { cache: 'no-store' });
      const body = await resp.json();
      if (body.success && Array.isArray(body.data)) {
        setPsicologos(body.data);
      }
    } catch (err) {
      console.error('Erro ao carregar psicólogos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPsicologos();
  }, []);

  const filtered = psicologos.filter((p) => {
    const matchesSearch =
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.crp.toLowerCase().includes(search.toLowerCase()) ||
      p.cidade.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'TODOS' ||
      (statusFilter === 'ATIVOS' && p.exibirNaVitrine) ||
      (statusFilter === 'INATIVOS' && !p.exibirNaVitrine);
    return matchesSearch && matchesStatus;
  });

  const totalCapacidade = psicologos.reduce((acc, curr) => acc + (curr.limitePacientesAtivos || 0), 0);
  const totalPacientesAtivos = psicologos.reduce((acc, curr) => acc + (curr.pacientesAtivosCount || 0), 0);
  const ativosCount = psicologos.filter((p) => p.exibirNaVitrine).length;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, imagemUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePsicologo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeBrazilPhone(form.whatsapp)) {
      alert('Informe um telefone válido com DDD.');
      return;
    }
    if (!validateGender(form.genero, form.generoOutro)) {
      alert('Selecione o gênero.');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (data.success) {
        alert('Psicólogo cadastrado com sucesso!');
        setIsModalOpen(false);
        void loadPsicologos();
      } else {
        alert('Erro ao cadastrar psicólogo.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar psicólogo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header com Ações e Título */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-purple-600 font-extrabold text-xs uppercase tracking-wider">
            <UserCheck className="w-4 h-4" />
            <span>Gestão da Equipe Clínica</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Psicólogos Credenciados</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie o corpo clínico, limites de vagas, preferências de atendimento e turmas Viver Mais Psicologia.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition-all shadow-md flex items-center gap-2 active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Psicólogo</span>
        </button>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total de Psicólogos</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{psicologos.length}</span>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">Cadastrados</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Profissionais Ativos</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600">{ativosCount}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Visíveis na Vitrine</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Capacidade Total</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-purple-900">{totalCapacidade}</span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">Vagas Máximas</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pacientes Ativos</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-indigo-600">{totalPacientesAtivos}</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">Em Atendimento</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CRP ou cidade..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-purple-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600">Status:</span>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {(['TODOS', 'ATIVOS', 'INATIVOS'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  statusFilter === st
                    ? 'bg-white text-purple-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Cards dos Psicólogos */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center text-xs text-slate-400 border border-slate-200">
          Carregando lista de psicólogos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-xs text-slate-500 border border-slate-200 space-y-2">
          <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold">Nenhum psicólogo encontrado.</p>
          <p className="text-[11px] text-slate-400">Tente ajustar a busca ou os filtros acima.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => {
            const perc = p.limitePacientesAtivos > 0 ? Math.min(100, Math.round((p.pacientesAtivosCount / p.limitePacientesAtivos) * 100)) : 0;
            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Avatar & Header do Psicólogo */}
                  <div className="flex items-start gap-4">
                    {p.imagemUrl ? (
                      <img
                        src={p.imagemUrl}
                        alt={p.nome}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 font-black text-xl flex items-center justify-center border-2 border-purple-200 shrink-0">
                        {p.nome.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                          Turma {p.turma || 'Viver Mais'}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            p.exibirNaVitrine
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {p.exibirNaVitrine ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {p.exibirNaVitrine ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug truncate mt-1">{p.nome}</h3>
                      <p className="text-xs text-slate-500 font-medium">CRP {p.crp}</p>
                    </div>
                  </div>

                  {/* Informações Principais */}
                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">Localidade:</span>
                      <span className="font-semibold text-slate-800">{p.cidade}/{p.estadoUf}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">Atendimento:</span>
                      <span className="font-extrabold text-purple-900">
                        {p.atendimentoPreferencia === 'AMBOS'
                          ? 'Particular & Social'
                          : p.atendimentoPreferencia === 'PARTICULAR'
                          ? 'Somente Particular'
                          : 'Somente Social'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">WhatsApp:</span>
                      <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-purple-600 font-bold hover:underline">
                        {p.whatsapp}
                      </a>
                    </div>
                  </div>

                  {/* Serviços & Público Alvo */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 block">Serviços Prestados:</span>
                    <div className="flex flex-wrap gap-1">
                      {p.servicosPrestados?.map((s) => (
                        <span key={s} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 block">Público Alvo:</span>
                    <div className="flex flex-wrap gap-1">
                      {p.publicoAlvo?.map((pa) => (
                        <span key={pa} className="text-[10px] font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-100">
                          {pa}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Capacidade / Ocupação */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">Capacidade de Atendimento</span>
                    <span className="font-black text-slate-900">
                      {p.pacientesAtivosCount} / {p.limitePacientesAtivos} pacientes
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        perc >= 100 ? 'bg-rose-500' : perc >= 75 ? 'bg-amber-500' : 'bg-purple-600'
                      }`}
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Cadastro de Psicólogo pelo Admin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Cadastrar Psicólogo na Equipe</h2>
                <p className="text-xs text-slate-500">Preencha os dados do novo profissional para incluir no rodízio de encaminhamento.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePsicologo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Nome do Psicólogo"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">CRP *</label>
                  <input
                    type="text"
                    required
                    value={form.crp}
                    onChange={(e) => setForm({ ...form, crp: e.target.value })}
                    placeholder="Ex: 12/34567"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">E-mail Profissional *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="psicologo@exemplo.com"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="(48) 99999-9999"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">Turma Viver Mais Psicologia *</label>
                  <select
                    value={form.turma}
                    onChange={(e) => setForm({ ...form, turma: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600 bg-white"
                  >
                    {['22A', '22B', '23A', '23B', '24A', '24B', '25A', '25B', '26A', '26B'].map((t) => (
                      <option key={t} value={t}>Turma {t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">Preferência de Atendimento *</label>
                  <select
                    value={form.atendimentoPreferencia}
                    onChange={(e) => setForm({ ...form, atendimentoPreferencia: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600 bg-white"
                  >
                    <option value="AMBOS">Atendimento Particular e Social (Ambos)</option>
                    <option value="PARTICULAR">Atendimento Particular</option>
                    <option value="SOCIAL">Atendimento Social</option>
                  </select>
                </div>
              </div>

              <BrazilLocationFields
                estadoUf={form.estadoUf}
                cidade={form.cidade}
                onEstadoChange={(uf: string) => setForm((prev) => ({ ...prev, estadoUf: uf, cidade: '' }))}
                onCidadeChange={(city: string) => setForm((prev) => ({ ...prev, cidade: city }))}
              />

              <GenderFields
                idPrefix="admin-psicologo"
                gender={form.genero as any}
                other={form.generoOutro}
                onGenderChange={(g) => setForm((prev) => ({ ...prev, genero: g }))}
                onOtherChange={(go: string) => setForm((prev) => ({ ...prev, generoOutro: go }))}
              />

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Foto de Perfil</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Cadastrando...' : 'Salvar Psicólogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
