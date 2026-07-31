'use client';

import { useState } from 'react';
import {
  createPatientHandoffDraft,
  type PatientHandoff,
} from '@thats-life/core';
import { FileText, Send, Zap } from 'lucide-react';
import type { GeneratedSoapResult } from '@/lib/soapAiEngine';
import ExtractedTasksEditor from './ExtractedTasksEditor';
import PatientHandoffEditor from './PatientHandoffEditor';
import SoapFieldsGrid from './SoapFieldsGrid';

interface SoapEditorProps {
  soapData: GeneratedSoapResult | null;
  patientId: string;
  patientName: string;
  nextSessionLabel: string;
  professionalName: string;
  onOpenOneClickModal: (
    finalSoap: GeneratedSoapResult,
    patientHandoff: PatientHandoff,
    shareWithPatient: boolean,
    sendWhatsApp: boolean
  ) => void;
}

export default function SoapEditor({
  soapData,
  patientId,
  patientName,
  nextSessionLabel,
  professionalName,
  onOpenOneClickModal,
}: SoapEditorProps) {
  const [subjetivo, setSubjetivo] = useState(soapData?.subjetivo ?? '');
  const [objetivo, setObjetivo] = useState(soapData?.objetivo ?? '');
  const [avaliacao, setAvaliacao] = useState(soapData?.avaliacao ?? '');
  const [plano, setPlano] = useState(soapData?.plano ?? '');
  const [tasks, setTasks] = useState<string[]>(soapData?.tarefasPacientes ?? []);
  const [patientSummary, setPatientSummary] = useState(
    soapData?.resumoPacienteSugerido ?? ''
  );
  const [selectedPatientTasks, setSelectedPatientTasks] = useState<string[]>(
    soapData?.tarefasPacientes ?? []
  );
  const [shareWithPatient, setShareWithPatient] = useState(true);
  const [handoffReviewed, setHandoffReviewed] = useState(false);
  const [sendWhatsAppBilling, setSendWhatsAppBilling] = useState(true);

  if (!soapData) {
    return (
      <div className="card space-y-3 border-dashed bg-white/60 py-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted/50" />
        <h3 className="text-base font-bold text-ink">Aguardando geração do Prontuário SOAP</h3>
        <p className="mx-auto max-w-sm text-xs text-muted">
          Grave o atendimento ou importe um áudio para estruturar a evolução clínica.
        </p>
      </div>
    );
  }

  const patientHandoff = createPatientHandoffDraft({
    patientId,
    sessionId: soapData.sessionId,
    summary: patientSummary,
    tasks: tasks.filter((task) => selectedPatientTasks.includes(task)),
    nextSessionLabel,
    professionalName,
  });
  const patientDeliveryReady =
    !shareWithPatient ||
    (handoffReviewed && patientHandoff.safetyWarnings.length === 0);

  const handleAddTask = (task: string) => {
    setTasks((current) => (current.includes(task) ? current : [...current, task]));
    setSelectedPatientTasks((current) =>
      current.includes(task) ? current : [...current, task]
    );
    setHandoffReviewed(false);
  };

  const handleRemoveTask = (index: number) => {
    const removedTask = tasks[index];
    setTasks((current) =>
      current.filter((_, taskIndex) => taskIndex !== index)
    );
    setSelectedPatientTasks((selected) =>
      selected.filter((task) => task !== removedTask)
    );
    setHandoffReviewed(false);
  };

  const handleTriggerOneClick = () => {
    if (!patientDeliveryReady) return;
    onOpenOneClickModal(
      {
        ...soapData,
        subjetivo,
        objetivo,
        avaliacao,
        plano,
        tarefasPacientes: tasks,
      },
      patientHandoff,
      shareWithPatient,
      sendWhatsAppBilling
    );
  };

  return (
    <div className="card space-y-6">
      <header className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-ink">2. Prontuário SOAP Estruturado por IA</h2>
            <span className="chip-capri text-[11px]">CFP Normativa N.º 01/2009</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Revise a evolução sugerida para <strong>{patientName}</strong> antes de aprovar.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTriggerOneClick}
          disabled={!patientDeliveryReady}
          className="btn-primary px-5 py-2.5 text-sm shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          title={
            patientDeliveryReady
              ? 'Abrir confirmação'
              : 'Revise e autorize o conteúdo destinado ao paciente'
          }
        >
          <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
          <span>Aprovar em 1 Clique</span>
        </button>
      </header>

      <SoapFieldsGrid
        subjetivo={subjetivo}
        objetivo={objetivo}
        avaliacao={avaliacao}
        plano={plano}
        onSubjetivoChange={setSubjetivo}
        onObjetivoChange={setObjetivo}
        onAvaliacaoChange={setAvaliacao}
        onPlanoChange={setPlano}
      />

      <ExtractedTasksEditor
        tasks={tasks}
        onAdd={handleAddTask}
        onRemove={handleRemoveTask}
      />

      <PatientHandoffEditor
        draft={patientHandoff}
        availableTasks={tasks}
        selectedTasks={selectedPatientTasks}
        shareWithPatient={shareWithPatient}
        reviewConfirmed={handoffReviewed}
        onSummaryChange={(summary) => {
          setPatientSummary(summary);
          setHandoffReviewed(false);
        }}
        onToggleTask={(task) => {
          setSelectedPatientTasks((current) =>
            current.includes(task)
              ? current.filter((selected) => selected !== task)
              : [...current, task]
          );
          setHandoffReviewed(false);
        }}
        onShareChange={(share) => {
          setShareWithPatient(share);
          setHandoffReviewed(false);
        }}
        onReviewChange={setHandoffReviewed}
      />

      <section className="flex items-center justify-between rounded-xl border border-line bg-soft p-4">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-xs font-bold text-ink">Enviar recibo e cobrança Pix via WhatsApp</p>
            <p className="text-[11px] text-muted">Valor da sessão: R$ {soapData.valorSessao},00</p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <span className="sr-only">Enviar cobrança por WhatsApp</span>
          <input
            type="checkbox"
            checked={sendWhatsAppBilling}
            onChange={(event) => setSendWhatsAppBilling(event.target.checked)}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white" />
        </label>
      </section>
    </div>
  );
}
