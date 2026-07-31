'use client';

import React from 'react';
import { Paciente } from '@/lib/mockData';
import { Phone, Calendar, Clock, ArrowRight, Zap, CheckCircle2, PauseCircle } from 'lucide-react';

interface PatientListProps {
  patients: Paciente[];
  onSelectForSession: (patientId: string) => void;
  onOpenNewPatientModal: () => void;
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

      {/* Grid de Pacientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patients.map((patient) => (
          <div key={patient.id} className="card card-hover space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center text-base border border-primary/20">
                  {patient.nome.charAt(0)}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-ink">{patient.nome}</h3>
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {patient.telefone}
                  </p>
                </div>
              </div>

              <span
                className={`chip text-[11px] ${
                  patient.status === 'ativo'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {patient.status === 'ativo' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Ativo
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-3 h-3 text-amber-600" />
                    Em Pausa
                  </>
                )}
              </span>
            </div>

            {/* Plano de Atendimento */}
            <div className="bg-canvas p-3 rounded-xl border border-line text-xs space-y-1">
              <span className="font-bold text-muted uppercase text-[10px] tracking-wide">Plano Terapêutico</span>
              <p className="text-ink font-medium leading-snug">{patient.planoAtendimento}</p>
            </div>

            {/* Metadados da Agenda */}
            <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-line">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Próxima: {patient.proximaSessao}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span>{patient.historicoSessoesCount} Sessões</span>
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
