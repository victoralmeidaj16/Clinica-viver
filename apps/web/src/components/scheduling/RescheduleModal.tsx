'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertCircle, Loader2, X, RefreshCw } from 'lucide-react';
import type { AgendamentoResumo } from './UpcomingSessions';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';

interface Props {
  appointment?: AgendamentoResumo;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (appointmentId: string, startsAt: string, endsAt: string) => Promise<void>;
}

const FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function RescheduleModal({ appointment, isOpen, onClose, onConfirm }: Props) {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [duracaoMin, setDuracaoMin] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (appointment && isOpen) {
      const dateObj = new Date(appointment.inicio);
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(dateObj)
          .map((p) => [p.type, p.value])
      );
      setData(`${parts.year}-${parts.month}-${parts.day}`);
      setHora(`${parts.hour}:${parts.minute}`);
      const dur = Math.round((new Date(appointment.fim).getTime() - new Date(appointment.inicio).getTime()) / 60_000);
      setDuracaoMin(dur > 0 ? dur : 50);
      setError(undefined);
    }
  }, [appointment, isOpen]);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !hora) {
      setError('Selecione a data e o horário.');
      return;
    }

    const startsAtIso = clinicDateTimeToIso(data, hora);
    const startsAtDate = new Date(startsAtIso);
    if (startsAtDate.getTime() <= Date.now()) {
      setError('O novo horário deve estar no futuro.');
      return;
    }

    const endsAtDate = new Date(startsAtDate.getTime() + duracaoMin * 60_000);
    const endsAtIso = endsAtDate.toISOString();

    setLoading(true);
    setError(undefined);
    try {
      await onConfirm(appointment.id, startsAtIso, endsAtIso);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível reagendar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-ink">Reagendar Atendimento</h2>
              <p className="text-xs text-muted">Defina a nova data e horário para a sessão</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card do Horário Atual */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">
            Paciente &amp; Horário Atual
          </span>
          <p className="text-sm font-extrabold text-ink">{appointment.pacienteNome}</p>
          <p className="text-xs text-slate-600 capitalize">
            {FORMATTER.format(new Date(appointment.inicio))}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Nova Data *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted" />
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="input pl-9 text-xs font-bold w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">Novo Horário *</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 w-4 h-4 text-muted" />
                <input
                  type="time"
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="input pl-9 text-xs font-bold w-full"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">Duração da Sessão</label>
            <select
              value={duracaoMin}
              onChange={(e) => setDuracaoMin(Number(e.target.value))}
              className="input text-xs font-bold w-full bg-white"
            >
              <option value={50}>50 minutos (Padrão)</option>
              <option value={30}>30 minutos</option>
              <option value={60}>60 minutos (1 hora)</option>
              <option value={90}>90 minutos (1h30)</option>
            </select>
          </div>

          <p className="text-[11px] text-muted">
            Ao reagendar, a data de vencimento da cobrança (caso pendente) será ajustada automaticamente para o novo horário.
          </p>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="btn-outline flex-1 text-xs py-2.5 justify-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-accent flex-1 text-xs py-2.5 justify-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Confirmar Reagendamento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
