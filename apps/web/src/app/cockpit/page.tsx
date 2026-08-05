'use client';

import { useCallback, useEffect, useState } from 'react';
import AudioRecorder from '@/components/cockpit/AudioRecorder';
import SoapEditor from '@/components/cockpit/SoapEditor';
import OneClickApprovalModal from '@/components/cockpit/OneClickApprovalModal';
import PreSessionBriefingCard from '@/components/cockpit/PreSessionBriefingCard';
import { DEMO_PRE_SESSION_BRIEFINGS } from '@/lib/demoPreSessionCheckIn';
import {
  fetchReviewSessions,
  type PostSessionResult,
  type ReviewSession,
} from '@/lib/postSessionApi';
import { buildSoapView, type SoapView } from '@/lib/soapAiEngine';
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Zap,
  Clock,
  Check,
  UserCheck,
  Phone,
  Calendar,
  Copy,
  UserPlus,
  Lock,
} from 'lucide-react';

import { CockpitHeroCard } from '@/components/cockpit/CockpitHeroCard';

export default function CockpitPage() {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soapView, setSoapView] = useState<SoapView | null>(null);

  // Modal de Adicionar Paciente Manual (Psicólogo)
  const [modalNovoPaciente, setModalNovoPaciente] = useState(false);
  const [manualPaciente, setManualPaciente] = useState({
    nome: '',
    telefone: '',
    cpf: '',
    modalidade: 'ACESSIVEL_SOCIAL',
    valorFixado: 75.00, // VALOR TRAVADO: Psicólogo não pode alterar valor nem duração
    duracaoFixada: 50, // DURAÇÃO TRAVADA: 50 minutos
  });

  // Estados do Lead de Triagem atribuído (SLA 24h)
  const [pendingLead, setPendingLead] = useState<{
    id: string;
    nomePaciente: string;
    telefone: string;
    modalidade: string;
    turno: string;
    origem: string;
    alocadoEm: string;
    confirmado: boolean;
    cobrancaUrl?: string;
  }>({
    id: 'lead-vivermais-89312',
    nomePaciente: 'João Pedro Severo',
    telefone: '(51) 99823-4411',
    modalidade: 'Atendimento Acessível (Social)',
    turno: 'Tarde (14h - 18h)',
    origem: 'Site Viver Mais (Formulário)',
    alocadoEm: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    confirmado: false,
  });

  const [copiedLink, setCopiedLink] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSoap, setModalSoap] = useState<SoapView | null>(null);
  const [modalSummary, setModalSummary] = useState('');
  const [modalTasks, setModalTasks] = useState<string[]>([]);
  const [shareWithPatient, setShareWithPatient] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [outcome, setOutcome] = useState<PostSessionResult | null>(null);

  // Estado da Aba Ativa no Cockpit da Viver Mais
  const [activeTab, setActiveTab] = useState<'LEADS' | 'PACIENTES' | 'AGENDA' | 'DESCONTO' | 'SOAP'>('LEADS');

  const applyQueue = useCallback((queue: ReviewSession[]) => {
    setSessions(queue);
    setSelectedSessionId((current) =>
      queue.some((item) => item.sessionId === current) ? current : queue[0]?.sessionId ?? ''
    );
    setError(null);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      applyQueue(await fetchReviewSessions());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar a fila.');
    } finally {
      setIsLoading(false);
    }
  }, [applyQueue]);

  useEffect(() => {
    let mounted = true;
    fetchReviewSessions()
      .then((queue) => { if (mounted) applyQueue(queue); })
      .catch((caught: unknown) => {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Falha ao carregar a fila.');
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [applyQueue]);

  const selectedSession = sessions.find((item) => item.sessionId === selectedSessionId) ?? null;

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSoapView(null);
  };

  const handleGenerateSoap = async () => {
    if (!selectedSession?.draftContent) {
      setError('A sessão selecionada não possui rascunho clínico pendente de revisão.');
      return;
    }
    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setSoapView(buildSoapView(selectedSession));
      setError(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmContact = async () => {
    const linkUrl = `https://vivermaispsicologia.com.br/p/PAY-${Math.floor(10000 + Math.random() * 90000)}`;
    setPendingLead((prev) => ({
      ...prev,
      confirmado: true,
      cobrancaUrl: linkUrl,
    }));

    // Disparar WhatsApp via Evolution API para o paciente
    try {
      const evoUrl = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || 'http://localhost:8080';
      const evoApiKey = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || '7c49eaa59c3631963fe335f99b3860f5d6b0e0751afcdda4b8c00c9ef08e52e6';
      const evoInstance = process.env.NEXT_PUBLIC_EVOLUTION_INSTANCE || 'viver_mais_clinica';

      const textoPaciente = `Olá, ${pendingLead.nomePaciente}! 👋✨\n\nAqui é o Dr. Lucas da *Viver Mais Psicologia*.\n\nSua sessão de *${pendingLead.modalidade}* foi confirmada para o turno da *${pendingLead.turno}*!\n\n💳 Para concluir o agendamento e efetuar o pagamento da sessão (R$ 75,00), acesse seu link exclusivo:\n${linkUrl}\n\nEstou ansioso para nosso atendimento!🧠`;

      await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evoApiKey,
        },
        body: JSON.stringify({
          number: pendingLead.telefone.replace(/\D/g, ''),
          text: textoPaciente,
        }),
      });
    } catch (e) {
      console.warn('[Evolution API Cockpit Confirm] Servidor offline ou desconfigurado:', e);
    }
  };

  const handleCopyLink = () => {
    if (pendingLead.cobrancaUrl) {
      navigator.clipboard.writeText(pendingLead.cobrancaUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleSalvarPacienteManual = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Paciente ${manualPaciente.nome} adicionado com sucesso pelo psicólogo com valor de R$ ${manualPaciente.valorFixado.toFixed(2)} (Valores e duração travados pelo sistema).`);
    setModalNovoPaciente(false);
    setManualPaciente({ nome: '', telefone: '', cpf: '', modalidade: 'ACESSIVEL_SOCIAL', valorFixado: 75.00, duracaoFixada: 50 });
  };

  const handleOpenOneClickModal = (
    finalSoap: SoapView, summary: string, tasks: string[], share: boolean, whatsApp: boolean
  ) => {
    setModalSoap(finalSoap);
    setModalSummary(summary);
    setModalTasks(tasks);
    setShareWithPatient(share);
    setSendWhatsApp(whatsApp);
    setIsModalOpen(true);
  };

  const handleSuccessFinish = async (result: PostSessionResult) => {
    setOutcome(result);
    setSoapView(null);
    await loadSessions();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalSoap(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {outcome ? <OutcomeBanner result={outcome} onDismiss={() => setOutcome(null)} /> : null}

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      ) : null}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Painel do Psicólogo — Viver Mais Psicologia</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <Zap className="w-6 h-6 text-psi-vibrant fill-psi-vibrant" />
            Cockpit Clínico do Profissional
          </h1>
          <p className="text-xs text-muted">
            SLA de 24h para primeiro contato, carteira exclusiva de pacientes e abatimento automático na mensalidade.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalNovoPaciente(true)}
          className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          + Cadastrar Paciente Manual
        </button>
      </div>

      {/* NAVEGAÇÃO POR ABAS DO PSICÓLOGO (5 ABAS DA VIVER MAIS) */}
      <div className="bg-surface rounded-2xl border border-line p-1.5 flex flex-wrap items-center gap-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('LEADS')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'LEADS'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'text-muted hover:text-ink hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          1. Leads & SLA 24h
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PACIENTES')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'PACIENTES'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'text-muted hover:text-ink hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          2. Meus Pacientes & Status
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AGENDA')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'AGENDA'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'text-muted hover:text-ink hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          3. Minha Agenda (50min)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DESCONTO')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'DESCONTO'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'text-muted hover:text-ink hover:bg-slate-50'
          }`}
        >
          <Lock className="w-4 h-4" />
          4. Desconto na Mensalidade (70%)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SOAP')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'SOAP'
              ? 'bg-psi-vibrant text-white shadow-md'
              : 'text-muted hover:text-ink hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          5. Cockpit SOAP & IA
        </button>
      </div>

      {/* MODAL ADICIONAR PACIENTE MANUAL (PSICÓLOGO) */}
      {modalNovoPaciente && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">Novo Paciente (Manual)</h2>
              <button
                type="button"
                onClick={() => setModalNovoPaciente(false)}
                className="text-muted hover:text-ink text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSalvarPacienteManual} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Nome do Paciente</label>
                <input
                  type="text"
                  required
                  value={manualPaciente.nome}
                  onChange={(e) => setManualPaciente({ ...manualPaciente, nome: e.target.value })}
                  placeholder="Ex: Ana Clara Lima"
                  className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={manualPaciente.telefone}
                    onChange={(e) => setManualPaciente({ ...manualPaciente, telefone: e.target.value })}
                    placeholder="(51) 99999-9999"
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">CPF (para NF)</label>
                  <input
                    type="text"
                    required
                    value={manualPaciente.cpf}
                    onChange={(e) => setManualPaciente({ ...manualPaciente, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full bg-slate-50 border border-line rounded-xl p-2.5 text-ink focus:outline-none focus:border-psi-vibrant"
                  />
                </div>
              </div>

              {/* CAMPOS TRAVADOS / SOMENTE LEITURA PARA O PSICÓLOGO */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-bold">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Valores e Duração Travados pela Gestão da Clínica
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-amber-700 block font-semibold">Valor por Sessão</span>
                    <input
                      type="text"
                      disabled
                      value="R$ 75,00 (Tabela Social)"
                      className="w-full bg-amber-100/60 border border-amber-300 rounded-lg p-2 text-[11px] text-amber-900 font-bold cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 block font-semibold">Duração da Sessão</span>
                    <input
                      type="text"
                      disabled
                      value="50 minutos"
                      className="w-full bg-amber-100/60 border border-amber-300 rounded-lg p-2 text-[11px] text-amber-900 font-bold cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-psi-vibrant text-white font-extrabold py-3 rounded-2xl shadow-md hover:bg-psi-vibrant/90 transition-all"
              >
                VINCULAR PACIENTE AO MEU PERFIL
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 1: LEADS & SLA 24H */}
      {activeTab === 'LEADS' && (
        <div className="space-y-6">
          {/* Card da Fila da Clínica */}
          <div className="bg-surface rounded-3xl p-5 border border-line shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Rodízio da Clínica Viver Mais</span>
              <h3 className="text-lg font-black text-ink">Sua posição atual na fila de alocação: <span className="text-psi-vibrant">#2 de 8 Psicólogos</span></h3>
              <p className="text-xs text-muted">A próxima consulta de lead entrante via formulário será encaminhada para você em breve.</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-2 rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              SLA de Contato de 24h Ativo
            </div>
          </div>

          {/* Card do Lead Atribuído */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-psi-darkest text-white rounded-3xl p-6 shadow-contrast relative overflow-hidden border border-indigo-700/40">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <UserCheck className="w-48 h-48 text-indigo-400" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    SLA de Contato: Restam 21h 00m
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-3 py-1 rounded-full">
                    Novo Paciente Alocado do Site
                  </span>
                </div>

                <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  {pendingLead.nomePaciente}
                </h2>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-200">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    {pendingLead.telefone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    Pref: {pendingLead.turno}
                  </span>
                  <span className="bg-white/10 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold text-white">
                    {pendingLead.modalidade}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col gap-3">
                {!pendingLead.confirmado ? (
                  <button
                    type="button"
                    onClick={handleConfirmContact}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    SIM, JÁ ENTREI EM CONTATO
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/30">
                      <CheckCircle2 className="w-4 h-4" />
                      Contato Efetuado! Paciente Vinculado.
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={pendingLead.cobrancaUrl}
                        className="bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-[11px] font-mono text-indigo-200 w-56 truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink ? 'Copiado!' : 'Copiar Link'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: MEUS PACIENTES & STATUS (SIGILO ESTREITO) */}
      {activeTab === 'PACIENTES' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-ink">Carteira Exclusiva do Psicólogo</h3>
                <p className="text-xs text-muted">Sigilo estrito LGPD e CFP — apenas os seus pacientes vinculados aparecem abaixo.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoPaciente(true)}
                className="bg-psi-vibrant text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md hover:bg-psi-vibrant/90 transition-all flex items-center gap-1.5 self-start"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + Cadastrar Paciente
              </button>
            </div>

            {/* Cards de Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-800">Ativos em Acompanhamento</span>
                <div className="text-2xl font-black text-emerald-950">12 Pacientes</div>
                <p className="text-[11px] text-emerald-700">Frequência semanal mantida</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-amber-800">Em Férias / Pausa</span>
                <div className="text-2xl font-black text-amber-950">2 Pacientes</div>
                <p className="text-[11px] text-amber-700">Retorno previsto para próxima semana</p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-800">Desistentes (Motivo Notificado)</span>
                <div className="text-2xl font-black text-rose-950">1 Paciente</div>
                <p className="text-[11px] text-rose-700">Motivo: Mudança de Cidade</p>
              </div>
            </div>

            {/* Tabela Interativa de Pacientes */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
                  <tr>
                    <th className="px-4 py-3">Paciente</th>
                    <th className="px-4 py-3">Modalidade / Valor</th>
                    <th className="px-4 py-3">Status Atual</th>
                    <th className="px-4 py-3">Último Atendimento</th>
                    <th className="px-4 py-3 text-right">Ação de Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-ink">João Pedro Severo</td>
                    <td className="px-4 py-3 text-muted">Social (R$ 75,00)</td>
                    <td className="px-4 py-3">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-200">
                        ATIVO
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">05/08/2026</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => alert('Deseja marcar João Pedro Severo como Desistente? Um modal de motivo será exibido.')}
                        className="text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:underline"
                      >
                        Alterar Status
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-ink">Camila Fernandes</td>
                    <td className="px-4 py-3 text-muted">Particular (R$ 130,00)</td>
                    <td className="px-4 py-3">
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-amber-200">
                        EM FÉRIAS
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">28/07/2026</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => alert('Deseja reativar o acompanhamento de Camila Fernandes?')}
                        className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 hover:underline"
                      >
                        Marcar Ativo
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: MINHA AGENDA (50 MIN FIXOS) */}
      {activeTab === 'AGENDA' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-3xl p-6 border border-line shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-ink">Agenda & Sessões (50 Minutos Fixos)</h3>
                <p className="text-xs text-muted">A duração de 50 minutos e valores das sessões são travados para proteção do profissional.</p>
              </div>
              <button
                type="button"
                onClick={() => window.location.href = '/agenda'}
                className="bg-psi-vibrant text-white text-xs font-extrabold px-4 py-2.5 rounded-2xl shadow hover:bg-psi-vibrant/90 transition-all flex items-center gap-1.5 self-start"
              >
                <Calendar className="w-4 h-4" />
                Abrir Central de Agendamentos →
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-line flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">
                  14h
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-ink">Próxima Consulta Hoje: João Pedro Severo</h4>
                  <p className="text-[11px] text-muted">Modalidade Social (R$ 75,00) • Duração 50 min • Regra Cobrança 24h Pré-Sessão</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('Sessão iniciada! Redirecionando para o gravador SOAP...')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition-all"
                >
                  Iniciar Consulta ao Vivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 4: DESCONTO NA MENSALIDADE (70% SPLIT) */}
      {activeTab === 'DESCONTO' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 border border-indigo-800 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold px-3 py-1 rounded-full">
                  Regra da Clínica Escola Viver Mais Psicologia
                </span>
                <h3 className="text-xl font-black mt-2 text-white">Extrato de Crédito & Abatimento na Mensalidade (70% / 30%)</h3>
                <p className="text-xs text-indigo-200">
                  Cada atendimento realizado gera 70% do valor em crédito para abater diretamente na sua próxima mensalidade/boleto.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white/10 p-5 rounded-2xl border border-white/10 space-y-2">
                <span className="text-[10px] font-bold text-indigo-300 uppercase">Mensalidade Bruta do Aluno</span>
                <div className="text-2xl font-black text-white">R$ 890,00</div>
                <span className="text-[10px] text-indigo-300 block">Vencimento: 10/08/2026</span>
              </div>

              <div className="bg-emerald-500/20 p-5 rounded-2xl border border-emerald-400/30 space-y-2">
                <span className="text-[10px] font-bold text-emerald-300 uppercase">Crédito Acumulado (70% das Sessões)</span>
                <div className="text-2xl font-black text-emerald-300">- R$ 441,00</div>
                <span className="text-[10px] text-emerald-200 block">Base de 6 atendimentos efetuados</span>
              </div>

              <div className="bg-psi-vibrant/40 p-5 rounded-2xl border border-psi-vibrant/50 space-y-2">
                <span className="text-[10px] font-bold text-psi-light uppercase">Valor Líquido a Pagar no Boleto</span>
                <div className="text-2xl font-black text-white">R$ 449,00</div>
                <span className="text-[10px] text-psi-light block font-semibold">Economia de R$ 441,00 garantida</span>
              </div>
            </div>

            {/* Demonstrativo de Split das Sessões */}
            <div className="bg-black/30 rounded-2xl p-4 border border-white/10 space-y-3">
              <h4 className="font-extrabold text-xs text-indigo-200 uppercase tracking-wider">Demonstrativo de Split por Atendimento (70% Aluno / 30% Clínica)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <span className="font-bold text-white">Sessão João Pedro Severo</span>
                    <p className="text-[10px] text-indigo-300">Social (R$ 75,00) • 05/08/2026</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">+ R$ 52,50 (70% Crédito)</span>
                    <p className="text-[10px] text-indigo-300">R$ 22,50 (30% Viver Mais)</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <span className="font-bold text-white">Sessão Camila Fernandes</span>
                    <p className="text-[10px] text-indigo-300">Particular (R$ 130,00) • 04/08/2026</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">+ R$ 91,00 (70% Crédito)</span>
                    <p className="text-[10px] text-indigo-300">R$ 39,00 (30% Viver Mais)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.location.href = '/meu-financeiro'}
                className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition-all shadow-lg shadow-psi-vibrant/30"
              >
                Ver Extrato Financeiro Completo →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 5: COCKPIT SOAP & IA */}
      {activeTab === 'SOAP' && (
        <>
          <CockpitHeroCard />

          {isLoading ? (
            <div className="card py-12 text-center text-xs text-muted">Carregando fila de revisão...</div>
          ) : sessions.length === 0 ? (
            <div className="card py-12 text-center text-xs text-muted">
              Nenhuma sessão encerrada aguardando revisão.
            </div>
          ) : (
            <>
              <AudioRecorder
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                onSelectSession={handleSelectSession}
                onGenerateSoap={handleGenerateSoap}
                isProcessing={isProcessing}
              />

              <PreSessionBriefingCard
                briefing={selectedSession ? DEMO_PRE_SESSION_BRIEFINGS[selectedSession.patientId] ?? null : null}
              />

              <SoapEditor
                key={selectedSessionId}
                soapView={soapView}
                patientName={selectedSession?.patientName ?? ''}
                onOpenOneClickModal={handleOpenOneClickModal}
              />
            </>
          )}
        </>
      )}

      {modalSoap ? (
        <OneClickApprovalModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          soapView={modalSoap}
          summary={modalSummary}
          tasks={modalTasks}
          patientName={selectedSession?.patientName ?? ''}
          shareWithPatient={shareWithPatient}
          sendWhatsApp={sendWhatsApp}
          onSuccessFinish={handleSuccessFinish}
        />
      ) : null}
    </div>
  );
}

function OutcomeBanner({ result, onDismiss }: { result: PostSessionResult; onDismiss: () => void }) {
  const partial = !result.completed;
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl p-4 text-white shadow-xl ${
        partial ? 'bg-amber-500' : 'bg-emerald-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {partial ? <AlertTriangle className="h-6 w-6 shrink-0" /> : <CheckCircle2 className="h-6 w-6 shrink-0" />}
        <div>
          <p className="text-sm font-extrabold">
            {partial ? 'Automação concluída parcialmente' : 'Automação Pós-Sessão Concluída ⚡'}
          </p>
          <p className="text-xs opacity-90">
            {partial
              ? `Prontuário aprovado e preservado. Etapa pendente: ${result.failedStep?.step ?? 'desconhecida'} — ${result.failedStep?.message ?? ''}`
              : `Revisão ${result.approvedRevisionNumber} aprovada, ${result.timelineEntries} entradas na linha do tempo e ${result.handoffTasks} tarefa(s) entregue(s).`}
          </p>
        </div>
      </div>
      <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-bold underline">
        Fechar
      </button>
    </div>
  );
}
