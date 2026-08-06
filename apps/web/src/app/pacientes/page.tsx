'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PatientList from '@/components/patients/PatientList';
import NewPatientModal from '@/components/patients/NewPatientModal';
import { applicationRequest } from '@/lib/applicationApi';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, AlertTriangle } from 'lucide-react';

export default function PacientesPage() {
  const [patients, setPatients] = useState<readonly PatientDirectoryEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Cadeia de promessa em vez de `await` no corpo: todo `setState` acontece
  // dentro de callback, nunca de forma síncrona no efeito. O estado já nasce
  // carregando, então não há `setLoading(true)` aqui.
  const load = useCallback(
    () =>
      applicationRequest<PatientDirectoryEntry[]>('/patients')
        .then((items) => {
          setPatients(items);
          setError(null);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar os pacientes.');
        })
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelectForSession = (patientId: string) => {
    router.push(`/cockpit?patient=${encodeURIComponent(patientId)}`);
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

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-10 text-xs text-muted">Carregando pacientes…</div>
      ) : (
        <PatientList
          patients={patients}
          onSelectForSession={handleSelectForSession}
          onOpenNewPatientModal={() => setIsModalOpen(true)}
        />
      )}

      <NewPatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPatientCreated={load}
      />
    </div>
  );
}
