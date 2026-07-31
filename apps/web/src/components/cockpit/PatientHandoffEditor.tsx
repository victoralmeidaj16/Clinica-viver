'use client';

import {
  CheckCircle2,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface PatientHandoffEditorProps {
  summary: string;
  selectedTaskTitles: readonly string[];
  safetyWarnings: readonly string[];
  availableTasks: readonly string[];
  selectedTasks: readonly string[];
  shareWithPatient: boolean;
  reviewConfirmed: boolean;
  onSummaryChange: (summary: string) => void;
  onToggleTask: (task: string) => void;
  onShareChange: (share: boolean) => void;
  onReviewChange: (confirmed: boolean) => void;
}

export default function PatientHandoffEditor({
  summary,
  selectedTaskTitles,
  safetyWarnings,
  availableTasks,
  selectedTasks,
  shareWithPatient,
  reviewConfirmed,
  onSummaryChange,
  onToggleTask,
  onShareChange,
  onReviewChange,
}: PatientHandoffEditorProps) {
  const isSafe = safetyWarnings.length === 0;

  return (
    <section className="rounded-2xl border border-capri/30 bg-capri-soft/20 p-5 space-y-4">
      <div className="flex flex-col gap-3 border-b border-capri/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-capri" />
          <div>
            <h3 className="text-sm font-extrabold text-ink">
              3. Conteúdo que será disponibilizado ao paciente
            </h3>
            <p className="text-[11px] text-muted">
              A transcrição e o SOAP não fazem parte desta entrega.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink">
          <input
            type="checkbox"
            checked={shareWithPatient}
            onChange={(event) => onShareChange(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Disponibilizar no app
        </label>
      </div>

      {shareWithPatient ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="patient-summary" className="text-xs font-bold text-primary">
                Resumo em linguagem para o paciente
              </label>
              <textarea
                id="patient-summary"
                value={summary}
                onChange={(event) => onSummaryChange(event.target.value)}
                rows={5}
                maxLength={600}
                className="input text-xs leading-relaxed"
              />
              <p className="text-right text-[10px] text-muted">
                {summary.length}/600 caracteres
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold text-primary">
                Tarefas autorizadas para o app
              </legend>
              {availableTasks.length > 0 ? (
                availableTasks.map((task) => (
                  <label
                    key={task}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-line bg-white p-3 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task)}
                      onChange={() => onToggleTask(task)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="font-medium text-ink">{task}</span>
                  </label>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
                  Nenhuma tarefa será disponibilizada.
                </p>
              )}
            </fieldset>

            <div
              className={`rounded-xl border p-3 text-xs ${
                isSafe
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {isSafe ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                {isSafe ? 'Triagem automática sem alertas' : 'Revise antes de continuar'}
              </div>
              {!isSafe ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {safetyWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
                isSafe ? 'cursor-pointer border-primary/20 bg-white' : 'border-line bg-soft'
              }`}
            >
              <input
                type="checkbox"
                checked={reviewConfirmed}
                disabled={!isSafe}
                onChange={(event) => onReviewChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="font-semibold text-ink">
                Revisei o texto e autorizo que este conteúdo específico seja disponibilizado ao paciente.
              </span>
            </label>
          </div>

          <div className="rounded-[1.8rem] border-[6px] border-ink bg-canvas p-4 shadow-xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-muted">
              <Eye className="h-4 w-4 text-primary" />
              Prévia no app do paciente
            </div>
            <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
              <span className="chip-capri text-[9px]">Plano pós-sessão</span>
              <p className="text-sm font-extrabold text-ink">Seu plano para esta semana</p>
              <p className="text-xs leading-relaxed text-muted">{summary}</p>
              <div className="space-y-2 border-t border-line pt-3">
                {selectedTaskTitles.length > 0 ? (
                  selectedTaskTitles.map((task) => (
                    <div key={task} className="flex items-start gap-2 text-[11px] text-ink">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{task}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-muted">Sem tarefas nesta entrega.</p>
                )}
              </div>
              <p className="text-[9px] text-muted">
                A entrega definitiva é montada e validada no servidor ao aprovar.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-white p-4 text-xs text-muted">
          O prontuário poderá ser aprovado sem enviar resumo ou tarefas ao paciente.
        </div>
      )}
    </section>
  );
}
