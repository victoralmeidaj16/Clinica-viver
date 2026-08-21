'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import {
  Phone,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  PauseCircle,
  Send,
  CalendarPlus,
  FileText,
  UserX,
} from 'lucide-react';
import PatientDropoutModal from './PatientDropoutModal';
import { ManualAppointmentDialog } from '@/components/scheduling/ManualAppointmentDialog';
import { PatientListToolbar } from './PatientListToolbar';

interface PatientListProps {
  patients: readonly PatientDirectoryEntry[];
  agendaToken?: string;
  onOpenNewPatientModal: () => void;
  onPatientUpdated?: () => void;
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

export default function PatientList({
  patients,
  agendaToken,
  onOpenNewPatientModal,
  onPatientUpdated,
  canRegisterDropout = false,
}: PatientListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [patientForSchedule, setPatientForSchedule] = useState<PatientDirectoryEntry | null>(null);
  const [patientForDropout, setPatientForDropout] = useState<PatientDirectoryEntry | null>(null);

  // KPIs Rápidos
  const pacientesAtivosCount = patients.filter((p) => p.status === 'active').length;
  const sessoesNoMesCount = patients.reduce((acc, p) => acc + (p.completedSessions || 0), 0);

  // Filtro de Pesquisa (Nome, Telefone ou Email)
  const filteredPatients = patients.filter((patient) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const cleanQuery = query.replace(/\D/g, '');
    const cleanPhone = (patient.phone || '').replace(/\D/g, '');

    return (
      patient.displayName.toLowerCase().includes(query) ||
      (patient.email && patient.email.toLowerCase().includes(query)) ||
      (cleanQuery.length > 0 && cleanPhone.includes(cleanQuery))
    );
  });

  const abrirWhatsAppAgenda = (patient: PatientDirectoryEntry) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://clinica-viver-web.vercel.app';
    const linkAgenda = agendaToken ? `${origin}/agendar/${agendaToken}` : `${origin}/agenda`;

    const texto = encodeURIComponent(
      `Olá, ${patient.displayName}! Segue o link para você escolher o melhor dia e horário para a nossa próxima sessão na Clínica Viver Mais:\n\n${linkAgenda}`
    );

    const telefoneLimpo = (patient.phone || '').replace(/\D/g, '');
    const urlWhatsApp = telefoneLimpo
      ? `https://wa.me/55${telefoneLimpo}?text=${texto}`
      : `https://wa.me/?text=${texto}`;

    window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <PatientListToolbar
        activePatients={pacientesAtivosCount}
        completedSessions={sessoesNoMesCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenNewPatientModal={onOpenNewPatientModal}
      />

      {patients.length === 0 && (
        <div className="card text-center py-10 space-y-2">
          <p className="text-sm font-bold text-ink">Nenhum paciente cadastrado</p>
          <p className="text-xs text-muted">
            Cadastre o primeiro paciente para que ele apareça na agenda e no cockpit.
          </p>
        </div>
      )}

      {patients.length > 0 && filteredPatients.length === 0 && (
        <div className="card text-center py-10 space-y-2">
          <p className="text-sm font-bold text-ink">Nenhum paciente encontrado</p>
          <p className="text-xs text-muted">
            Não encontramos resultados para &quot;{searchQuery}&quot;. Tente outro nome ou número.
          </p>
        </div>
      )}

      {/* Grid de Pacientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPatients.map((patient) => (
          <div key={patient.id} className="card card-hover space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center text-base border border-primary/20">
                    {patient.displayName.charAt(0)}
                  </div>
                  <div
                    onClick={() => router.push(`/linha-do-tempo?patientId=${patient.id}`)}
                    className="cursor-pointer group/patient"
                  >
                    <h3 className="font-extrabold text-sm text-ink group-hover/patient:text-psi-vibrant transition-colors">{patient.displayName}</h3>
                    {patient.phone && (
                      <p className="text-xs text-muted flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {patient.phone}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`chip text-[11px] ${
                    patient.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {patient.status === 'active' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <PauseCircle className="w-3 h-3 text-amber-600" />
                  )}
                  {patient.dropoutRegistered ? 'Desistente' : STATUS_LABEL[patient.status]}
                </span>
              </div>

              {/* Metadados da Agenda */}
              <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-line">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Próxima: {formatNextAppointment(patient.nextAppointmentAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>{patient.completedSessions} Sessões</span>
                </div>
              </div>
            </div>

            {/* Ações Rápidas (3 Botões) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => router.push(`/linha-do-tempo?patientId=${patient.id}`)}
                className="w-full btn-outline text-xs py-2.5 justify-center gap-2 group"
              >
                <FileText className="w-3.5 h-3.5 text-psi-vibrant group-hover:scale-110 transition-transform" />
                <span>Ver Prontuário do Paciente</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setPatientForSchedule(patient);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-2 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CalendarPlus className="w-3.5 h-3.5 text-psi-vibrant" />
                  <span>Agendar Horário</span>
                </button>

                <button
                  onClick={() => abrirWhatsAppAgenda(patient)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 p-2 text-[11px] font-bold text-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enviar Agenda</span>
                </button>
              </div>

              {canRegisterDropout && !patient.dropoutRegistered && patient.status !== 'discharged' && (
                <button
                  type="button"
                  onClick={() => setPatientForDropout(patient)}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50 p-2 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <UserX className="h-3.5 w-3.5" />
                    Registrar desistência
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {patientForSchedule && (
        <ManualAppointmentDialog
          patients={patients}
          initialPatientId={patientForSchedule.id}
          onClose={() => setPatientForSchedule(null)}
          onScheduled={() => onPatientUpdated?.()}
        />
      )}

      {patientForDropout && (
        <PatientDropoutModal
          key={patientForDropout.id}
          patient={patientForDropout}
          onClose={() => setPatientForDropout(null)}
          onRegistered={() => onPatientUpdated?.()}
        />
      )}
    </div>
  );
}
