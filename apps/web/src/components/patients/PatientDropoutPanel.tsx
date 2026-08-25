'use client';

import { useState } from 'react';
import { CheckCircle2, UserX } from 'lucide-react';
import { MOTIVOS_DESISTENCIA, rotuloMotivo, type MotivoDesistencia } from '@/lib/desistencias';
import type { ManagedPatient } from './managementTypes';
import PatientReallocationPanel from './PatientReallocationPanel';

/**
 * Auditoria de desistência e reengajamento, dentro do cadastro do paciente.
 *
 * Substitui a página `/retencao`, onde a saída era registrada digitando o nome
 * do paciente e o do psicólogo em campos livres — texto que não se ligava a
 * cadastro nenhum e que, escrito com uma letra a mais, criava um registro
 * órfão. Aqui a identidade vem da linha em que a gestão clicou, e o servidor a
 * resolve pelo id; o formulário não tem mais campo de nome.
 */

interface Props {
  patient: ManagedPatient;
  onChange: () => void | Promise<void>;
}

export default function PatientDropoutPanel({ patient, onChange }: Props) {
  const [motivo, setMotivo] = useState<MotivoDesistencia>('FINANCEIRO');
  const [descricaoDetalhada, setDescricao] = useState('');
  const [acaoSugestao, setAcao] = useState('');
  const [permitirTrocaPsicologo, setPermitirTroca] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dropout = patient.desistencia;

  const enviar = async (corpo: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/application/desistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Não foi possível concluir a operação.');
      }
      await onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-rose-200/70 bg-rose-50/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <UserX className="h-4 w-4 text-rose-600" />
        <h3 className="text-sm font-black text-ink">Desistência & nova alocação</h3>
      </div>

      {error && <p className="mb-3 rounded-xl border border-rose-200 bg-white p-3 text-xs font-semibold text-rose-700">{error}</p>}

      {dropout ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Motivo" valor={rotuloMotivo(dropout.motivo)} />
            <Campo label="Saída registrada em" valor={new Date(dropout.dataDesistencia).toLocaleDateString('pt-BR')} />
          </div>
          <Campo label="Detalhes da saída" valor={dropout.descricaoDetalhada} />
          <Campo label="Ação sugerida" valor={dropout.acaoSugestao} />
          {dropout.permitirTrocaPsicologo && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] font-semibold text-amber-800">
              O paciente autorizou a alocação com outro profissional compatível.
            </p>
          )}

          {dropout.reengajado ? (
            <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Realocado
                {dropout.observacoesReengajamento && (
                  <span className="mt-0.5 block font-medium text-emerald-700">{dropout.observacoesReengajamento}</span>
                )}
              </span>
            </p>
          ) : (
            <PatientReallocationPanel
              key={dropout.id}
              patient={patient}
              saving={saving}
              onAllocate={(psicologoId) => void enviar({ action: 'ALOCAR_PACIENTE', id: dropout.id, psicologoId })}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs font-bold text-ink">
            Motivo principal
            <select
              value={motivo}
              onChange={(event) => setMotivo(event.target.value as MotivoDesistencia)}
              className="mt-1.5 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs font-medium text-ink focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            >
              {MOTIVOS_DESISTENCIA.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </label>

          <label className="block text-xs font-bold text-ink">
            Detalhes da saída
            <textarea
              rows={3}
              maxLength={2000}
              value={descricaoDetalhada}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Registre apenas o necessário para a auditoria, sem conteúdo do prontuário."
              className="mt-1.5 w-full resize-none rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs font-medium text-ink focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>

          <label className="block text-xs font-bold text-ink">
            Ação sugerida de reengajamento
            <input
              maxLength={500}
              value={acaoSugestao}
              onChange={(event) => setAcao(event.target.value)}
              placeholder="Ex.: ofertar modalidade social ou novo horário"
              className="mt-1.5 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs font-medium text-ink focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-psi-soft bg-white p-3">
            <input
              type="checkbox"
              checked={permitirTrocaPsicologo}
              onChange={(event) => setPermitirTroca(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-rose-600"
            />
            <span className="text-xs leading-relaxed text-muted">
              <strong className="block text-ink">Autorizar oferta de outro psicólogo</strong>
              A gestão poderá escolher outro profissional compatível na nova alocação.
            </span>
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void enviar({
                patientId: patient.patientId,
                leadId: patient.leadId,
                motivo,
                descricaoDetalhada,
                acaoSugestao,
                permitirTrocaPsicologo,
              })
            }
            className="w-full rounded-xl bg-rose-600 py-3 text-xs font-black text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Registrando…' : 'Registrar desistência'}
          </button>

          <p className="text-[11px] leading-relaxed text-muted">
            O paciente deixa de contar como acompanhamento ativo e a vaga do profissional é liberada no rodízio.
          </p>
        </div>
      )}
    </section>
  );
}

function Campo({ label, valor }: { label: string; valor?: string }) {
  return (
    <div className="rounded-xl border border-psi-soft/60 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xs font-bold text-ink">{valor || 'Não informado'}</p>
    </div>
  );
}
