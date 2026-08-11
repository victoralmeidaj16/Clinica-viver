'use client';

import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Copy,
  Clock3,
  EyeOff,
  Eye,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  SlidersHorizontal,
  HelpCircle,
  Circle,
} from 'lucide-react';
import { LISTA_NECESSIDADES } from '@/app/vitrine/page';
import { BrazilLocationFields } from '@/components/forms/BrazilLocationFields';
import { GenderFields } from '@/components/forms/GenderFields';
import { formatBrazilPhone, normalizeBrazilPhone } from '@/lib/brazilPhone';
import { validateGender, type GenderValue } from '@/lib/gender';

/**
 * Diretório e mesa de capacidade do corpo clínico.
 *
 * Complementa o cockpit, que é a fila do dia: lá a gestão despacha os
 * credenciamentos que chegaram; aqui ela olha a equipe inteira e mexe no que
 * governa o rodízio — vitrine, limite de pacientes e posição na fila.
 *
 * Antes esta tela lia de `/credenciamento-psicologo/public`, o endpoint da
 * vitrine, que devolve só aprovados e visíveis, com dez campos. O efeito era
 * uma tela de gestão que não mostrava ninguém para gerir: candidatos em análise
 * eram invisíveis, os KPIs de capacidade ficavam zerados porque os campos não
 * vinham no payload, e o cadastro manual sumia da lista ao ser criado, já que
 * nasce `EM_ANALISE`.
 */

type StatusCadastro = 'EM_ANALISE' | 'APROVADO' | 'RECUSADO';

interface PsicologoItem {
  id: string;
  nomeCompleto: string;
  nomeSocial?: string;
  crp: string;
  whatsapp: string;
  email?: string;
  fotoUrl?: string;
  cidade?: string;
  estadoUf?: string;
  logradouro?: string;
  bairro?: string;
  status: StatusCadastro;
  atendimentoPreferencia?: 'PARTICULAR' | 'SOCIAL' | 'AMBOS';
  turnosDisponiveis?: string[];
  servicosPrestados?: string[];
  publicoAlvo?: string[];
  necessidadesAtendidas?: string[];
  necessidadesOutro?: string;
  publicoAlvoOutro?: string;
  limitePacientesAtivos?: number;
  pacientesAtivosCount?: number;
  exibirNaVitrine?: boolean;
  motivoDesativacao?: string;
  pausadoNoRodizio?: boolean;
  motivoPausaRodizio?: string;
  ultimoLeadRecebidoEm?: string;
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
  /** Marcos do credenciamento. `contaAtivada` vem da junção com clinica_usuarios. */
  boasVindasEnviadaEm?: string;
  acessoCriadoEm?: string;
  usuarioRef?: string;
  contaAtivada?: boolean;
  criadoEm?: string;
}

type FiltroStatus =
  | 'TODOS'
  | 'EM_ANALISE'
  | 'APROVADO'
  | 'FORA_DA_VITRINE'
  | 'PAUSADO'
  | 'RECUSADO';

const FILTROS: Array<[FiltroStatus, string]> = [
  ['TODOS', 'Todos'],
  ['EM_ANALISE', 'Em análise'],
  ['APROVADO', 'No rodízio'],
  ['PAUSADO', 'Pausados'],
  ['FORA_DA_VITRINE', 'Fora da vitrine'],
  ['RECUSADO', 'Recusados'],
];

/** Motivos previstos para sair da vitrine ou pausar os encaminhamentos. */
const MOTIVOS = ['Férias', 'Limite de pacientes', 'Pausa solicitada', 'Licença', 'Outro'];

const SERVICOS = [
  'Atendimento Psicológico',
  'Avaliação Psicológica',
  'Orientação Vocacional',
  'Orientação Profissional',
  'Orientação Parental',
  'Psicoterapia de Casal',
];

const PUBLICOS = [
  'Criança', 'Adolescente', 'Adulto', 'Idoso', 'Casal',
  'Família', 'Mulher', 'Homem', 'LGBTQIAPN+', 'Outro',
];

const TURNOS: Array<[string, string]> = [
  ['MANHA', 'Manhã'],
  ['TARDE', 'Tarde'],
  ['NOITE', 'Noite'],
];

const nomeExibido = (p: PsicologoItem) => p.nomeSocial?.trim() || p.nomeCompleto;

export default function GestaoPsicologosPage() {
  const [psicologos, setPsicologos] = useState<PsicologoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FiltroStatus>('TODOS');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [motivoAlvo, setMotivoAlvo] = useState<
    { psicologo: PsicologoItem; acao: 'VITRINE' | 'RODIZIO' } | null
  >(null);
  const [editando, setEditando] = useState<PsicologoItem | null>(null);

  const [form, setForm] = useState({
    nomeCompleto: '',
    nomeSocial: '',
    crp: '',
    whatsapp: '',
    email: '',
    cidade: '',
    estadoUf: 'SC',
    logradouro: '',
    bairro: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
    turmaViverMais: '24A',
    atendimentoPreferencia: 'AMBOS' as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
    servicosPrestados: ['Atendimento Psicológico'],
    publicoAlvo: ['Adulto'],
    publicoAlvoOutro: '',
    especificarNecessidades: false,
    necessidadesAtendidas: [] as string[],
    necessidadesOutro: '',
    disponibilidadeTurnos: ['MANHA', 'TARDE'] as string[],
  });

  const handleCopyFormLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/vitrine?cadastro=psicologo`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(link);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const loadPsicologos = async () => {
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo', { cache: 'no-store' });
      const body = (await resp.json()) as { success: boolean; data?: PsicologoItem[]; error?: string };
      if (!resp.ok || !body.success) throw new Error(body.error ?? 'Não foi possível carregar a equipe.');
      setPsicologos(Array.isArray(body.data) ? body.data : []);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha de conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadPsicologos);
  }, []);

  /** Toda escrita passa por aqui: um caminho só para o PATCH da gestão. */
  const atualizar = async (id: string, mudancas: Record<string, unknown>) => {
    setOcupado(id);
    try {
      const resp = await fetch(`/api/application/credenciamento-psicologo/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mudancas),
      });
      const body = (await resp.json()) as { success: boolean; error?: string; campos?: string[] };
      if (!resp.ok || !body.success) {
        alert(
          body.campos?.length
            ? `${body.error}\n\nCampos pendentes: ${body.campos.join(', ')}`
            : body.error ?? 'Não foi possível salvar.'
        );
        return;
      }
      await loadPsicologos();
    } catch {
      alert('Falha de conexão ao salvar.');
    } finally {
      setOcupado(null);
    }
  };

  const aprovar = (p: PsicologoItem) =>
    atualizar(p.id, { status: 'APROVADO', exibirNaVitrine: true, pausadoNoRodizio: false });

  const recusar = (p: PsicologoItem) => {
    if (!confirm(`Recusar o credenciamento de ${nomeExibido(p)}?`)) return;
    return atualizar(p.id, { status: 'RECUSADO' });
  };

  /**
   * Duas perguntas distintas, dois botões.
   *
   * Sair da vitrine é sobre o site público; pausar é sobre receber
   * encaminhamento. Antes um único botão fazia as duas coisas, então tirar a
   * foto de alguém do site cortava os pacientes novos junto.
   *
   * Voltar não pede motivo — o motivo descreve a ausência, e a ausência acabou.
   */
  const alternarVitrine = (p: PsicologoItem) => {
    if (p.exibirNaVitrine === false) return atualizar(p.id, { exibirNaVitrine: true });
    setMotivoAlvo({ psicologo: p, acao: 'VITRINE' });
  };

  const alternarRodizio = (p: PsicologoItem) => {
    if (p.pausadoNoRodizio) return atualizar(p.id, { pausadoNoRodizio: false });
    setMotivoAlvo({ psicologo: p, acao: 'RODIZIO' });
  };

  const confirmarMotivo = async (motivo: string) => {
    if (!motivoAlvo) return;
    const { psicologo, acao } = motivoAlvo;
    setMotivoAlvo(null);
    await atualizar(
      psicologo.id,
      acao === 'VITRINE'
        ? { exibirNaVitrine: false, motivoDesativacao: motivo }
        : { pausadoNoRodizio: true, motivoPausaRodizio: motivo }
    );
  };

  const ajustarLimite = (p: PsicologoItem) => {
    const atual = p.limitePacientesAtivos ?? 5;
    const resposta = prompt(`Limite de pacientes ativos de ${nomeExibido(p)} (1 a 5):`, String(atual));
    if (!resposta) return;
    const limite = Number(resposta);
    if (!Number.isInteger(limite) || limite < 1 || limite > 5) {
      alert('O limite deve ser um número inteiro entre 1 e 5.');
      return;
    }
    if (limite < (p.pacientesAtivosCount ?? 0)) {
      alert(
        `${nomeExibido(p)} tem ${p.pacientesAtivosCount} pacientes ativos. ` +
          'Reduzir o limite abaixo disso não remove ninguém — apenas impede novos encaminhamentos.'
      );
    }
    return atualizar(p.id, { limitePacientesAtivos: limite });
  };

  /**
   * O rodízio ordena por `ultimoLeadRecebidoEm`, mais antigo primeiro. Limpar
   * o campo joga a pessoa para a frente da fila — é como a gestão compensa quem
   * ficou de fora por uma desativação temporária.
   */
  const priorizarNaFila = (p: PsicologoItem) => {
    if (!confirm(`Colocar ${nomeExibido(p)} no início da fila do próximo encaminhamento?`)) return;
    return atualizar(p.id, { ultimoLeadRecebidoEm: null });
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
    if (!form.logradouro.trim() || !form.bairro.trim()) {
      alert('Informe rua/logradouro e bairro.');
      return;
    }
    if (form.disponibilidadeTurnos.length === 0) {
      alert('Selecione ao menos um turno — sem turno o profissional nunca recebe encaminhamento.');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await resp.json()) as { success: boolean; error?: string };
      if (!data.success) {
        alert(data.error ?? 'Erro ao cadastrar psicólogo.');
        return;
      }
      setIsModalOpen(false);
      setStatusFilter('EM_ANALISE');
      await loadPsicologos();
    } catch {
      alert('Erro ao cadastrar psicólogo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = psicologos.filter((p) => {
    const termo = search.toLowerCase();
    const matchesSearch =
      !termo ||
      nomeExibido(p).toLowerCase().includes(termo) ||
      p.crp.toLowerCase().includes(termo) ||
      (p.cidade ?? '').toLowerCase().includes(termo);

    const matchesStatus =
      statusFilter === 'TODOS' ||
      (statusFilter === 'FORA_DA_VITRINE'
        ? p.status === 'APROVADO' && p.exibirNaVitrine === false
        : statusFilter === 'PAUSADO'
          ? p.status === 'APROVADO' && Boolean(p.pausadoNoRodizio)
          : statusFilter === 'APROVADO'
            ? p.status === 'APROVADO' && !p.pausadoNoRodizio
            : p.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const aprovados = psicologos.filter((p) => p.status === 'APROVADO');
  // Receber encaminhamento depende só da pausa. Sair da vitrine é outra coisa,
  // e um profissional pode estar em cada estado independentemente do outro.
  const noRodizio = aprovados.filter((p) => !p.pausadoNoRodizio);
  const pendentes = psicologos.filter((p) => p.status === 'EM_ANALISE').length;
  const pausados = aprovados.length - noRodizio.length;
  const foraDaVitrine = aprovados.filter((p) => p.exibirNaVitrine === false).length;
  const vagasLivres = noRodizio.reduce(
    (acc, p) => acc + Math.max(0, (p.limitePacientesAtivos ?? 5) - (p.pacientesAtivosCount ?? 0)),
    0
  );

  const botao =
    'text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 flex items-center gap-1';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-purple-600 font-extrabold text-xs uppercase tracking-wider">
            <UserCheck className="w-4 h-4" />
            <span>Gestão da Equipe Clínica</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Psicólogos Credenciados</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Corpo clínico, capacidade de atendimento e quem está no rodízio de encaminhamento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleCopyFormLink}
            className={`font-extrabold text-xs px-5 py-3 rounded-2xl transition-all shadow-md flex items-center gap-2 active:scale-95 ${
              copiedLink
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30'
            }`}
          >
            {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link de Cadastro'}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-extrabold text-xs px-4 py-3 rounded-2xl transition-all flex items-center gap-1.5 active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-purple-600" />
            <span>Cadastrar Manualmente</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">{erro}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">No rodízio</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600">{noRodizio.length}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              de {psicologos.length}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Aguardando análise</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-black ${pendentes > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
              {pendentes}
            </span>
            {pendentes > 0 && (
              <button
                onClick={() => setStatusFilter('EM_ANALISE')}
                className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md hover:bg-amber-100"
              >
                Ver
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vagas livres</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-black ${vagasLivres === 0 ? 'text-rose-600' : 'text-purple-900'}`}>
              {vagasLivres}
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              {vagasLivres === 0 ? 'Sem capacidade' : 'Podem receber'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pausados</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-black ${pausados > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
              {pausados}
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              Sem encaminhamento
            </span>
          </div>
          <p className="text-[10px] text-slate-400 pt-0.5">
            {foraDaVitrine} fora da vitrine
          </p>
        </div>
      </div>

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
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
            {FILTROS.map(([valor, rotulo]) => (
              <button
                key={valor}
                onClick={() => setStatusFilter(valor)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  statusFilter === valor ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center text-xs text-slate-400 border border-slate-200">
          Carregando a equipe...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-xs text-slate-500 border border-slate-200 space-y-2">
          <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-bold">
            {psicologos.length === 0 ? 'Nenhum psicólogo cadastrado ainda.' : 'Nenhum psicólogo neste filtro.'}
          </p>
          <p className="text-[11px] text-slate-400">
            {psicologos.length === 0
              ? 'Compartilhe o link de cadastro ou registre alguém manualmente.'
              : 'Tente ajustar a busca ou os filtros acima.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => {
            const limite = p.limitePacientesAtivos ?? 5;
            const ativos = p.pacientesAtivosCount ?? 0;
            const perc = limite > 0 ? Math.min(100, Math.round((ativos / limite) * 100)) : 0;
            const naVitrine = p.exibirNaVitrine !== false;
            const pausado = Boolean(p.pausadoNoRodizio);
            const semTurno = !p.turnosDisponiveis?.length;
            const trabalhando = ocupado === p.id;

            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 font-black text-xl flex items-center justify-center border-2 border-purple-200 shrink-0">
                      {nomeExibido(p).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                          Turma {p.turmaViverMais || '—'}
                        </span>
                        {p.status === 'EM_ANALISE' ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock3 className="w-3 h-3" /> Em análise
                          </span>
                        ) : p.status === 'RECUSADO' ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3" /> Recusado
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                pausado
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                              title={pausado ? 'Não recebe encaminhamento' : 'Recebe encaminhamento'}
                            >
                              {pausado ? <PauseCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              {pausado ? 'Pausado' : 'No rodízio'}
                            </span>
                            {!naVitrine && (
                              <span
                                className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200"
                                title="Não aparece no site público"
                              >
                                <EyeOff className="w-3 h-3" /> Oculto
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug truncate mt-1">
                        {nomeExibido(p)}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">CRP {p.crp}</p>
                    </div>
                  </div>

                  {pausado && (
                    <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                      Não recebe encaminhamento: {p.motivoPausaRodizio ?? 'sem motivo registrado'}
                    </p>
                  )}

                  {!naVitrine && (
                    <p className="text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      Fora do site público: {p.motivoDesativacao ?? 'sem motivo registrado'}
                    </p>
                  )}

                  {semTurno && p.status === 'APROVADO' && !pausado && (
                    <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      Sem turno cadastrado — não recebe encaminhamento, mesmo estando no rodízio.
                    </p>
                  )}

                  {p.status !== 'RECUSADO' && <SemaforoCredenciamento psicologo={p} />}

                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">Localidade:</span>
                      <span className="font-semibold text-slate-800">
                        {p.cidade && p.estadoUf ? `${p.cidade}/${p.estadoUf}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">Atendimento:</span>
                      <span className="font-extrabold text-purple-900">
                        {p.atendimentoPreferencia === 'PARTICULAR'
                          ? 'Somente Particular'
                          : p.atendimentoPreferencia === 'SOCIAL'
                            ? 'Somente Social'
                            : 'Particular & Social'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">Turnos:</span>
                      <span className="font-semibold text-slate-800">
                        {p.turnosDisponiveis?.length
                          ? p.turnosDisponiveis
                              .map((t) => TURNOS.find(([valor]) => valor === t)?.[1] ?? t)
                              .join(', ')
                          : 'Nenhum'}
                      </span>
                    </div>
                    {p.posGraduacaoViverMais && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-500 shrink-0">Pós:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {p.posGraduacaoViverMais}
                          {p.segundaPosGraduacao ? ` · ${p.segundaPosGraduacao}` : ''}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">Último lead:</span>
                      <span className="font-semibold text-slate-800">
                        {p.ultimoLeadRecebidoEm
                          ? new Date(p.ultimoLeadRecebidoEm).toLocaleDateString('pt-BR')
                          : 'Nunca — primeiro da fila'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500">WhatsApp:</span>
                      <a
                        href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-600 font-bold hover:underline"
                      >
                        {formatBrazilPhone(p.whatsapp) || p.whatsapp}
                      </a>
                    </div>
                  </div>

                  {Boolean(p.servicosPrestados?.length) && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 block">Serviços Prestados:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.servicosPrestados?.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Boolean(p.publicoAlvo?.length) && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 block">Público Alvo:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.publicoAlvo?.map((pa) => (
                          <span
                            key={pa}
                            className="text-[10px] font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-100"
                          >
                            {pa}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Boolean(p.necessidadesAtendidas?.length) && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 block">Demandas atendidas:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.necessidadesAtendidas?.map((n) => (
                          <span
                            key={n}
                            className="text-[10px] font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-100"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-600">Capacidade</span>
                      <span className="font-black text-slate-900">
                        {ativos} / {limite} pacientes
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full transition-all ${
                          perc >= 100 ? 'bg-rose-500' : perc >= 75 ? 'bg-amber-500' : 'bg-purple-600'
                        }`}
                        style={{ width: `${perc}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {p.status === 'EM_ANALISE' ? (
                      <>
                        <button
                          disabled={trabalhando}
                          onClick={() => void aprovar(p)}
                          className={`${botao} bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100`}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Aprovar acesso
                        </button>
                        <button
                          disabled={trabalhando}
                          onClick={() => void recusar(p)}
                          className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                        >
                          <XCircle className="w-3 h-3" /> Recusar
                        </button>
                      </>
                    ) : p.status === 'RECUSADO' ? (
                      <button
                        disabled={trabalhando}
                        onClick={() => void aprovar(p)}
                        className={`${botao} bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Reconsiderar
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={trabalhando}
                          onClick={() => alternarRodizio(p)}
                          title={
                            pausado
                              ? 'Volta a receber pacientes novos'
                              : 'Para de receber pacientes novos, sem sair do site'
                          }
                          className={`${botao} ${
                            pausado
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {pausado ? <PlayCircle className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
                          {pausado ? 'Retomar' : 'Pausar'}
                        </button>
                        <button
                          disabled={trabalhando}
                          onClick={() => alternarVitrine(p)}
                          title={
                            naVitrine
                              ? 'Some do site público, mas continua atendendo'
                              : 'Volta a aparecer no site público'
                          }
                          className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                        >
                          {naVitrine ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {naVitrine ? 'Ocultar' : 'Exibir'}
                        </button>
                        <button
                          disabled={trabalhando}
                          onClick={() => setEditando(p)}
                          title="Turnos, serviços, público e demandas — o que o rodízio cruza"
                          className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                        >
                          <SlidersHorizontal className="w-3 h-3" /> Critérios
                        </button>
                        <button
                          disabled={trabalhando}
                          onClick={() => void ajustarLimite(p)}
                          className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                        >
                          Limite: {limite}
                        </button>
                        {!pausado && (
                          <button
                            disabled={trabalhando}
                            onClick={() => void priorizarNaFila(p)}
                            title="Coloca no início da fila do próximo encaminhamento"
                            className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                          >
                            <RotateCcw className="w-3 h-3" /> Priorizar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {motivoAlvo && (
        <ModalMotivo
          alvo={motivoAlvo}
          onConfirmar={(motivo) => void confirmarMotivo(motivo)}
          onCancelar={() => setMotivoAlvo(null)}
        />
      )}

      {editando && (
        <ModalEdicao
          psicologo={editando}
          onSalvar={(mudancas) => {
            const alvo = editando;
            setEditando(null);
            void atualizar(alvo.id, mudancas);
          }}
          onCancelar={() => setEditando(null)}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Cadastrar Psicólogo na Equipe</h2>
                <p className="text-xs text-slate-500">
                  Entra como <strong>Em análise</strong>, igual ao formulário público. Aprove em seguida para liberar o
                  acesso e o rodízio.
                </p>
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
                    value={form.nomeCompleto}
                    onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })}
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

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Nome social</label>
                <input
                  type="text"
                  value={form.nomeSocial}
                  onChange={(e) => setForm({ ...form, nomeSocial: e.target.value })}
                  placeholder="Como prefere ser chamado"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">E-mail Profissional *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  <label className="font-bold text-xs text-slate-700 block mb-1">Turma Viver Mais *</label>
                  <select
                    value={form.turmaViverMais}
                    onChange={(e) => setForm({ ...form, turmaViverMais: e.target.value })}
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
                    onChange={(e) =>
                      setForm({
                        ...form,
                        atendimentoPreferencia: e.target.value as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
                      })
                    }
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600 bg-white"
                  >
                    <option value="AMBOS">Particular e Social (Ambos)</option>
                    <option value="PARTICULAR">Somente Particular</option>
                    <option value="SOCIAL">Somente Social</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1.5">Turnos de atendimento *</label>
                <div className="flex flex-wrap gap-2">
                  {TURNOS.map(([valor, rotulo]) => {
                    const marcado = form.disponibilidadeTurnos.includes(valor);
                    return (
                      <label
                        key={valor}
                        className={`cursor-pointer px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                          marcado
                            ? 'bg-purple-50 border-purple-500 text-purple-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={marcado}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              disponibilidadeTurnos: marcado
                                ? prev.disponibilidadeTurnos.filter((t) => t !== valor)
                                : [...prev.disponibilidadeTurnos, valor],
                            }))
                          }
                        />
                        {rotulo}
                      </label>
                    );
                  })}
                </div>
              </div>

              <BrazilLocationFields
                estadoUf={form.estadoUf}
                cidade={form.cidade}
                onEstadoChange={(uf: string) => setForm((prev) => ({ ...prev, estadoUf: uf, cidade: '' }))}
                onCidadeChange={(city: string) => setForm((prev) => ({ ...prev, cidade: city }))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">Rua / logradouro *</label>
                  <input required value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600" />
                </div>
                <div>
                  <label className="font-bold text-xs text-slate-700 block mb-1">Bairro *</label>
                  <input required value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600" />
                </div>
              </div>

              <GenderFields
                idPrefix="admin-psicologo"
                gender={form.genero}
                other={form.generoOutro}
                onGenderChange={(g) => setForm((prev) => ({ ...prev, genero: g }))}
                onOtherChange={(value) => setForm((prev) => ({ ...prev, generoOutro: value }))}
              />

              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1.5">Demandas específicas atendidas</label>
                <div className="flex flex-wrap gap-1.5">
                  {LISTA_NECESSIDADES.map((necessidade) => {
                    const marcado = form.necessidadesAtendidas.includes(necessidade);
                    return (
                      <label
                        key={necessidade}
                        className={`cursor-pointer px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                          marcado
                            ? 'bg-purple-50 border-purple-400 text-purple-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={marcado}
                          onChange={() =>
                            setForm((prev) => ({
                              ...prev,
                              especificarNecessidades: true,
                              necessidadesAtendidas: marcado
                                ? prev.necessidadesAtendidas.filter((n) => n !== necessidade)
                                : [...prev.necessidadesAtendidas, necessidade],
                            }))
                          }
                        />
                        {necessidade}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-6 py-3 rounded-2xl transition-all disabled:opacity-60"
                >
                  {isSubmitting ? 'Cadastrando…' : 'Cadastrar Psicólogo'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-slate-200 text-slate-600 font-extrabold text-xs px-6 py-3 rounded-2xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Onde cada credenciamento parou.
 *
 * Os três marcos vinham do banco e nunca chegavam à tela, então a gestão não
 * tinha como saber se alguém já entrou no sistema ou se o convite se perdeu no
 * WhatsApp. `contaAtivada` é `undefined` em modo demonstração — aí o marco
 * aparece como desconhecido, em vez de afirmar que não aconteceu.
 */
function SemaforoCredenciamento({ psicologo }: { psicologo: PsicologoItem }) {
  if (psicologo.status !== 'APROVADO') return null;

  const marcos: Array<[string, boolean | undefined]> = [
    ['Acesso criado', Boolean(psicologo.acessoCriadoEm || psicologo.usuarioRef)],
    ['Convite enviado', Boolean(psicologo.boasVindasEnviadaEm)],
    ['Conta ativada', psicologo.contaAtivada],
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {marcos.map(([rotulo, feito]) => (
        <span
          key={rotulo}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${
            feito === undefined
              ? 'bg-slate-50 text-slate-400 border-slate-200'
              : feito
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}
          title={feito === undefined ? 'Indisponível em modo demonstração' : undefined}
        >
          {feito === undefined ? (
            <HelpCircle className="w-3 h-3" />
          ) : feito ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Circle className="w-3 h-3" />
          )}
          {rotulo}
        </span>
      ))}
    </div>
  );
}

/**
 * Modal de motivo. Substitui o `prompt()` nativo, que aceitava qualquer texto e
 * não oferecia os motivos previstos — o resultado eram registros como "ferias",
 * "Férias " e "de férias" descrevendo a mesma situação.
 */
function ModalMotivo({
  alvo,
  onConfirmar,
  onCancelar,
}: {
  alvo: { psicologo: PsicologoItem; acao: 'VITRINE' | 'RODIZIO' };
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [escolha, setEscolha] = useState(MOTIVOS[0]);
  const [outro, setOutro] = useState('');
  const motivo = escolha === 'Outro' ? outro.trim() : escolha;
  const nome = alvo.psicologo.nomeSocial?.trim() || alvo.psicologo.nomeCompleto;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            {alvo.acao === 'VITRINE' ? 'Tirar do site público' : 'Pausar encaminhamentos'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {alvo.acao === 'VITRINE'
              ? `${nome} deixa de aparecer na vitrine, mas continua recebendo pacientes novos.`
              : `${nome} para de receber pacientes novos, mas segue visível para quem já atende.`}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">
            Motivo
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setEscolha(opcao)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                  escolha === opcao
                    ? 'bg-purple-50 border-purple-500 text-purple-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opcao}
              </button>
            ))}
          </div>
          {escolha === 'Outro' && (
            <input
              autoFocus
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
              placeholder="Qual o motivo?"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-600"
            />
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={!motivo}
            onClick={() => onConfirmar(motivo)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="border border-slate-200 text-slate-600 font-extrabold text-xs px-5 py-2.5 rounded-2xl hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edição dos critérios que o rodízio cruza.
 *
 * O `PATCH` da gestão sempre aceitou estes campos; faltava a tela. Sem ela, o
 * único jeito de corrigir os turnos de alguém já cadastrado era pelo banco — e
 * turno errado significa profissional que nunca recebe encaminhamento.
 */
function ModalEdicao({
  psicologo,
  onSalvar,
  onCancelar,
}: {
  psicologo: PsicologoItem;
  onSalvar: (mudancas: Record<string, unknown>) => void;
  onCancelar: () => void;
}) {
  const [turnos, setTurnos] = useState<string[]>([...(psicologo.turnosDisponiveis ?? [])]);
  const [servicos, setServicos] = useState<string[]>([...(psicologo.servicosPrestados ?? [])]);
  const [publicos, setPublicos] = useState<string[]>([...(psicologo.publicoAlvo ?? [])]);
  const [necessidades, setNecessidades] = useState<string[]>([
    ...(psicologo.necessidadesAtendidas ?? []),
  ]);
  const [preferencia, setPreferencia] = useState(psicologo.atendimentoPreferencia ?? 'AMBOS');
  const [aviso, setAviso] = useState<string | null>(null);

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];

  const chip = (marcado: boolean) =>
    `cursor-pointer px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
      marcado
        ? 'bg-purple-50 border-purple-400 text-purple-900'
        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
    }`;

  const salvar = () => {
    if (turnos.length === 0) {
      setAviso('Selecione ao menos um turno — sem turno o profissional nunca recebe encaminhamento.');
      return;
    }
    onSalvar({
      turnosDisponiveis: turnos,
      servicosPrestados: servicos,
      publicoAlvo: publicos,
      necessidadesAtendidas: necessidades,
      especificarNecessidades: necessidades.length > 0,
      atendimentoPreferencia: preferencia,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-black text-slate-900">
            Critérios de encaminhamento — {psicologo.nomeSocial?.trim() || psicologo.nomeCompleto}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            É por estes campos que o rodízio decide quem recebe cada paciente.
          </p>
        </div>

        {aviso && (
          <p className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {aviso}
          </p>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Turnos
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TURNOS.map(([valor, rotulo]) => (
              <label key={valor} className={chip(turnos.includes(valor))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={turnos.includes(valor)}
                  onChange={() => setTurnos(alternar(turnos, valor))}
                />
                {rotulo}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Serviços prestados
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SERVICOS.map((servico) => (
              <label key={servico} className={chip(servicos.includes(servico))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={servicos.includes(servico)}
                  onChange={() => setServicos(alternar(servicos, servico))}
                />
                {servico}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Público atendido
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PUBLICOS.map((publico) => (
              <label key={publico} className={chip(publicos.includes(publico))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={publicos.includes(publico)}
                  onChange={() => setPublicos(alternar(publicos, publico))}
                />
                {publico}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Demandas específicas
          </label>
          <div className="flex flex-wrap gap-1.5">
            {LISTA_NECESSIDADES.map((necessidade) => (
              <label key={necessidade} className={chip(necessidades.includes(necessidade))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={necessidades.includes(necessidade)}
                  onChange={() => setNecessidades(alternar(necessidades, necessidade))}
                />
                {necessidade}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Lista vazia significa &quot;atende qualquer demanda&quot;, não &quot;nenhuma&quot;.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Tipo de atendimento
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['PARTICULAR', 'SOCIAL', 'AMBOS'] as const).map((tipo) => (
              <label key={tipo} className={chip(preferencia === tipo)}>
                <input
                  type="radio"
                  className="sr-only"
                  checked={preferencia === tipo}
                  onChange={() => setPreferencia(tipo)}
                />
                {tipo}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={salvar}
            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl"
          >
            Salvar critérios
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="border border-slate-200 text-slate-600 font-extrabold text-xs px-5 py-2.5 rounded-2xl hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
