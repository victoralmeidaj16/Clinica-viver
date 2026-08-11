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
import { formatBrazilPhone, maskBrazilPhoneInput } from '@/lib/brazilPhone';
import type { GenderValue } from '@/lib/gender';

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
  turnosDisponiveis?: string[];
  modalidadesAtendidas?: string[];
  servicosHabilitados?: string[];
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

const textoLista = (lista?: string[]): string => (lista ?? []).join(', ');
const listaTexto = (texto: string): string[] =>
  texto.split(',').map((item) => item.trim()).filter(Boolean);

/**
 * Um profissional aprovado só entra no rodízio depois que a gestão define a
 * faixa de valor e o turno que ele atende — o formulário de candidatura não
 * coleta isso. Sem o aviso, o cadastro pareceria pronto e nunca receberia
 * ninguém, sem explicação em lugar nenhum.
 */
const cadastroIncompletoParaRodizio = (psi: PsicologoCadastro): boolean =>
  psi.status === 'APROVADO' &&
  ((psi.modalidadesAtendidas ?? []).length === 0 || (psi.turnosDisponiveis ?? []).length === 0);

export default function GestaoCockpitPage() {
  const [abaAtiva, setAbaAtiva] = useState<'FILA' | 'CREDENCIAMENTOS' | 'PROFISSIONAIS'>('FILA');

  const [leads, setLeads] = useState<LeadFila[]>([]);
  const [cadastros, setCadastros] = useState<PsicologoCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [cadastroAberto, setCadastroAberto] = useState<PsicologoCadastro | null>(null);
  const [cadastroEditado, setCadastroEditado] = useState<PsicologoCadastro | null>(null);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);

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

    const turno = item.turno.toUpperCase();
    const matchTurno =
      filtroTurno === 'TODOS' ||
      (filtroTurno === 'MANHA' && (turno.includes('MATUTINO') || turno.includes('MANH'))) ||
      (filtroTurno === 'TARDE' && (turno.includes('VESPERTINO') || turno.includes('TARDE'))) ||
      (filtroTurno === 'NOITE' && (turno.includes('NOTURNO') || turno.includes('NOITE')));

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
  const [enviandoPsi, setEnviandoPsi] = useState(false);
  const [manualForm, setManualForm] = useState({
    nome: '',
    telefone: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
    modalidade: 'SOCIAL',
    turno: 'VESPERTINO',
  });

  const [manualPsiForm, setManualPsiForm] = useState({
    nomeCompleto: '',
    nomeSocial: '',
    crp: '',
    whatsapp: '',
    email: '',
    estadoUf: '',
    cidade: '',
    logradouro: '',
    bairro: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
    especialidade: 'Psicoterapia Cognitivo-Comportamental',
    turmaViverMais: '24A',
    posGraduacaoViverMais: 'Especialização em Psicoterapia Cognitivo-Comportamental',
  });

  const handleCadastrarPsiManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoPsi(true);
    try {
      const resposta = await fetch('/api/application/credenciamento-psicologo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manualPsiForm,
          modalidadeAtendimento: 'On-line & Presencial',
          minibio: 'Profissional cadastrado diretamente pela gestão da clínica.',
          disponibilidadeTurnos: ['MATUTINO', 'VESPERTINO', 'NOTURNO'],
          servicosHabilitados: ['PSICOTERAPIA', 'AVALIACAO'],
        }),
      });
      const corpo = await resposta.json();

      if (!corpo.success) {
        setErroCarga(corpo.error ?? 'Não foi possível cadastrar o psicólogo.');
        return;
      }

      // Aprova imediatamente o psicólogo cadastrado manualmente pela gestão
      await atualizarCadastro(corpo.data.id, { status: 'APROVADO', exibirNaVitrine: true });

      setNovoPsiModal(false);
      setManualPsiForm({
        nomeCompleto: '',
        nomeSocial: '',
        crp: '',
        whatsapp: '',
        email: '',
        estadoUf: '',
        cidade: '',
        logradouro: '',
        bairro: '',
        genero: '' as GenderValue | '',
        generoOutro: '',
        especialidade: 'Psicoterapia Cognitivo-Comportamental',
        turmaViverMais: '24A',
        posGraduacaoViverMais: 'Especialização em Psicoterapia Cognitivo-Comportamental',
      });
      await recarregar();
    } finally {
      setEnviandoPsi(false);
    }
  };

  const handleAprovarPsicologo = (id: string) =>
    atualizarCadastro(id, { status: 'APROVADO', exibirNaVitrine: true });
  const handleRecusarPsicologo = (id: string) => atualizarCadastro(id, { status: 'RECUSADO' });

  const abrirFormularioCadastro = (psi: PsicologoCadastro) => {
    setCadastroAberto(psi);
    setCadastroEditado({ ...psi });
  };

  const fecharFormularioCadastro = () => {
    if (salvandoCadastro) return;
    setCadastroAberto(null);
    setCadastroEditado(null);
  };

  const salvarFormularioCadastro = async () => {
    if (!cadastroEditado) return;
    setSalvandoCadastro(true);
    try {
      const { id, ...mudancas } = cadastroEditado;
      await atualizarCadastro(id, mudancas);
      setCadastroAberto(null);
      setCadastroEditado(null);
    } finally {
      setSalvandoCadastro(false);
    }
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
      setManualForm({ nome: '', telefone: '', genero: '', generoOutro: '', modalidade: 'SOCIAL', turno: 'VESPERTINO' });
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void recarregar()}
            className="bg-surface hover:bg-slate-100 border border-line text-ink font-extrabold text-xs px-4 py-3 rounded-2xl transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-psi-vibrant" />
            Atualizar fila
          </button>

          <button
            type="button"
            onClick={() => setNovoPsiModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            + Cadastrar Psicólogo Manualmente
          </button>

          <button
            type="button"
            onClick={() => setNovoLeadModal(true)}
            className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Cadastro Manual de Lead (WhatsApp)
          </button>
        </div>
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

              <GenderFields
                idPrefix="paciente-manual"
                gender={manualForm.genero}
                other={manualForm.generoOutro}
                onGenderChange={(genero) => setManualForm((current) => ({ ...current, genero }))}
                onOtherChange={(generoOutro) => setManualForm((current) => ({ ...current, generoOutro }))}
              />

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="font-bold text-ink block mb-1">Turno</label>
                  <select
                    value={manualForm.turno}
                    onChange={(e) => setManualForm({ ...manualForm, turno: e.target.value })}
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  >
                    <option value="MATUTINO">Manhã</option>
                    <option value="VESPERTINO">Tarde</option>
                    <option value="NOTURNO">Noite</option>
                  </select>
                </div>
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

      {/* Modal de Cadastrar Psicólogo Manualmente */}
      {novoPsiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-lg font-black text-ink">Cadastro Manual de Psicólogo</h2>
                <p className="text-[11px] text-muted">Cadastre e credencie imediatamente um novo psicólogo na clínica</p>
              </div>
              <button
                type="button"
                onClick={() => setNovoPsiModal(false)}
                className="text-muted hover:text-ink text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCadastrarPsiManual} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Nome Completo <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={manualPsiForm.nomeCompleto}
                  onChange={(e) => setManualPsiForm({ ...manualPsiForm, nomeCompleto: e.target.value })}
                  placeholder="Nome do psicólogo"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Nome social</label>
                <input
                  type="text"
                  value={manualPsiForm.nomeSocial}
                  onChange={(e) => setManualPsiForm({ ...manualPsiForm, nomeSocial: e.target.value })}
                  placeholder="Como prefere ser chamado"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">CRP <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={manualPsiForm.crp}
                    onChange={(e) => setManualPsiForm({ ...manualPsiForm, crp: e.target.value })}
                    placeholder="CRP 00/0000"
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">WhatsApp <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={manualPsiForm.whatsapp}
                    onChange={(e) => setManualPsiForm({ ...manualPsiForm, whatsapp: maskBrazilPhoneInput(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">E-mail <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  required
                  value={manualPsiForm.email}
                  onChange={(e) => setManualPsiForm({ ...manualPsiForm, email: e.target.value })}
                  placeholder="email@exemplo.com.br"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500"
                />
              </div>

              <GenderFields
                idPrefix="psicologo-manual"
                gender={manualPsiForm.genero}
                other={manualPsiForm.generoOutro}
                onGenderChange={(genero) => setManualPsiForm((current) => ({ ...current, genero }))}
                onOtherChange={(generoOutro) => setManualPsiForm((current) => ({ ...current, generoOutro }))}
              />

              <BrazilLocationFields
                estadoUf={manualPsiForm.estadoUf}
                cidade={manualPsiForm.cidade}
                onEstadoChange={(estadoUf) => setManualPsiForm((current) => ({ ...current, estadoUf, cidade: '' }))}
                onCidadeChange={(cidade) => setManualPsiForm((current) => ({ ...current, cidade }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Rua / logradouro <span className="text-rose-500">*</span></label>
                  <input required value={manualPsiForm.logradouro} onChange={(e) => setManualPsiForm({ ...manualPsiForm, logradouro: e.target.value })} className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Bairro <span className="text-rose-500">*</span></label>
                  <input required value={manualPsiForm.bairro} onChange={(e) => setManualPsiForm({ ...manualPsiForm, bairro: e.target.value })} className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Turma Viver Mais</label>
                <select
                  value={manualPsiForm.turmaViverMais}
                  onChange={(e) => setManualPsiForm({ ...manualPsiForm, turmaViverMais: e.target.value })}
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="22A">Turma 22A</option>
                  <option value="22B">Turma 22B</option>
                  <option value="23A">Turma 23A</option>
                  <option value="23B">Turma 23B</option>
                  <option value="24A">Turma 24A</option>
                  <option value="24B">Turma 24B</option>
                  <option value="25A">Turma 25A</option>
                  <option value="25B">Turma 25B</option>
                  <option value="26A">Turma 26A</option>
                  <option value="26B">Turma 26B</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Pós-Graduação Viver Mais</label>
                <input
                  type="text"
                  value={manualPsiForm.posGraduacaoViverMais}
                  onChange={(e) => setManualPsiForm({ ...manualPsiForm, posGraduacaoViverMais: e.target.value })}
                  placeholder="Nome do curso de especialização"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={enviandoPsi}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl shadow-md transition-all disabled:opacity-60"
              >
                {enviandoPsi ? 'CADASTRANDO…' : 'CADASTRAR E ATIVAR NA CLÍNICA'}
              </button>
            </form>
          </div>
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
                        <div className="text-[10px] text-muted">{item.turno}</div>
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

      {cadastroAberto && cadastroEditado && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="max-w-4xl mx-auto my-8 bg-white rounded-3xl shadow-2xl border border-line overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-psi-vibrant">Credenciamento da vitrine</p>
                <h2 className="text-xl font-extrabold text-ink">Formulário preenchido pelo psicólogo</h2>
                <p className="text-xs text-muted mt-1">Confira ou corrija os dados enviados antes de aprovar o acesso.</p>
              </div>
              <button type="button" onClick={fecharFormularioCadastro} className="p-2 rounded-xl text-muted hover:bg-slate-100" aria-label="Fechar formulário">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[68vh] overflow-y-auto">
              {([
                ['nomeCompleto', 'Nome completo'],
                ['nomeSocial', 'Nome social'],
                ['crp', 'CRP'],
                ['whatsapp', 'WhatsApp'],
                ['email', 'E-mail'],
                ['logradouro', 'Rua / logradouro'],
                ['bairro', 'Bairro'],
                ['especialidade', 'Especialidade'],
                ['modalidadeAtendimento', 'Modalidade de atendimento'],
                ['turmaViverMais', 'Turma Viver Mais'],
                ['posGraduacaoViverMais', 'Pós-graduação Viver Mais'],
                ['segundaPosGraduacao', 'Segunda pós-graduação'],
              ] as const).map(([campo, rotulo]) => (
                <label key={campo} className="text-xs font-bold text-ink">
                  {rotulo}
                  <input
                    value={(cadastroEditado[campo] as string | undefined) ?? ''}
                    onChange={(e) => setCadastroEditado((atual) => atual ? { ...atual, [campo]: e.target.value } : atual)}
                    className="mt-1 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-psi-vibrant/20 focus:border-psi-vibrant"
                  />
                </label>
              ))}

              <div className="md:col-span-2">
                <GenderFields
                  idPrefix="psicologo-edicao"
                  gender={cadastroEditado.genero ?? ''}
                  other={cadastroEditado.generoOutro ?? ''}
                  onGenderChange={(genero) => setCadastroEditado((current) => current ? { ...current, genero: genero || undefined } : current)}
                  onOtherChange={(generoOutro) => setCadastroEditado((current) => current ? { ...current, generoOutro } : current)}
                />
              </div>

              <div className="md:col-span-2">
                <BrazilLocationFields
                  estadoUf={cadastroEditado.estadoUf ?? ''}
                  cidade={cadastroEditado.cidade ?? ''}
                  onEstadoChange={(estadoUf) => setCadastroEditado((current) => current ? { ...current, estadoUf, cidade: '' } : current)}
                  onCidadeChange={(cidade) => setCadastroEditado((current) => current ? { ...current, cidade } : current)}
                  required={false}
                />
              </div>

              <label className="text-xs font-bold text-ink">
                Limite de pacientes ativos (máximo 5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={cadastroEditado.limitePacientesAtivos ?? LIMITE_PADRAO}
                  onChange={(e) => setCadastroEditado((current) => current ? { ...current, limitePacientesAtivos: Number(e.target.value) } : current)}
                  className="mt-1 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-psi-vibrant/20 focus:border-psi-vibrant"
                />
              </label>

              <label className="md:col-span-2 text-xs font-bold text-ink">
                Minibio
                <textarea
                  value={cadastroEditado.minibio ?? ''}
                  onChange={(e) => setCadastroEditado((atual) => atual ? { ...atual, minibio: e.target.value } : atual)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-psi-vibrant/20 focus:border-psi-vibrant"
                />
              </label>

              {([
                ['turnosDisponiveis', 'Turnos disponíveis'],
                ['modalidadesAtendidas', 'Modalidades atendidas'],
                ['servicosHabilitados', 'Serviços habilitados'],
              ] as const).map(([campo, rotulo]) => (
                <label key={campo} className="text-xs font-bold text-ink">
                  {rotulo} <span className="font-normal text-muted">(separe por vírgulas)</span>
                  <input
                    value={textoLista(cadastroEditado[campo] as string[] | undefined)}
                    onChange={(e) => setCadastroEditado((atual) => atual ? { ...atual, [campo]: listaTexto(e.target.value) } : atual)}
                    className="mt-1 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-psi-vibrant/20 focus:border-psi-vibrant"
                  />
                </label>
              ))}

              <label className="text-xs font-bold text-ink">
                Status
                <select
                  value={cadastroEditado.status}
                  onChange={(e) => setCadastroEditado((atual) => atual ? { ...atual, status: e.target.value as PsicologoCadastro['status'] } : atual)}
                  className="mt-1 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-psi-vibrant/20 focus:border-psi-vibrant"
                >
                  <option value="EM_ANALISE">Em análise</option>
                  <option value="APROVADO">Aprovado</option>
                  <option value="RECUSADO">Recusado</option>
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  checked={cadastroEditado.exibirNaVitrine ?? true}
                  onChange={(e) => setCadastroEditado((atual) => atual ? { ...atual, exibirNaVitrine: e.target.checked } : atual)}
                  className="h-4 w-4 accent-psi-vibrant"
                />
                Exibir na vitrine e considerar no rodízio
              </label>
            </div>

            <div className="px-6 py-4 border-t border-line flex justify-end gap-3">
              <button type="button" onClick={fecharFormularioCadastro} className="px-4 py-2.5 rounded-xl border border-line bg-white text-slate-700 font-bold text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={() => void salvarFormularioCadastro()} disabled={salvandoCadastro} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2">
                <Save className="w-4 h-4" />
                {salvandoCadastro ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
