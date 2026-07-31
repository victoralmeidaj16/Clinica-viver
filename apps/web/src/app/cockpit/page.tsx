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
import { AlertTriangle, CheckCircle2, Sparkles, Zap } from 'lucide-react';

export default function CockpitPage() {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soapView, setSoapView] = useState<SoapView | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSoap, setModalSoap] = useState<SoapView | null>(null);
  const [modalSummary, setModalSummary] = useState('');
  const [modalTasks, setModalTasks] = useState<string[]>([]);
  const [shareWithPatient, setShareWithPatient] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [outcome, setOutcome] = useState<PostSessionResult | null>(null);

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

  // O rascunho já existe no servidor: o gravador apenas revela a evolução
  // pendente de revisão. A transcrição e a geração por IA continuam simuladas.
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {outcome ? <OutcomeBanner result={outcome} onDismiss={() => setOutcome(null)} /> : null}

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <span className="chip-accent text-[11px] mb-1">Workflow do Psicólogo</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <Zap className="w-6 h-6 text-accent fill-accent" />
            Cockpit de Atendimento 1-Clique
          </h1>
          <p className="text-xs text-muted">
            Revise a evolução SOAP pendente e execute a automação pós-sessão no servidor com um único clique.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-surface px-4 py-2 rounded-2xl border border-line shadow-card text-xs font-semibold text-ink">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span>Demonstração de IA: dados simulados</span>
        </div>
      </div>

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
