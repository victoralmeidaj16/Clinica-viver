'use client';

import { useState, type ReactNode } from 'react';
import {
  approvePatientHandoff,
  markPatientHandoffDelivered,
  type PatientHandoff,
} from '@thats-life/core';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageSquare,
  Smartphone,
  X,
  Zap,
} from 'lucide-react';
import type { GeneratedSoapResult } from '@/lib/soapAiEngine';

interface OneClickApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  soapData: GeneratedSoapResult;
  patientHandoff: PatientHandoff;
  patientName: string;
  professionalName: string;
  shareWithPatient: boolean;
  sendWhatsApp: boolean;
  onSuccessFinish: (deliveredHandoff: PatientHandoff | null) => void;
}

export default function OneClickApprovalModal({
  isOpen,
  onClose,
  soapData,
  patientHandoff,
  patientName,
  professionalName,
  shareWithPatient,
  sendWhatsApp,
  onSuccessFinish,
}: OneClickApprovalModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [deliveredHandoff, setDeliveredHandoff] = useState<PatientHandoff | null>(null);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const completeStep = (step: number) => {
    setCompletedSteps((current) =>
      current.includes(step) ? current : [...current, step]
    );
  };

  const handleRunAutopilot = async () => {
    setIsExecuting(true);

    await new Promise((resolve) => setTimeout(resolve, 600));
    completeStep(1);

    if (shareWithPatient) {
      const approved = approvePatientHandoff(
        patientHandoff,
        professionalName,
        new Date().toISOString()
      );
      await new Promise((resolve) => setTimeout(resolve, 700));
      const delivered = markPatientHandoffDelivered(
        approved,
        new Date().toISOString()
      );
      setDeliveredHandoff(delivered);
      completeStep(2);
    }

    if (sendWhatsApp) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      completeStep(3);
    }

    setIsExecuting(false);
    setIsDone(true);
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
            completed={completedSteps.includes(1)}
            icon={<Lock className="h-5 w-5 text-primary" />}
            title="1. Salvar prontuário SOAP criptografado"
            description="Registro clínico privado, separado do conteúdo do paciente"
          />

          {shareWithPatient ? (
            <ActionStep
              completed={completedSteps.includes(2)}
              icon={<Smartphone className="h-5 w-5 text-capri" />}
              title={`2. Disponibilizar resumo + ${patientHandoff.tasks.length} tarefa(s)`}
              description="Somente o conteúdo revisado será exibido no app"
            />
          ) : null}

          {sendWhatsApp ? (
            <ActionStep
              completed={completedSteps.includes(3)}
              icon={<MessageSquare className="h-5 w-5 text-emerald-600" />}
              title="3. Enviar recibo Pix no WhatsApp"
              description={`Simulação via Evolution API — R$ ${soapData.valorSessao},00`}
            />
          ) : null}
        </div>

        {!isDone ? (
          <button
            type="button"
            onClick={handleRunAutopilot}
            disabled={isExecuting}
            className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-sm shadow-md disabled:opacity-60"
          >
            <Zap className="h-4 w-4 fill-white" />
            <span>{isExecuting ? 'Executando simulação...' : 'Confirmar e executar tudo'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onSuccessFinish(deliveredHandoff);
              onClose();
            }}
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
  completed: boolean;
  icon: ReactNode;
  title: string;
  description: string;
}

function ActionStep({ completed, icon, title, description }: ActionStepProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-3.5 ${
        completed
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-line bg-canvas text-ink'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs font-bold">{title}</p>
          <p className="text-[11px] text-muted">{description}</p>
        </div>
      </div>
      {completed ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-slate-300" />
      )}
    </div>
  );
}
