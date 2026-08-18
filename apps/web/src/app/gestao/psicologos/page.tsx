'use client';

import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { CadastroPsicologoForm } from '@/components/forms/CadastroPsicologoForm';
import { PsicologoItem, FiltroStatus } from '@/components/gestao/types';
import { PsicologoCard } from '@/components/gestao/PsicologoCard';
import { ModalMotivo } from '@/components/gestao/ModalMotivo';
import { ModalEdicao } from '@/components/gestao/ModalEdicao';

const FILTROS: Array<[FiltroStatus, string]> = [
  ['TODOS', 'Todos'],
  ['EM_ANALISE', 'Em análise'],
  ['APROVADO', 'No rodízio'],
  ['PAUSADO', 'Pausados'],
  ['FORA_DA_VITRINE', 'Fora da vitrine'],
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
  const [motivoAlvo, setMotivoAlvo] = useState<
    { psicologo: PsicologoItem; acao: 'VITRINE' | 'RODIZIO' } | null
  >(null);
  const [editando, setEditando] = useState<PsicologoItem | null>(null);

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

  const priorizarNaFila = (p: PsicologoItem) => {
    if (!confirm(`Colocar ${nomeExibido(p)} no início da fila do próximo encaminhamento?`)) return;
    return atualizar(p.id, { ultimoLeadRecebidoEm: null });
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
  const noRodizio = aprovados.filter((p) => !p.pausadoNoRodizio);
  const pendentes = psicologos.filter((p) => p.status === 'EM_ANALISE').length;
  const pausados = aprovados.length - noRodizio.length;
  const foraDaVitrine = aprovados.filter((p) => p.exibirNaVitrine === false).length;
  const vagasLivres = noRodizio.reduce(
    (acc, p) => acc + Math.max(0, (p.limitePacientesAtivos ?? 5) - (p.pacientesAtivosCount ?? 0)),
    0
  );

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {filtered.map((p) => (
            <PsicologoCard
              key={p.id}
              p={p}
              ocupado={ocupado}
              onAprovar={(item) => void aprovar(item)}
              onRecusar={(item) => void recusar(item)}
              onAlternarRodizio={alternarRodizio}
              onAlternarVitrine={alternarVitrine}
              onEditar={(item) => setEditando(item)}
              onAjustarLimite={(item) => void ajustarLimite(item)}
              onPriorizar={(item) => void priorizarNaFila(item)}
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
