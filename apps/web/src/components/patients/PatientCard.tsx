'use client';

import {
  Building2,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileText,
  PauseCircle,
  Pencil,
  Phone,
  Send,
  UserX,
} from 'lucide-react';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import { focoPaciente } from '@/lib/focoNotificacao';

interface PatientCardProps {
  patient: PatientDirectoryEntry;
  onSelectTimeline: (patientId: string) => void;
  onEdit: (patient: PatientDirectoryEntry) => void;
  onSchedule: (patient: PatientDirectoryEntry) => void;
  onSendAgenda: (patient: PatientDirectoryEntry) => void;
  onDropout?: (patient: PatientDirectoryEntry) => void;
  canRegisterDropout?: boolean;
}

const STATUS_LABEL: Record<PatientDirectoryEntry['status'], string> = {
  active: 'Ativo',
  paused: 'Em Pausa',
  discharged: 'Alta',
};

function formatNextAppointment(iso?: string): string {
  if (!iso) return 'A agendar';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PatientCard({
  patient,
  onSelectTimeline,
  onEdit,
  onSchedule,
  onSendAgenda,
  onDropout,
  canRegisterDropout = false,
}: PatientCardProps) {
  return (
    <div
      data-foco={focoPaciente(patient.id)}
      className="card card-hover flex flex-col justify-between space-y-4"
    >
      <div className="space-y-3.5">
        {/* CABEÇALHO DO PACIENTE */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-base font-black text-primary">
              {patient.displayName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3
                  onClick={() => onSelectTimeline(patient.id)}
                  className="truncate text-sm font-black text-ink transition-colors hover:text-psi-vibrant cursor-pointer"
                  title={patient.displayName}
                >
                  {patient.displayName}
                </h3>
                {/* BOTÃO MINIMALISTA DE EDIÇÃO AO LADO DO NOME */}
                <button
                  type="button"
                  onClick={() => onEdit(patient)}
                  title="Editar dados do paciente"
                  aria-label="Editar dados do paciente"
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-psi-vibrant/10 hover:text-psi-vibrant"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              {patient.phone && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{patient.phone}</span>
                </p>
              )}
            </div>
          </div>

          {/* BADGES DE STATUS E CONVÊNIO */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            {patient.conveniado && (
              <span
                className="chip flex items-center gap-1 border-purple-200 bg-purple-100 text-[11px] font-extrabold text-purple-800"
                title={patient.convenioNome ? `Convênio: ${patient.convenioNome}` : 'Paciente Conveniado'}
              >
                <Building2 className="h-3 w-3 shrink-0 text-purple-700" />
                <span>{patient.convenioNome ? `Convênio: ${patient.convenioNome}` : 'Conveniado'}</span>
              </span>
            )}
            <span
              className={`chip text-[11px] ${
                patient.status === 'active'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {patient.status === 'active' ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              ) : (
                <PauseCircle className="h-3 w-3 text-amber-600" />
              )}
              {patient.dropoutRegistered ? 'Desistente' : STATUS_LABEL[patient.status]}
            </span>
          </div>
        </div>

        {/* METADADOS DA AGENDA */}
        <div className="flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>Próxima: {formatNextAppointment(patient.nextAppointmentAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span>{patient.completedSessions} Sessões</span>
          </div>
        </div>
      </div>

      {/* AÇÕES COMPACTAS EM GRADE MINIMALISTA (3 BOTÕES) */}
      <div className="space-y-2 border-t border-slate-100 pt-2.5">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onSelectTimeline(patient.id)}
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl border border-psi-vibrant/30 bg-psi-vibrant/5 px-2 py-2 text-center text-[11px] font-extrabold text-psi-deep transition-colors hover:bg-psi-vibrant/15"
            title="Ver prontuário do paciente"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-psi-vibrant" />
            <span className="truncate">Prontuário</span>
          </button>

          <button
            type="button"
            onClick={() => onSchedule(patient)}
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-extrabold text-slate-700 transition-colors hover:bg-slate-100"
            title="Agendar horário na agenda"
          >
            <CalendarPlus className="h-3.5 w-3.5 shrink-0 text-psi-vibrant" />
            <span className="truncate">Agendar</span>
          </button>

          <button
            type="button"
            onClick={() => onSendAgenda(patient)}
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-[11px] font-extrabold text-emerald-800 transition-colors hover:bg-emerald-100"
            title="Enviar link da agenda via WhatsApp"
          >
            <Send className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate">Enviar Agenda</span>
          </button>
        </div>

        {/* REGISTRAR DESISTÊNCIA (LINK SUTIL) */}
        {canRegisterDropout && !patient.dropoutRegistered && patient.status !== 'discharged' && onDropout && (
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => onDropout(patient)}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 transition-colors hover:text-rose-600"
            >
              <UserX className="h-3 w-3" />
              <span>Registrar desistência</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
