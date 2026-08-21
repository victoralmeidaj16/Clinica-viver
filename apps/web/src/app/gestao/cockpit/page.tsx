'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Clock,
  UserCheck,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Search,
  Users,
  ArrowRightLeft,
  FileText,
  X,
  Save,
} from 'lucide-react';
import { BrazilLocationFields } from '@/components/forms/BrazilLocationFields';
import { GenderFields } from '@/components/forms/GenderFields';
import { CadastroPsicologoForm } from '@/components/forms/CadastroPsicologoForm';
import { TurnoPreferenceField } from '@/components/forms/TurnoPreferenceField';
import { ModalEdicao } from '@/components/gestao/ModalEdicao';
import type { PsicologoItem } from '@/components/gestao/types';
import { TIPOS_ATENDIMENTO } from '@/components/forms/opcoesPsicologo';
import { formatBrazilPhone } from '@/lib/brazilPhone';
import type { GenderValue } from '@/lib/gender';
import {
  normalizarTurnoPreferencia,
  rotuloTurnoPreferencia,
  type TurnoPreferencia,
} from '@/lib/turnos';

/** Linha da fila, como o `GET /api/application/triagem` a devolve. */
interface LeadFila {
  id: string;
  protocolo: string;
  nomePaciente: string;
  telefone: string;
  modalidade?: string;
  servico?: string;
  turno: string;
  status: string;
  psicologoAlocadoId?: string;
  psicologoNome?: string;
  alocadoEm?: string;
  confirmadoEm?: string;
  slaExpirado?: boolean;
  transbordos?: number;
  slaStatus: 'VERDE' | 'AMARELO' | 'VERMELHO';
  horasDecorridas: number | null;
}

/** Cadastro de psicólogo, em qualquer etapa do credenciamento. */
interface PsicologoCadastro {
  id: string;
  nomeCompleto: string;
  nomeSocial?: string;
  crp: string;
  whatsapp: string;
  email?: string;
  cidadeUf?: string;
  estadoUf?: string;
  cidade?: string;
  logradouro?: string;
  bairro?: string;
  genero?: GenderValue;
  generoOutro?: string;
  especialidade?: string;
  modalidadeAtendimento?: string;
  minibio?: string;
  status: 'EM_ANALISE' | 'APROVADO' | 'RECUSADO';
  fotoUrl?: string;
  atendimentoPreferencia?: 'PARTICULAR' | 'SOCIAL' | 'AMBOS';
  turnosDisponiveis?: string[];
  modalidadesAtendidas?: string[];
  servicosHabilitados?: string[];
  servicosPrestados?: string[];
  publicoAlvo?: string[];
  publicoAlvoOutro?: string;
  especificarNecessidades?: boolean;
  necessidadesAtendidas?: string[];
  necessidadesOutro?: string;
  limitePacientesAtivos?: number;
  pacientesAtivosCount?: number;
  exibirNaVitrine?: boolean;
  motivoDesativacao?: string;
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
}

const nomeExibicao = (psi: PsicologoCadastro): string => psi.nomeSocial?.trim() || psi.nomeCompleto;

const LIMITE_PADRAO = 5;

/**
 * Um profissional aprovado só entra no rodízio depois que a gestão define a
 * faixa de valor e o turno que ele atende — o formulário de candidatura não
 * coleta isso. Sem o aviso, o cadastro pareceria pronto e nunca receberia
 * ninguém, sem explicação em lugar nenhum.
 */
const cadastroIncompletoParaRodizio = (psi: PsicologoCadastro): boolean =>
  psi.status === 'APROVADO' &&
  ((psi.modalidadesAtendidas ?? []).length === 0 || (psi.turnosDisponiveis ?? []).length === 0);

/** Status do prazo reutilizado na leitura em cartões da fila, no celular. */
function BadgeSla({ item }: { item: LeadFila }) {
  if (item.confirmadoEm) {
    return (
      <span className="bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
        Contato confirmado
      </span>
    );
  }
  if (item.slaStatus === 'VERDE') {
    return (
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
        Normal (&lt; 12h)
      </span>
    );
  }
  if (item.slaStatus === 'AMARELO') {
    return (
      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
        Atenção (&gt; 12h)
      </span>
    );
  }
  return (
    <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
      Estourado (&gt; 24h)
    </span>
  );
}

export default function GestaoCockpitPage() {
  const [abaAtiva, setAbaAtiva] = useState<'FILA' | 'CREDENCIAMENTOS' | 'PROFISSIONAIS'>('FILA');

  const [leads, setLeads] = useState<LeadFila[]>([]);
  const [cadastros, setCadastros] = useState<PsicologoCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [cadastroAberto, setCadastroAberto] = useState<PsicologoCadastro | null>(null);

  /**
   * Recarrega fila e cadastros das rotas de gestão.
   *
   * O `GET` da fila varre o SLA antes de responder, então abrir ou atualizar o
   * cockpit é também o que mantém os transbordos em dia enquanto não há um
   * agendador pendurado na varredura.
   */
  const recarregar = useCallback(async () => {
    try {
      const [respFila, respCadastros] = await Promise.all([
        fetch('/api/application/triagem', { cache: 'no-store' }),
        fetch('/api/application/credenciamento-psicologo', { cache: 'no-store' }),
      ]);

      const fila = await respFila.json();
      const psis = await respCadastros.json();

      if (!fila.success || !psis.success) {
        setErroCarga(fila.error ?? psis.error ?? 'Não foi possível carregar os dados.');
        return;
      }

      setLeads(fila.data as LeadFila[]);
      setCadastros(psis.data as PsicologoCadastro[]);
      // O aviso só some quando a carga volta a dar certo: apagá-lo no início da
      // tentativa faria o erro piscar e sumir antes de alguém ler.
      setErroCarga(null);
    } catch {
      setErroCarga('Falha de conexão ao carregar o cockpit.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // A carga sai do corpo do efeito para um microtask: assim o primeiro
  // `setState` acontece depois do render, e não dentro dele.
  useEffect(() => {
    void Promise.resolve().then(recarregar);
  }, [recarregar]);

  const psicologosPendentes = cadastros.filter((psi) => psi.status !== 'APROVADO');
  const profissionais = cadastros.filter((psi) => psi.status === 'APROVADO');

  const atualizarCadastro = async (id: string, mudancas: Record<string, unknown>) => {
    const resposta = await fetch(`/api/application/credenciamento-psicologo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mudancas),
    });
    const corpo = await resposta.json();
    if (!corpo.success) {
      setErroCarga(corpo.error ?? 'Não foi possível salvar a alteração.');
      return;
    }
    await recarregar();
  };

  const toggleAtivoPsicologo = (psi: PsicologoCadastro) =>
    atualizarCadastro(psi.id, {
      exibirNaVitrine: !(psi.exibirNaVitrine ?? true),
      motivoDesativacao: 'Pausa solicitada à gestão',
    });

  const [filtroModalidade, setFiltroModalidade] = useState<string>('TODAS');
  const [filtroTurno, setFiltroTurno] = useState<string>('TODOS');
  const [filtroBusca, setFiltroBusca] = useState<string>('');

  const leadsFiltrados = leads.filter((item) => {
    const modalidade = (item.modalidade ?? '').toUpperCase();
    const matchModalidade =
      filtroModalidade === 'TODAS' ||
      (filtroModalidade === 'SOCIAL' && modalidade.includes('SOCIAL')) ||
      (filtroModalidade === 'PARTICULAR' && modalidade.includes('PARTICULAR')) ||
      (filtroModalidade === 'AVALIACAO' && (item.servico ?? '').toLowerCase().includes('avaliação'));

    const turno = normalizarTurnoPreferencia(item.turno);
    const matchTurno =
      filtroTurno === 'TODOS' ||
      turno === filtroTurno;

    const busca = filtroBusca.trim().toLowerCase();
    const matchBusca =
      !busca ||
      item.nomePaciente.toLowerCase().includes(busca) ||
      (item.psicologoNome ?? '').toLowerCase().includes(busca) ||
      item.telefone.includes(filtroBusca) ||
      item.protocolo.toLowerCase().includes(busca);

    return matchModalidade && matchTurno && matchBusca;
  });

  const [novoLeadModal, setNovoLeadModal] = useState(false);
  const [novoPsiModal, setNovoPsiModal] = useState(false);
  const [enviandoLead, setEnviandoLead] = useState(false);
  const [manualForm, setManualForm] = useState({
    nome: '',
    telefone: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
    modalidade: 'SOCIAL',
    turno: '' as TurnoPreferencia | '',
  });

  const handleAprovarPsicologo = (id: string) =>
    atualizarCadastro(id, { status: 'APROVADO', exibirNaVitrine: true });
  const handleRecusarPsicologo = (id: string) => atualizarCadastro(id, { status: 'RECUSADO' });

  const abrirFormularioCadastro = (psi: PsicologoCadastro) => {
    setCadastroAberto(psi);
  };

  const fecharFormularioCadastro = () => {
    setCadastroAberto(null);
  };

  /**
   * Transbordo manual pela mesma varredura do automático.
   *
   * O lead só troca de profissional se as 24h realmente tiverem passado — o
   * botão antecipa a checagem, não o prazo. Um atalho que pulasse a regra seria
   * uma segunda regra, e a primeira a divergir da automática.
   */
  const handleForcarTransbordo = async (leadId: string) => {
    const resposta = await fetch('/api/application/triagem/sla-sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    });
    const corpo = await resposta.json();

    if (!corpo.success) {
      setErroCarga(corpo.error ?? 'Não foi possível executar o transbordo.');
      return;
    }
    if (corpo.transbordosExecutados === 0) {
      setErroCarga(
        'Nada a transbordar: o prazo de 24h ainda não venceu ou não há outro profissional elegível.'
      );
    }
    await recarregar();
  };

  /**
   * Cadastro manual de lead — quem chegou por WhatsApp ou indicação.
   *
   * Passa pela mesma rota da vitrine de propósito: o rodízio, o SLA e o disparo
   * duplo valem igual para quem entrou pelo site e para quem chamou no
   * WhatsApp. Cadastro manual que não entra na fila é a planilha paralela de
   * volta.
   */
  const handleCadastrarLeadManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoLead(true);
    try {
      const resposta = await fetch('/api/application/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: manualForm.nome,
          whatsapp: manualForm.telefone,
          genero: manualForm.genero,
          generoOutro: manualForm.generoOutro,
          modalidade: manualForm.modalidade,
          turno: manualForm.turno,
          origem: 'Cadastro manual (WhatsApp/indicação)',
        }),
      });
      const corpo = await resposta.json();

      if (!corpo.success) {
        setErroCarga(corpo.error ?? 'Não foi possível cadastrar o lead.');
        return;
      }

      setNovoLeadModal(false);
      setManualForm({ nome: '', telefone: '', genero: '', generoOutro: '', modalidade: 'SOCIAL', turno: '' });
      await recarregar();
    } finally {
      setEnviandoLead(false);
    }
  };

  const aguardandoContato = leads.filter((item) => item.status === 'AGUARDANDO_CONTATO');
  const slasEstourados = aguardandoContato.filter((item) => item.slaStatus === 'VERMELHO').length;
  const semProfissional = leads.filter((item) => item.status === 'PENDENTE_ATRIBUICAO').length;

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

        {/* No celular os três botões viram uma coluna: lado a lado, cada um
            ficaria com duas palavras por linha e um alvo de toque estreito. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => void recarregar()}
            className="bg-surface hover:bg-slate-100 border border-line text-ink font-extrabold text-xs px-4 py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-psi-vibrant" />
            Atualizar fila
          </button>

          <button
            type="button"
            onClick={() => setNovoPsiModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            + Cadastrar Psicólogo Manualmente
          </button>

          <button
            type="button"
            onClick={() => setNovoLeadModal(true)}
            className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Cadastro Manual de Lead (WhatsApp)
          </button>
        </div>
      </div>

      {/* Modal de Cadastrar Lead Manual */}
      {novoLeadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-line shadow-2xl max-w-md w-full space-y-4 my-auto max-h-[90dvh] overflow-y-auto">
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

              <GenderFields
                idPrefix="paciente-manual"
                gender={manualForm.genero}
                other={manualForm.generoOutro}
                onGenderChange={(genero) => setManualForm((current) => ({ ...current, genero }))}
                onOtherChange={(generoOutro) => setManualForm((current) => ({ ...current, generoOutro }))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Modalidade</label>
                  <select
                    value={manualForm.modalidade}
                    onChange={(e) => setManualForm({ ...manualForm, modalidade: e.target.value })}
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  >
                    <option value="SOCIAL">Acessível / Social</option>
                    <option value="PARTICULAR">Particular</option>
                  </select>
                </div>

                <TurnoPreferenceField
                  name="turno-manual"
                  value={manualForm.turno}
                  onChange={(turno) => setManualForm((current) => ({ ...current, turno }))}
                  compact
                />
              </div>

              <button
                type="submit"
                disabled={enviandoLead}
                className="w-full bg-psi-vibrant text-white font-extrabold py-3 rounded-2xl shadow-md hover:bg-psi-vibrant/90 transition-all disabled:opacity-60"
              >
                {enviandoLead ? 'ALOCANDO…' : 'ALOCAR NA FILA ROUND-ROBIN'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cadastrar Psicólogo — mesmo formulário da vitrine */}
      {novoPsiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <CadastroPsicologoForm
            className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-2xl max-w-2xl w-full space-y-6 my-8"
            eyebrow="Cadastro pela gestão"
            titulo="Cadastrar Psicólogo na Clínica"
            descricao="Mesmo formulário da vitrine. Ao enviar, o profissional já entra aprovado e visível na vitrine."
            labelCancelar="Fechar"
            labelEnviar="CADASTRAR E ATIVAR NA CLÍNICA"
            onCancelar={() => setNovoPsiModal(false)}
            onSucesso={async (cadastro) => {
              // Cadastro feito pela gestão não passa pela análise: aprova na hora.
              await atualizarCadastro(cadastro.id, { status: 'APROVADO', exibirNaVitrine: true });
              setNovoPsiModal(false);
              await recarregar();
            }}
          />
        </div>
      )}

      {erroCarga && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-5 py-3 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {erroCarga}
        </div>
      )}

      {/* KPI Cards SLA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Aguardando contato</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {aguardandoContato.length} {aguardandoContato.length === 1 ? 'lead' : 'leads'}
            </h3>
            {semProfissional > 0 && (
              <p className="text-[10px] font-bold text-amber-700 mt-1">
                + {semProfissional} sem profissional elegível
              </p>
            )}
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Credenciamentos em análise</span>
            <h3 className="text-2xl font-black text-purple-600 mt-1">
              {psicologosPendentes.filter((p) => p.status === 'EM_ANALISE').length} psicólogos
            </h3>
          </div>
          <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">SLA estourado (&gt; 24h)</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">
              {slasEstourados} {slasEstourados === 1 ? 'lead' : 'leads'}
            </h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navegação de Abas — deslizam de lado no celular em vez de encolher
          até o rótulo virar duas letras por linha. */}
      <div className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setAbaAtiva('FILA')}
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 ${
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
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 ${
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
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 ${
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
          <div className="p-5 sm:p-6 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-base text-ink">Monitoramento da Fila de Atribuição (SLA 24h)</h3>
              <p className="text-xs text-muted">Leads em andamento e contagem regressiva para confirmação via WhatsApp</p>
            </div>

            {/* Barra de Filtros Rápida */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Busca */}
              <div className="relative w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Buscar paciente ou psi..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="w-full sm:w-44 pl-8 pr-3 py-2 bg-slate-50 border border-line rounded-xl text-ink focus:outline-none focus:border-psi-vibrant"
                />
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Filtro por Modalidade */}
              <select
                value={filtroModalidade}
                onChange={(e) => setFiltroModalidade(e.target.value)}
                className="flex-1 min-w-[9.5rem] sm:flex-none py-2 px-3 bg-slate-50 border border-line rounded-xl font-bold text-ink focus:outline-none focus:border-psi-vibrant"
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
                className="flex-1 min-w-[8rem] sm:flex-none py-2 px-3 bg-slate-50 border border-line rounded-xl font-bold text-ink focus:outline-none focus:border-psi-vibrant"
              >
                <option value="TODOS">Todos Turnos</option>
                <option value="MANHA">Manhã</option>
                <option value="TARDE">Tarde</option>
                <option value="NOITE">Noite</option>
              </select>
            </div>
          </div>

          {/**
           * Até `lg`, cada lead é um cartão.
           *
           * A fila tem sete colunas — nome, telefone, modalidade, psicólogo,
           * tempo, status e ação. Espremidas num aparelho de mão, viram
           * palavras de uma letra por linha; postas para rolar de lado,
           * escondem justamente a cor do SLA, que é o motivo de alguém abrir
           * esta tela. O cartão põe status e prazo em cima, onde a decisão
           * acontece. O status e o botão são os mesmos componentes usados na
           * tabela, para as duas leituras não divergirem.
           */}
          <div className="lg:hidden divide-y divide-line">
            {carregando ? (
              <p className="px-5 py-8 text-center text-muted text-xs font-semibold">Carregando a fila…</p>
            ) : leadsFiltrados.length === 0 ? (
              <p className="px-5 py-8 text-center text-muted text-xs font-semibold">
                {leads.length === 0
                  ? 'Nenhuma solicitação recebida até agora.'
                  : 'Nenhum lead encontrado com os filtros selecionados.'}
              </p>
            ) : (
              leadsFiltrados.map((item) => (
                <article key={item.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-sm text-ink truncate">{item.nomePaciente}</p>
                      <p className="text-[10px] text-muted font-mono">{item.protocolo}</p>
                    </div>
                    <BadgeSla item={item} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Contato</dt>
                      <dd className="font-semibold text-ink truncate">
                        <a href={`tel:${item.telefone.replace(/\D/g, '')}`} className="hover:text-psi-vibrant">
                          {item.telefone}
                        </a>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Tempo decorrido</dt>
                      <dd className="font-mono font-bold text-ink">
                        {item.horasDecorridas === null ? '—' : `${item.horasDecorridas.toFixed(1)}h`}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Modalidade / turno</dt>
                      <dd className="font-semibold text-ink">{item.servico || item.modalidade || '—'}</dd>
                      <dd className="text-[10px] text-muted">{rotuloTurnoPreferencia(item.turno)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Psicólogo</dt>
                      <dd className="font-bold text-psi-vibrant truncate">
                        {item.psicologoNome ?? <span className="text-amber-700">Sem profissional elegível</span>}
                      </dd>
                      {(item.transbordos ?? 0) > 0 && (
                        <dd className="text-[10px] text-amber-700 font-bold">
                          após {item.transbordos} {item.transbordos === 1 ? 'transbordo' : 'transbordos'}
                        </dd>
                      )}
                    </div>
                  </dl>

                  {!item.confirmadoEm && item.psicologoAlocadoId && (
                    <button
                      type="button"
                      onClick={() => handleForcarTransbordo(item.id)}
                      className="w-full bg-surface hover:bg-slate-100 border border-line text-ink font-bold text-[11px] px-3 py-2.5 rounded-xl transition-all inline-flex items-center justify-center gap-1"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-psi-vibrant" />
                      Forçar Transbordo
                    </button>
                  )}
                </article>
              ))
            )}
          </div>

          <div className="hidden lg:block overflow-x-auto">
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
                {carregando ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted font-semibold">
                      Carregando a fila…
                    </td>
                  </tr>
                ) : leadsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted font-semibold">
                      {leads.length === 0
                        ? 'Nenhuma solicitação recebida até agora.'
                        : 'Nenhum lead encontrado com os filtros selecionados.'}
                    </td>
                  </tr>
                ) : (
                  leadsFiltrados.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-ink">{item.nomePaciente}</div>
                        <div className="text-[10px] text-muted font-mono">{item.protocolo}</div>
                      </td>
                      <td className="px-6 py-4 text-muted">{item.telefone}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-ink">{item.servico || item.modalidade || '—'}</div>
                        <div className="text-[10px] text-muted">{rotuloTurnoPreferencia(item.turno)}</div>
                      </td>
                      <td className="px-6 py-4">
                        {item.psicologoNome ? (
                          <>
                            <span className="font-bold text-psi-vibrant">{item.psicologoNome}</span>
                            {(item.transbordos ?? 0) > 0 && (
                              <div className="text-[10px] text-amber-700 font-bold">
                                após {item.transbordos}{' '}
                                {item.transbordos === 1 ? 'transbordo' : 'transbordos'}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="font-bold text-amber-700">Sem profissional elegível</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-ink">
                        {item.horasDecorridas === null ? '—' : `${item.horasDecorridas.toFixed(1)}h`}
                      </td>
                      <td className="px-6 py-4">
                        {item.confirmadoEm ? (
                          <span className="bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            Contato confirmado
                          </span>
                        ) : item.slaStatus === 'VERDE' ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            Normal (&lt; 12h)
                          </span>
                        ) : item.slaStatus === 'AMARELO' ? (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            Atenção (&gt; 12h)
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                            Estourado (&gt; 24h)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!item.confirmadoEm && item.psicologoAlocadoId && (
                          <button
                            type="button"
                            onClick={() => handleForcarTransbordo(item.id)}
                            className="bg-surface hover:bg-slate-100 border border-line text-ink font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-psi-vibrant" />
                            Forçar Transbordo
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
                {psicologosPendentes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted font-semibold">
                      {carregando ? 'Carregando…' : 'Nenhuma solicitação de credenciamento pendente.'}
                    </td>
                  </tr>
                )}
                {psicologosPendentes.map((psi) => (
                  <tr key={psi.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => abrirFormularioCadastro(psi)}
                        className="font-extrabold text-ink hover:text-psi-vibrant text-left inline-flex items-center gap-1.5"
                        title="Abrir formulário preenchido"
                      >
                        <FileText className="w-3.5 h-3.5 text-psi-vibrant" />
                        {nomeExibicao(psi)}
                      </button>
                      <div className="text-[10px] text-muted italic line-clamp-1">{psi.minibio}</div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-psi-vibrant">{psi.crp}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-ink">{formatBrazilPhone(psi.whatsapp)}</div>
                      <div className="text-[10px] text-muted">{psi.cidade && psi.estadoUf ? `${psi.cidade}/${psi.estadoUf}` : psi.cidadeUf}</div>
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirFormularioCadastro(psi)}
                          className="bg-white hover:bg-purple-50 text-psi-deep border border-psi-soft font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Abrir formulário
                        </button>
                        {psi.status === 'EM_ANALISE' ? (
                          <>
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
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">Concluído</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                {profissionais.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted font-semibold">
                      {carregando
                        ? 'Carregando…'
                        : 'Nenhum psicólogo aprovado ainda. Aprove um credenciamento para que ele entre no rodízio.'}
                    </td>
                  </tr>
                )}
                {profissionais.map((psi) => {
                  const ativo = psi.exibirNaVitrine ?? true;
                  const teto = psi.limitePacientesAtivos ?? LIMITE_PADRAO;
                  const ativos = psi.pacientesAtivosCount ?? 0;
                  const noTeto = ativos >= teto;

                  return (
                    <tr key={psi.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-ink">{nomeExibicao(psi)}</div>
                        <div className="text-[10px] text-muted">
                          {[psi.email, psi.whatsapp].filter(Boolean).join(' • ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-psi-vibrant">{psi.crp}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-ink">
                          {psi.turmaViverMais ? `Turma ${psi.turmaViverMais}` : 'Turma não informada'}
                        </div>
                        <div className="text-[10px] text-muted line-clamp-1">{psi.posGraduacaoViverMais}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-extrabold ${noTeto ? 'text-rose-700' : 'text-ink'}`}>
                          {ativos} / {teto} pacientes
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {/* Três estados distintos, porque pedem ações distintas: pausa é
                            decisão da gestão, teto é consequência da agenda, e cadastro
                            incompleto é trabalho que ficou pela metade. */}
                        {!ativo ? (
                          <div>
                            <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-block">
                              ○ Desativado do rodízio
                            </span>
                            {psi.motivoDesativacao && (
                              <p className="text-[10px] text-rose-600 font-semibold mt-1">{psi.motivoDesativacao}</p>
                            )}
                          </div>
                        ) : noTeto ? (
                          <div>
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-block">
                              ◐ Fora da vez
                            </span>
                            <p className="text-[10px] text-amber-700 font-semibold mt-1">
                              Teto de pacientes atingido
                            </p>
                          </div>
                        ) : cadastroIncompletoParaRodizio(psi) ? (
                          <div>
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-block">
                              ◐ Cadastro incompleto
                            </span>
                            <p className="text-[10px] text-amber-700 font-semibold mt-1">
                              Falta definir turno e faixa de valor
                            </p>
                          </div>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                            ● Ativo no rodízio
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void toggleAtivoPsicologo(psi)}
                          className={`font-extrabold text-[11px] px-4 py-2 rounded-xl transition-all shadow-sm ${
                            ativo
                              ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {ativo ? 'Desativar perfil' : 'Ativar no rodízio'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cadastroAberto && (
        <ModalEdicao
          psicologo={cadastroAberto as PsicologoItem}
          onSalvar={async (mudancas) => {
            const alvo = cadastroAberto;
            setCadastroAberto(null);
            await atualizarCadastro(alvo.id, mudancas);
          }}
          onCancelar={() => setCadastroAberto(null)}
        />
      )}
    </div>
  );
}
