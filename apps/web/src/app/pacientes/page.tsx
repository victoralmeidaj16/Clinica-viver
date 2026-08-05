'use client';

import React, { useState } from 'react';
import PatientList from '@/components/patients/PatientList';
import NewPatientModal from '@/components/patients/NewPatientModal';
import { INITIAL_PATIENTS, Paciente } from '@/lib/mockData';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock } from 'lucide-react';

export default function PacientesPage() {
  const [patients, setPatients] = useState<Paciente[]>(INITIAL_PATIENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const handleSelectForSession = (patientId: string) => {
    router.push(`/cockpit?patient=${encodeURIComponent(patientId)}`);
  };

  const handleAddPatient = (newPatient: Paciente) => {
    setPatients([newPatient, ...patients]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Banner de Sigilo Estrito de Dados (Requisito Giuliana) */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-emerald-900">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <h3 className="font-extrabold text-xs">Sigilo & Privacidade por Profissional Ativo</h3>
            <p className="text-[11px] text-emerald-700">
              Em conformidade com o CFP e LGPD, você visualiza exclusivamente os pacientes vinculados ao seu perfil.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Acesso Restrito
        </span>
      </div>

      <PatientList
        patients={patients}
        onSelectForSession={handleSelectForSession}
        onOpenNewPatientModal={() => setIsModalOpen(true)}
      />

      <NewPatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddPatient={handleAddPatient}
      />
    </div>
  );
}
