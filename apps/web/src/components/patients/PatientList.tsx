'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import PatientDropoutModal from './PatientDropoutModal';
import { ManualAppointmentDialog } from '@/components/scheduling/ManualAppointmentDialog';
import { PatientListToolbar } from './PatientListToolbar';
import EditPatientModal from './EditPatientModal';
import { PatientCard } from './PatientCard';
import { FocoDeNotificacao } from '@/components/layout/FocoDeNotificacao';
import { FOCO_SECAO } from '@/lib/focoNotificacao';

interface PatientListProps {
  patients: readonly PatientDirectoryEntry[];
  agendaToken?: string;
  onOpenNewPatientModal: () => void;
  onPatientUpdated?: () => void;
  canRegisterDropout?: boolean;
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
  const [patientForEdit, setPatientForEdit] = useState<PatientDirectoryEntry | null>(null);

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
    <div className="space-y-6" data-foco={FOCO_SECAO.listaPacientes}>
      <FocoDeNotificacao aoFocar={() => setSearchQuery('')} />

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

      {/* Grid de Pacientes com Cards Modulares e Minimalistas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPatients.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            onSelectTimeline={(id) => router.push(`/linha-do-tempo?patientId=${id}`)}
            onEdit={setPatientForEdit}
            onSchedule={setPatientForSchedule}
            onSendAgenda={abrirWhatsAppAgenda}
            onDropout={setPatientForDropout}
            canRegisterDropout={canRegisterDropout}
          />
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

      {patientForEdit && (
        <EditPatientModal
          key={patientForEdit.id}
          patientId={patientForEdit.id}
          patientName={patientForEdit.displayName}
          onClose={() => setPatientForEdit(null)}
          onSaved={() => onPatientUpdated?.()}
        />
      )}
    </div>
  );
}
