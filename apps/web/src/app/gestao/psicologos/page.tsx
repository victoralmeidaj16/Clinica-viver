'use client';

import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Copy,
  UsersRound,
} from 'lucide-react';
import { CadastroPsicologoForm } from '@/components/forms/CadastroPsicologoForm';
import { PsicologoItem, FiltroStatus } from '@/components/gestao/types';
import { PsicologoCard } from '@/components/gestao/PsicologoCard';
import { ModalMotivo } from '@/components/gestao/ModalMotivo';
import { ModalEdicao } from '@/components/gestao/ModalEdicao';
import { ModalLimitePacientes } from '@/components/gestao/ModalLimitePacientes';

const FILTROS: Array<[FiltroStatus, string]> = [
  ['TODOS', 'Todos'],
  ['SOLICITACOES', 'Solicitações'],
  ['EM_ANALISE', 'Em análise'],
  ['APROVADO', 'No rodízio'],
  ['PAUSADO', 'Pausados'],
  ['RECUSADO', 'Recusados'],
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
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [motivoAlvo, setMotivoAlvo] = useState<PsicologoItem | null>(null);
  const [editando, setEditando] = useState<PsicologoItem | null>(null);
  const [limiteAlvo, setLimiteAlvo] = useState<PsicologoItem | 'TODOS' | null>(null);

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
        return false;
      }
      await loadPsicologos();
      return true;
    } catch {
      alert('Falha de conexão ao salvar.');
      return false;
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

  const alternarRodizio = (p: PsicologoItem) => {
    if (p.pausadoNoRodizio) {
      return atualizar(p.id, { pausadoNoRodizio: false, exibirNaVitrine: true });
    }
    setMotivoAlvo(p);
  };

  const confirmarMotivo = async (motivo: string) => {
    if (!motivoAlvo) return;
    const psicologo = motivoAlvo;
    setMotivoAlvo(null);
    await atualizar(psicologo.id, {
      pausadoNoRodizio: true,
      exibirNaVitrine: false,
      motivoPausaRodizio: motivo,
      motivoDesativacao: motivo,
    });
  };

  const salvarLimite = async (limite: number) => {
    if (!limiteAlvo) return false;

    if (limiteAlvo !== 'TODOS') {
      const salvo = await atualizar(limiteAlvo.id, { limitePacientesAtivos: limite });
      if (salvo) setLimiteAlvo(null);
      return salvo;
    }

    setOcupado('TODOS');
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo/limite-pacientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitePacientesAtivos: limite }),
      });
      const body = (await resp.json()) as { success: boolean; error?: string };
      if (!resp.ok || !body.success) {
        alert(body.error ?? 'Não foi possível atualizar a capacidade da equipe.');
        return false;
      }
      await loadPsicologos();
      setLimiteAlvo(null);
      return true;
    } catch {
      alert('Falha de conexão ao atualizar a capacidade da equipe.');
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const priorizarNaFila = (p: PsicologoItem) => {
    if (!confirm(`Colocar ${nomeExibido(p)} no início da fila do próximo encaminhamento?`)) return;
    return atualizar(p.id, { ultimoLeadRecebidoEm: null });
  };

  const aprovarSolicitacaoGestao = async (p: PsicologoItem) => {
    const sol = p.solicitacaoAlteracaoGestao;
    if (!sol) return;
    const mudancas: Record<string, unknown> = {
      solicitacaoAlteracaoGestao: {
        ...sol,
        status: 'APROVADO',
        respondidoEm: new Date().toISOString(),
      },
    };
    if (sol.turmaViverMais !== undefined) mudancas.turmaViverMais = sol.turmaViverMais;
    if (sol.posGraduacaoViverMais !== undefined) mudancas.posGraduacaoViverMais = sol.posGraduacaoViverMais;
    if (sol.segundaPosGraduacao !== undefined) mudancas.segundaPosGraduacao = sol.segundaPosGraduacao;
    if (sol.servicosPrestados !== undefined) mudancas.servicosPrestados = sol.servicosPrestados;
    if (sol.limitePacientesAtivos !== undefined) mudancas.limitePacientesAtivos = sol.limitePacientesAtivos;

    await atualizar(p.id, mudancas);
  };

  const recusarSolicitacaoGestao = async (p: PsicologoItem) => {
    const sol = p.solicitacaoAlteracaoGestao;
    if (!sol) return;
    const motivo = prompt(`Motivo da recusa da solicitação de ${nomeExibido(p)} (opcional):`);
    if (motivo === null) return;

    const mudancas: Record<string, unknown> = {
      solicitacaoAlteracaoGestao: {
        ...sol,
        status: 'RECUSADO',
        respondidoEm: new Date().toISOString(),
        motivoRecusa: motivo.trim() || undefined,
      },
    };
    await atualizar(p.id, mudancas);
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
      (statusFilter === 'SOLICITACOES'
        ? p.solicitacaoAlteracaoGestao?.status === 'PENDENTE'
        : statusFilter === 'PAUSADO'
          ? p.status === 'APROVADO' && Boolean(p.pausadoNoRodizio)
          : statusFilter === 'APROVADO'
            ? p.status === 'APROVADO' && !p.pausadoNoRodizio
            : p.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const solicitacoesPendentes = psicologos.filter(
    (p) => p.solicitacaoAlteracaoGestao?.status === 'PENDENTE'
  ).length;

  const aprovados = psicologos.filter((p) => p.status === 'APROVADO');
  const noRodizio = aprovados.filter((p) => !p.pausadoNoRodizio);
  const pendentes = psicologos.filter((p) => p.status === 'EM_ANALISE').length;
  const pausados = aprovados.length - noRodizio.length;

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
            type="button"
            onClick={() => setLimiteAlvo('TODOS')}
            disabled={psicologos.length === 0 || ocupado === 'TODOS'}
            className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-extrabold text-amber-950 transition-all hover:bg-amber-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UsersRound className="h-4 w-4 text-amber-700" />
            <span>Limite para todos</span>
          </button>

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

      {solicitacoesPendentes > 0 && (
        <div className="rounded-2xl border-2 border-purple-300 bg-purple-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 text-white rounded-xl shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-purple-950">
                {solicitacoesPendentes} psicólogo{solicitacoesPendentes > 1 ? 's têm' : ' tem'} solicitação de alteração pendente em &ldquo;Definido pela Gestão&rdquo;
              </p>
              <p className="text-[11px] text-purple-800">
                Revise os novos serviços ou dados acadêmicos solicitados e aprove com 1 clique.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('SOLICITACOES')}
            className="text-xs font-black text-purple-900 bg-white border border-purple-300 px-3.5 py-2 rounded-xl hover:bg-purple-100/50 shadow-xs shrink-0 self-start sm:self-auto"
          >
            Filtrar Solicitações ({solicitacoesPendentes})
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pausados</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-black ${pausados > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
              {pausados}
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              Sem encaminhamento
            </span>
          </div>
          <p className="text-[10px] text-slate-400 pt-0.5">Fora do rodízio e da vitrine</p>
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
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
          {filtered.map((p) => (
            <PsicologoCard
              key={p.id}
              p={p}
              ocupado={ocupado}
              onAprovar={(item) => void aprovar(item)}
              onRecusar={(item) => void recusar(item)}
              onAlternarRodizio={alternarRodizio}
              onEditar={(item) => setEditando(item)}
              onAjustarLimite={(item) => setLimiteAlvo(item)}
              onPriorizar={(item) => void priorizarNaFila(item)}
              onAprovarSolicitacaoGestao={aprovarSolicitacaoGestao}
              onRecusarSolicitacaoGestao={recusarSolicitacaoGestao}
            />
          ))}
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

      {limiteAlvo && (
        <ModalLimitePacientes
          psicologos={limiteAlvo === 'TODOS' ? psicologos : [limiteAlvo]}
          alvo={limiteAlvo === 'TODOS' ? undefined : limiteAlvo}
          onSalvar={salvarLimite}
          onCancelar={() => setLimiteAlvo(null)}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
          <CadastroPsicologoForm
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8 border border-slate-200 shadow-2xl"
            eyebrow="Cadastro pela gestão"
            titulo="Cadastrar Psicólogo na Equipe"
            descricao="Mesmo formulário público da vitrine. Entra como Em análise — aprove em seguida para liberar o acesso e o rodízio."
            labelCancelar="Fechar"
            labelEnviar="CADASTRAR PSICÓLOGO"
            onCancelar={() => setIsModalOpen(false)}
            onSucesso={async () => {
              setIsModalOpen(false);
              setStatusFilter('EM_ANALISE');
              await loadPsicologos();
            }}
          />
        </div>
      )}
    </div>
  );
}
