'use client';

import React from 'react';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import { Phone, Calendar, Clock, ArrowRight, Zap, CheckCircle2, PauseCircle, UserCheck } from 'lucide-react';

interface PatientListProps {
  patients: readonly PatientDirectoryEntry[];
  onSelectForSession: (patientId: string) => void;
  onOpenNewPatientModal: () => void;
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

export default function PatientList({ patients, onSelectForSession, onOpenNewPatientModal }: PatientListProps) {
  return (
    <div className="space-y-6">
      {/* Top Banner de Gestão */}
      <div className="card bg-gradient-to-r from-primary via-primary-dark to-purple-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 shadow-xl">
        <div className="space-y-1">
          <span className="chip bg-white/10 text-white border-white/20 text-xs">
            Gestão de Atendimentos
          </span>
          <h2 className="text-xl font-black">Prontuários & Lista de Pacientes</h2>
          <p className="text-xs text-white/80 max-w-xl">
            Acompanhe o histórico de sessões, o plano terapêutico e inicie a automação pós-sessão SOAP com 1 clique para qualquer paciente.
          </p>
        </div>

        <button onClick={onOpenNewPatientModal} className="btn-accent py-2.5 px-4 text-xs shrink-0 shadow-md">
          + Cadastrar Novo Paciente
        </button>
      </div>

      {patients.length === 0 && (
        <div className="card text-center py-10 space-y-2">
          <p className="text-sm font-bold text-ink">Nenhum paciente cadastrado</p>
          <p className="text-xs text-muted">
            Cadastre o primeiro paciente para que ele apareça na agenda e no cockpit.
          </p>
        </div>
      )}

      {/* Grid de Pacientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patients.map((patient) => (
          <div key={patient.id} className="card card-hover space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center text-base border border-primary/20">
                  {patient.displayName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-ink">{patient.displayName}</h3>
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
                {STATUS_LABEL[patient.status]}
              </span>
            </div>

            {/* Profissional responsável */}
            <div className="bg-canvas p-3 rounded-xl border border-line text-xs space-y-1">
              <span className="font-bold text-muted uppercase text-[10px] tracking-wide">Profissional Responsável</span>
              <p className="text-ink font-medium leading-snug flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                {patient.professionalName ?? 'Não atribuído'}
              </p>
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

            {/* Ação Rápida */}
            <button
              onClick={() => onSelectForSession(patient.id)}
              className="w-full btn-outline text-xs py-2.5 justify-center gap-2 group"
            >
              <Zap className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
              <span>Iniciar Sessão no Cockpit SOAP 1-Clique</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
