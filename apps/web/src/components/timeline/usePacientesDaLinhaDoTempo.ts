'use client';

import { useEffect, useState } from 'react';
import { applicationRequest } from '@/lib/applicationApi';

export interface TimelinePatient {
  id: string;
  displayName: string;
  phone?: string;
  email?: string;
  status?: string;
  demanda?: string;
  nextAppointmentAt?: string;
  completedSessions?: number;
}

/** Paciente de vínculo encerrado: só identificação e nome (especificação final, §§ 6.09 e 8.05). */
export interface PacienteDeVinculoEncerrado {
  patientId: string;
  displayName: string;
}

/**
 * Pacientes da linha do tempo: os que o psicólogo atende hoje e os de vínculos
 * encerrados em que ele registrou prontuário. A segunda lista é complementar:
 * se ela falhar, a tela segue com os pacientes atuais.
 */
export function usePacientesDaLinhaDoTempo(urlPatientId: string | null) {
  const [patients, setPatients] = useState<TimelinePatient[]>([]);
  const [encerrados, setEncerrados] = useState<PacienteDeVinculoEncerrado[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(urlPatientId || '');
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      applicationRequest<TimelinePatient[]>('/patients'),
      applicationRequest<PacienteDeVinculoEncerrado[]>('/timeline/vinculos-encerrados')
        .catch((): PacienteDeVinculoEncerrado[] => []),
    ])
      .then(([atuais, anteriores]) => {
        if (cancelled) return;
        const idsAtuais = new Set(atuais.map((patient) => patient.id));
        const somenteEncerrados = (Array.isArray(anteriores) ? anteriores : [])
          .filter((patient) => !idsAtuais.has(patient.patientId));
        setPatients(atuais);
        setEncerrados(somenteEncerrados);
        if (urlPatientId) {
          setSelectedPatientId(urlPatientId);
        } else {
          const primeiro = atuais[0]?.id ?? somenteEncerrados[0]?.patientId;
          if (primeiro) setSelectedPatientId((current) => current || primeiro);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar seus pacientes.');
      });
    return () => {
      cancelled = true;
    };
  }, [urlPatientId]);

  return { patients, setPatients, encerrados, selectedPatientId, setSelectedPatientId, loadError };
}
