'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Globe,
  MapPin,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
  Loader2,
  X,
  Pencil,
} from 'lucide-react';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';
import { applicationRequest } from '@/lib/applicationApi';

export interface SessionEditableData {
  id: string;
  pacienteNome: string;
  inicio: string;
  fim?: string;
  modalidade?: 'online' | 'presencial' | 'telefone';
  status?: string;
}

interface Props {
  session?: SessionEditableData;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function EditSessionModal({ session, isOpen, onClose, onSaved }: Props) {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [duracaoMin, setDuracaoMin] = useState(50);
  const [modalidade, setModalidade] = useState<'online' | 'presencial'>('online');
  const [status, setStatus] = useState<'agendado' | 'realizado'>('agendado');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (session && isOpen) {
      const dateObj = new Date(session.inicio);
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

      if (session.fim) {
        const dur = Math.round(
          (new Date(session.fim).getTime() - new Date(session.inicio).getTime()) / 60_000
        );
        setDuracaoMin(dur > 0 ? dur : 50);
      } else {
        setDuracaoMin(50);
      }

      setModalidade(session.modalidade === 'presencial' ? 'presencial' : 'online');
      setStatus(
        session.status === 'realizado' || session.status === 'completed'
          ? 'realizado'
          : 'agendado'
      );
      setError(undefined);
    }
  }, [session, isOpen]);

  if (!isOpen || !session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !hora) {
      setError('Selecione a data e o horário.');
      return;
    }

    const startsAtIso = clinicDateTimeToIso(data, hora);
    const startsAtDate = new Date(startsAtIso);
    if (isNaN(startsAtDate.getTime())) {
      setError('Data ou horário inválido.');
      return;
    }

    const endsAtDate = new Date(startsAtDate.getTime() + duracaoMin * 60_000);
    const endsAtIso = endsAtDate.toISOString();

    setLoading(true);
    setError(undefined);
    try {
      await applicationRequest(
        `/agenda/agendamentos/${encodeURIComponent(session.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'edit',
            startsAt: startsAtIso,
            endsAt: endsAtIso,
            modalidade,
            status,
          }),
        }
      );
      await onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar as alterações da sessão.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-ink">Editar Atendimento</h2>
              <p className="text-xs text-muted">Ajuste horário, modalidade ou status do atendimento</p>
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

        {/* Card do Paciente */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
              Paciente
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                session.status === 'realizado'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
              }`}
            >
              {session.status === 'realizado' ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Realizado
                </>
              ) : (
                <>
                  <CalendarDays className="w-3 h-3" /> Agendado
                </>
              )}
            </span>
          </div>
          <p className="text-sm font-extrabold text-ink">{session.pacienteNome}</p>
          <p className="text-xs text-slate-600 capitalize">
            {FORMATTER.format(new Date(session.inicio))}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Data *</label>
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
              <label className="text-xs font-bold text-ink block mb-1">Horário *</label>
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

          {/* Duração & Modalidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Duração</label>
              <select
                value={duracaoMin}
                onChange={(e) => setDuracaoMin(Number(e.target.value))}
                className="input text-xs font-bold w-full bg-white"
              >
                <option value={30}>30 minutos</option>
                <option value={50}>50 minutos (Padrão)</option>
                <option value={60}>60 minutos (1 hora)</option>
                <option value={90}>90 minutos (1h 30m)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">Modalidade</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalidade('online')}
                  className={`py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition ${
                    modalidade === 'online'
                      ? 'bg-white text-psi-deep shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" /> Online
                </button>
                <button
                  type="button"
                  onClick={() => setModalidade('presencial')}
                  className={`py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition ${
                    modalidade === 'presencial'
                      ? 'bg-white text-psi-deep shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" /> Presencial
                </button>
              </div>
            </div>
          </div>

          {/* Status do Atendimento */}
          <div>
            <label className="text-xs font-bold text-ink block mb-1">Status do Atendimento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('agendado')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  status === 'agendado'
                    ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm ring-2 ring-sky-400/20'
                    : 'border-line bg-white text-muted hover:bg-slate-50'
                }`}
              >
                <CalendarDays className="w-4 h-4 text-sky-600" /> Agendado
              </button>
              <button
                type="button"
                onClick={() => setStatus('realizado')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  status === 'realizado'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-400/20'
                    : 'border-line bg-white text-muted hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Realizado
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-muted hover:text-ink hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-accent px-5 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
