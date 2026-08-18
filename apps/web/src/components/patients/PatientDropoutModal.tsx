'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, UserX, X } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';

interface PatientDropoutModalProps {
  patient: PatientDirectoryEntry | null;
  onClose: () => void;
  onRegistered: () => void | Promise<void>;
}

const REASONS = [
  ['FINANCEIRO', 'Financeiro / valor da sessão'],
  ['INSATISFACAO_CONDUTA', 'Insatisfação com a conduta clínica'],
  ['TROCA_ABORDAGEM', 'Busca por outra abordagem'],
  ['MOTIVOS_PESSOAIS', 'Motivos pessoais / mudança de rotina'],
  ['OUTRO', 'Outro motivo'],
] as const;

export default function PatientDropoutModal({ patient, onClose, onRegistered }: PatientDropoutModalProps) {
  const [motivo, setMotivo] = useState<(typeof REASONS)[number][0]>('FINANCEIRO');
  const [descricaoDetalhada, setDescricaoDetalhada] = useState('');
  const [acaoSugestao, setAcaoSugestao] = useState('');
  const [permitirTrocaPsicologo, setPermitirTrocaPsicologo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!patient) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, patient, saving]);

  if (!patient) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await applicationRequest('/patients/desistencias', {
        method: 'POST',
        headers: commandHeaders(),
        body: JSON.stringify({ patientId: patient.id, motivo, descricaoDetalhada, acaoSugestao, permitirTrocaPsicologo }),
      });
      setSuccess(true);
      await onRegistered();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a desistência.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="dropout-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-rose-100 bg-white shadow-2xl">
        <div className="border-b border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-200">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">Registro clínico-operacional</p>
                <h2 id="dropout-title" className="mt-1 text-lg font-black text-slate-950">Registrar desistência</h2>
                <p className="mt-1 text-xs text-slate-600">Paciente: <strong>{patient.displayName}</strong></p>
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar" className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {success ? (
          <div className="space-y-5 p-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></div>
            <div>
              <h3 className="font-black text-slate-900">Desistência registrada</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">O acompanhamento foi encerrado e o caso entrou na fila de auditoria e reengajamento da clínica.</p>
            </div>
            <button type="button" onClick={onClose} className="btn-accent w-full justify-center py-3 text-xs">Concluir</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              O paciente será marcado como desistente e deixará de contar como acompanhamento ativo.
            </div>
            {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}

            <label className="block text-xs font-bold text-slate-700">
              Motivo principal <span className="text-rose-600">*</span>
              <select required value={motivo} onChange={(event) => setMotivo(event.target.value as typeof motivo)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100">
                {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Detalhes da saída
              <textarea rows={3} maxLength={2000} value={descricaoDetalhada} onChange={(event) => setDescricaoDetalhada(event.target.value)} placeholder="Registre apenas informações necessárias para a auditoria, sem conteúdo do prontuário." className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100" />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Ação sugerida de reengajamento
              <input maxLength={500} value={acaoSugestao} onChange={(event) => setAcaoSugestao(event.target.value)} placeholder="Ex.: oferecer modalidade social ou novo horário" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100" />
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 transition hover:bg-slate-50">
              <input type="checkbox" checked={permitirTrocaPsicologo} onChange={(event) => setPermitirTrocaPsicologo(event.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
              <span className="text-xs leading-relaxed text-slate-700">
                <strong className="block text-slate-900">Autorizar oferta de outro psicólogo</strong>
                A gestão poderá considerar uma troca de profissional durante o reengajamento.
              </span>
            </label>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Registro restrito à gestão e protegido pelas regras de acesso da clínica.
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 text-xs font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                {saving ? 'Registrando…' : 'Confirmar desistência'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
