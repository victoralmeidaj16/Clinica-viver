'use client';

import React, { useState } from 'react';
import PatientList from '@/components/patients/PatientList';
import NewPatientModal from '@/components/patients/NewPatientModal';
import { INITIAL_PATIENTS, Paciente } from '@/lib/mockData';
import { useRouter } from 'next/navigation';

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
