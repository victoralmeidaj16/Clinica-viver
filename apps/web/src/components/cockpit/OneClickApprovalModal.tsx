'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageSquare,
  Smartphone,
  X,
  Zap,
} from 'lucide-react';
import { formatCents, type SoapView } from '@/lib/soapAiEngine';
import { runPostSession, type PostSessionResult } from '@/lib/postSessionApi';

interface OneClickApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  soapView: SoapView;
  summary: string;
  tasks: string[];
  patientName: string;
  shareWithPatient: boolean;
  sendWhatsApp: boolean;
  onSuccessFinish: (result: PostSessionResult) => void;
}

type StepState = 'pending' | 'done' | 'failed';

export default function OneClickApprovalModal({
  isOpen,
  onClose,
  soapView,
  summary,
  tasks,
  patientName,
  shareWithPatient,
  sendWhatsApp,
  onSuccessFinish,
}: OneClickApprovalModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<PostSessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  /**
   * Um único comando no servidor executa a cadeia inteira. O cliente não
   * encadeia regras de domínio: ele envia o conteúdo revisado e reflete o
   * resultado, inclusive quando o fluxo termina parcialmente.
   */
  const handleRunAutopilot = async () => {
    setIsExecuting(true);
    setError(null);
    try {
      const response = await runPostSession(soapView.sessionId, {
        content: {
          subjective: soapView.subjetivo,
          objective: soapView.objetivo,
          assessment: soapView.avaliacao,
          plan: soapView.plano,
          extractedTasks: soapView.tarefasPacientes,
        },
        handoff: { summary, tasks },
        shareWithPatient,
        charge: {
          amountCents: soapView.valorSessaoCentavos,
          dueAt: soapView.vencimentoCobranca,
        },
        notifyPatient: sendWhatsApp,
        occurredAt: new Date().toISOString(),
      });
      setResult(response);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Não foi possível concluir o fluxo.');
    } finally {
      setIsExecuting(false);
    }
  };

  const stepState = (done: boolean, step: string): StepState => {
    if (!result) return 'pending';
    if (result.failedStep?.step === step) return 'failed';
    return done ? 'done' : 'pending';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div className="relative w-full max-w-lg space-y-6 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-muted transition-colors hover:text-ink"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <header className="flex items-center gap-3 border-b border-line pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <Zap className="h-6 w-6 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <h3 id="approval-modal-title" className="text-lg font-extrabold text-ink">
              Automação Pós-Sessão em 1 Clique
            </h3>
            <p className="text-xs text-muted">Paciente: <strong>{patientName}</strong></p>
          </div>
        </header>

        <div className="space-y-3">
          <ActionStep
            state={result ? 'done' : 'pending'}
            icon={<Lock className="h-5 w-5 text-primary" />}
            title="1. Aprovar prontuário SOAP e projetar na linha do tempo"
            description={
              result
                ? `Revisão ${result.approvedRevisionNumber} • ${result.timelineEntries} entradas • hash ${result.contentHashSha256.slice(0, 12)}…`
                : 'Registro clínico privado, separado do conteúdo do paciente'
            }
          />

          {shareWithPatient ? (
            <ActionStep
              state={stepState(Boolean(result?.handoffTasks !== undefined && !result?.failedStep), 'patient_handoff')}
              icon={<Smartphone className="h-5 w-5 text-capri" />}
              title={`2. Disponibilizar resumo + ${tasks.length} tarefa(s)`}
              description="Somente o conteúdo revisado será exibido no app"
            />
          ) : null}

          <ActionStep
            state={stepState(Boolean(result?.chargeId), 'billing')}
            icon={<MessageSquare className="h-5 w-5 text-emerald-600" />}
            title="3. Emitir cobrança e recibo da sessão"
            description={`${formatCents(soapView.valorSessaoCentavos)} • vencimento em ${new Date(soapView.vencimentoCobranca).toLocaleDateString('pt-BR')}`}
          />

          {sendWhatsApp ? (
            <ActionStep
              state={stepState(Boolean(result?.notificationId), 'notification')}
              icon={<MessageSquare className="h-5 w-5 text-emerald-600" />}
              title="4. Enfileirar aviso de cobrança no WhatsApp"
              description="Simulação via Evolution API — nenhuma mensagem real é enviada"
            />
          ) : null}
        </div>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {result?.failedStep ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            O prontuário foi aprovado e permanece válido. A etapa
            {` ${result.failedStep.step} `}
            falhou: {result.failedStep.message}
          </p>
        ) : null}

        {!result ? (
          <button
            type="button"
            onClick={handleRunAutopilot}
            disabled={isExecuting}
            className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-sm shadow-md disabled:opacity-60"
          >
            <Zap className="h-4 w-4 fill-white" />
            <span>{isExecuting ? 'Executando no servidor...' : 'Confirmar e executar tudo'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { onSuccessFinish(result); onClose(); }}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-sm shadow-md"
          >
            <span>Concluir</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface ActionStepProps {
  state: StepState;
  icon: ReactNode;
  title: string;
  description: string;
}

const STEP_STYLES: Record<StepState, string> = {
  pending: 'border-line bg-canvas text-ink',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  failed: 'border-rose-200 bg-rose-50 text-rose-900',
};

function ActionStep({ state, icon, title, description }: ActionStepProps) {
  return (
    <div className={`flex items-center justify-between rounded-xl border p-3.5 ${STEP_STYLES[state]}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs font-bold">{title}</p>
          <p className="text-[11px] text-muted">{description}</p>
        </div>
      </div>
      {state === 'done' ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      ) : state === 'failed' ? (
        <AlertTriangle className="h-5 w-5 text-rose-600" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-slate-300" />
      )}
    </div>
  );
}
