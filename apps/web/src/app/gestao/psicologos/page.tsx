'use client';

import React, { useEffect, useState } from 'react';
import { UserCheck, Search, Filter } from 'lucide-react';
import { CadastroPsicologoForm } from '@/components/forms/CadastroPsicologoForm';
import { PsicologoItem, FiltroStatus } from '@/components/gestao/types';
import { PsicologoCard } from '@/components/gestao/PsicologoCard';
import { PsicologosCabecalho, PsicologosIndicadores } from '@/components/gestao/PsicologosCabecalho';
import { ModalEdicao } from '@/components/gestao/ModalEdicao';
import { ModalLimitePacientes } from '@/components/gestao/ModalLimitePacientes';
import Link from 'next/link';
import { foraPorVinculoAcademico } from '@/lib/turmaEncerrada';
import { ausenciaEmCurso } from '@/lib/ausenciaAgenda';
import { FocoDeNotificacao } from '@/components/layout/FocoDeNotificacao';

const FILTROS: Array<[FiltroStatus, string]> = [
  ['TODOS', 'Todos'],
  ['SOLICITACOES', 'Solicitações'],
  ['EM_ANALISE', 'Em análise'],
  ['APROVADO', 'No rodízio'],
  ['PAUSADO', 'Pausados'],
  ['TURMA_ENCERRADA', 'Turma encerrada'],
  ['RECUSADO', 'Recusados'],
];

const nomeExibido = (p: PsicologoItem) => p.nomeSocial?.trim() || p.nomeCompleto;

type ResultadoAcesso = {
  boasVindas?: string;
  email?: string;
  emailCodigo?: number;
  emailDetalhe?: string;
};

function resumoEntregas(whatsapp: string | undefined, email: string | undefined, detalhe?: string) {
  const linhas = [
    `WhatsApp: ${whatsapp === 'enviada' ? 'enviado' : whatsapp === 'nao_aplicavel' ? 'não aplicável' : 'falhou'}`,
    `E-mail: ${email === 'enviada' ? 'enviado' : 'falhou'}`,
  ];
  if (detalhe) linhas.push(`Motivo do e-mail: ${detalhe}`);
  return linhas.join('\n');
}

export default function GestaoPsicologosPage() {
  const [psicologos, setPsicologos] = useState<PsicologoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FiltroStatus>('TODOS');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
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
    void Promise.resolve().then(async () => {
      // A leitura da equipe também converte o arquivo legado de encerramentos;
      // o painel só deve pedir as turmas depois dessa migração local.
      await loadPsicologos();
    });
  }, []);

  const atualizar = async (
    id: string,
    mudancas: Record<string, unknown>,
    mostrarEntregas = false
  ) => {
    setOcupado(id);
    try {
      const resp = await fetch(`/api/application/credenciamento-psicologo/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mudancas),
      });
      const body = (await resp.json()) as {
        success: boolean;
        error?: string;
        campos?: string[];
        acesso?: ResultadoAcesso;
      };
      if (!resp.ok || !body.success) {
        alert(
          body.campos?.length
            ? `${body.error}\n\nCampos pendentes: ${body.campos.join(', ')}`
            : body.error ?? 'Não foi possível salvar.'
        );
        return false;
      }
      if (mostrarEntregas && body.acesso) {
        alert(resumoEntregas(
          body.acesso.boasVindas,
          body.acesso.email,
          body.acesso.emailDetalhe
        ));
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
    atualizar(
      p.id,
      { status: 'APROVADO', exibirNaVitrine: true, pausadoNoRodizio: false },
      true
    );

  const reenviarConvite = async (p: PsicologoItem) => {
    if (!confirm(`Gerar um novo convite e reenviar para ${nomeExibido(p)}? O link anterior deixará de funcionar.`)) {
      return;
    }
    setOcupado(p.id);
    try {
      const resp = await fetch(
        `/api/application/credenciamento-psicologo/${p.id}/reenviar-convite`,
        { method: 'POST' }
      );
      const body = (await resp.json()) as {
        success: boolean;
        error?: string;
        data?: {
          whatsapp: string;
          email: { situacao: string; detalhe?: string };
        };
      };
      if (!resp.ok || !body.success || !body.data) {
        alert(body.error ?? 'Não foi possível reenviar o convite.');
        return;
      }
      alert(resumoEntregas(body.data.whatsapp, body.data.email.situacao, body.data.email.detalhe));
      await loadPsicologos();
    } catch {
      alert('Falha de conexão ao reenviar o convite.');
    } finally {
      setOcupado(null);
    }
  };

  const recusar = (p: PsicologoItem) => {
    if (!confirm(`Recusar o credenciamento de ${nomeExibido(p)}?`)) return;
    return atualizar(p.id, { status: 'RECUSADO' });
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
    if (sol.segundaTurmaViverMais !== undefined) mudancas.segundaTurmaViverMais = sol.segundaTurmaViverMais;
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
        : statusFilter === 'TURMA_ENCERRADA'
          ? Boolean(p.turmaEncerrada)
          : statusFilter === 'PAUSADO'
          ? p.status === 'APROVADO' && Boolean(p.pausadoNoRodizio)
          : statusFilter === 'APROVADO'
            ? p.status === 'APROVADO' && !p.pausadoNoRodizio && !foraPorVinculoAcademico(p)
            : p.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const solicitacoesPendentes = psicologos.filter(
    (p) => p.solicitacaoAlteracaoGestao?.status === 'PENDENTE'
  ).length;

  const aprovados = psicologos.filter((p) => p.status === 'APROVADO');
  // "No rodízio" tem que significar quem de fato recebe encaminhamento agora.
  // Férias marcadas na agenda tiram da fila sem tocar em `pausadoNoRodizio`, e
  // contar essa pessoa aqui faria o painel prometer uma capacidade que a
  // distribuição não tem.
  const ausentes = aprovados.filter((p) => Boolean(ausenciaEmCurso(p.ausenciasAgenda)));
  // Mesma lógica para a turma encerrada: a pessoa está fora da fila mesmo sem
  // pausa manual.
  const desligadosPorTurma = aprovados.filter((p) => foraPorVinculoAcademico(p));
  const noRodizio = aprovados.filter(
    (p) =>
      !p.pausadoNoRodizio &&
      !ausenciaEmCurso(p.ausenciasAgenda) &&
      !foraPorVinculoAcademico(p)
  );
  const pendentes = psicologos.filter((p) => p.status === 'EM_ANALISE').length;
  const pausados = aprovados.filter((p) => p.pausadoNoRodizio).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/*
        Busca e filtro de status são estado local: um profissional fora do
        recorte atual não estaria no DOM para ser realçado. Zerar os dois é o
        que garante que o clique no aviso sempre encontre a pessoa citada.
      */}
      <FocoDeNotificacao
        aoFocar={() => {
          setSearch('');
          setStatusFilter('TODOS');
        }}
      />

      <PsicologosCabecalho
        limiteDesabilitado={psicologos.length === 0 || ocupado === 'TODOS'}
        linkCopiado={copiedLink}
        onLimiteTodos={() => setLimiteAlvo('TODOS')}
        onCopiarLink={handleCopyFormLink}
        onCadastrar={() => setIsModalOpen(true)}
      />

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
                Revise os novos serviços ou dados acadêmicos solicitados e realize a aprovação.
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

      <PsicologosIndicadores
        noRodizio={noRodizio.length}
        total={psicologos.length}
        ausentes={ausentes.length}
        desligadosPorTurma={desligadosPorTurma.length}
        pendentes={pendentes}
        pausados={pausados}
        onVerPendentes={() => setStatusFilter('EM_ANALISE')}
      />

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
        <section className="overflow-hidden rounded-2xl border border-psi-soft/60 bg-surface shadow-card">
          <div className="border-b border-psi-soft/60 bg-psi-soft/20 px-5 py-3 text-sm font-bold text-muted">
            {`${filtered.length} de ${psicologos.length} registros`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed text-left text-[13px]">
              {/* Larguras fixas: sem elas, abrir os detalhes de uma linha
                  redistribuía as colunas e o cabeçalho "pulava". */}
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[28%]" />
              </colgroup>
              <thead className="border-b border-psi-soft/60 bg-psi-soft/30 text-[11px] font-black uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-3 py-3">Psicólogo</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Turnos</th>
                  <th className="px-3 py-3">Capacidade</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-psi-soft/40">
          {filtered.map((p) => (
            <PsicologoCard
              key={p.id}
              p={p}
              ocupado={ocupado}
              onAprovar={(item) => void aprovar(item)}
              onRecusar={(item) => void recusar(item)}
              onAtualizarControles={atualizar}
              onEditar={(item) => setEditando(item)}
              onAjustarLimite={(item) => setLimiteAlvo(item)}
              onPriorizar={(item) => void priorizarNaFila(item)}
              onReenviarConvite={(item) => void reenviarConvite(item)}
              onAprovarSolicitacaoGestao={aprovarSolicitacaoGestao}
              onRecusarSolicitacaoGestao={recusarSolicitacaoGestao}
              onVinculoAlterado={loadPsicologos}
            />
          ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Turmas, prazo de saída e cursos ficam numa área própria (1.01–1.05 e 2.01). */}
      <Link
        href="/gestao/cursos?aba=turmas"
        className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5 text-sm font-extrabold text-ink shadow-card hover:bg-slate-50"
      >
        <span>Turmas, prazo de saída da vitrine e cursos</span>
        <span className="text-xs font-bold text-psi-deep">Abrir Cursos e turmas →</span>
      </Link>

      {editando && (
        <ModalEdicao
          psicologo={editando}
          onSalvar={async (mudancas) => {
            if (await atualizar(editando.id, mudancas)) setEditando(null);
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
