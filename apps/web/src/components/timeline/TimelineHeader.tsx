import React from 'react';
import {
  BookOpenCheck,
  Fingerprint,
  Layers3,
  UserCheck,
  ShieldCheck,
  Award,
  ChevronDown,
  Lock,
} from 'lucide-react';
import type { ClinicalTimelineEntry } from '@thats-life/core';
import { INITIAL_PATIENTS } from '@/lib/mockData';

export interface ProfessionalRoleOption {
  id: string;
  name: string;
  crp: string;
  role: string;
  specialty: string;
  badgeColor: string;
  permissions: string[];
}

export const DEMO_PROFESSIONALS: ProfessionalRoleOption[] = [
  {
    id: 'prof-1',
    name: 'Dra. Camila Vasconcelos',
    crp: 'CRP 06/148293',
    role: 'Psicóloga Titular (Responsável Técnica)',
    specialty: 'TCC & Regulação Emocional',
    badgeColor: 'bg-psi-vibrant text-white',
    permissions: ['Edição de SOAP', 'Assinatura Digital', 'Prescrição de Tarefas', 'Acesso Total ao Dossiê'],
  },
  {
    id: 'prof-2',
    name: 'Dr. Rafael Mendonça',
    crp: 'CRP 06/192840',
    role: 'Supervisor Clínico & Preceptor',
    specialty: 'Psicanálise & Casos Complexos',
    badgeColor: 'bg-indigo-600 text-white',
    permissions: ['Revisão de Supervisão', 'Aprovação de Relatórios', 'Leitura Anonimizada PII'],
  },
  {
    id: 'prof-3',
    name: 'Ana Clara Silva',
    crp: 'CRP 06/E-0482',
    role: 'Estagiária / Residente em Psicologia',
    specialty: 'Psicometria & Aplicação de Escalas',
    badgeColor: 'bg-amber-600 text-white',
    permissions: ['Elaboração de Rascunho SOAP', 'Aplicação de Quiz', 'Leitura Sob Supervisão'],
  },
];

interface TimelineHeaderProps {
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  selectedProfessionalId: string;
  onSelectProfessional: (id: string) => void;
  entries: readonly ClinicalTimelineEntry[];
}

export default function TimelineHeader({
  selectedPatientId,
  onSelectPatient,
  selectedProfessionalId,
  onSelectProfessional,
  entries,
}: TimelineHeaderProps) {
  const selectedPatient =
    INITIAL_PATIENTS.find((p) => p.id === selectedPatientId) ?? INITIAL_PATIENTS[0];

  const selectedProfessional =
    DEMO_PROFESSIONALS.find((p) => p.id === selectedProfessionalId) ?? DEMO_PROFESSIONALS[0];

  const sources = new Set(
    entries.map((entry) => `${entry.evidence.sourceType}:${entry.evidence.sourceId}`)
  ).size;

  const firstEntry = entries.at(-1);

  return (
    <header className="relative overflow-hidden rounded-[28px] bg-psi-darkest px-6 py-7 text-white shadow-contrast sm:px-8 border border-white/10">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative space-y-6">
        {/* Top Controls: Seletor de Paciente e Seletor de Papel do Psicólogo */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Paciente */}
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl border border-white/15">
              <span className="text-[10px] uppercase font-bold text-psi-vibrant tracking-wider">Paciente:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => onSelectPatient(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {INITIAL_PATIENTS.map((patient) => (
                  <option key={patient.id} value={patient.id} className="text-ink">
                    {patient.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de Papel do Psicólogo */}
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl border border-white/15">
              <UserCheck className="w-4 h-4 text-psi-vibrant" />
              <span className="text-[10px] uppercase font-bold text-psi-vibrant tracking-wider">Psicólogo / Papel:</span>
              <select
                value={selectedProfessionalId}
                onChange={(e) => onSelectProfessional(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {DEMO_PROFESSIONALS.map((prof) => (
                  <option key={prof.id} value={prof.id} className="text-ink">
                    {prof.name} ({prof.crp})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Badge de Conformidade CFP */}
          <div className="flex items-center gap-2 text-xs text-white/90 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Guarda Regulatória CFP N.º 01/2009 — Criptografia SHA-256</span>
          </div>
        </div>

        {/* Informações Principais do Dossiê e Psicólogo Selecionado */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-psi-vibrant">
              <BookOpenCheck className="h-4 w-4" />
              Dossiê Longitudinal Verificável
            </div>

            <h1 className="max-w-3xl font-serif text-2xl sm:text-3xl font-bold leading-tight text-white">
              Histórico Clínico Auditável de {selectedPatient.nome}
            </h1>

            <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-psi-soft/80">
              Cada acontecimento, escala ou prontuário nesta linha do tempo possui integridade criptográfica encadeada.
              Visualizando com as permissões de <strong>{selectedProfessional.name}</strong> ({selectedProfessional.role}).
            </p>

            {/* Tags de Permissões do Psicólogo Selecionado */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${selectedProfessional.badgeColor}`}>
                {selectedProfessional.role}
              </span>
              {selectedProfessional.permissions.map((perm, idx) => (
                <span key={idx} className="text-[10px] bg-white/10 border border-white/15 text-psi-soft px-2 py-0.5 rounded-md font-medium">
                  {perm}
                </span>
              ))}
            </div>
          </div>

          {/* Métricas do Dossiê */}
          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] backdrop-blur">
            <Metric icon={<Layers3 className="h-4 w-4" />} value={entries.length} label="marcos" />
            <Metric icon={<Fingerprint className="h-4 w-4" />} value={sources} label="fontes" />
            <Metric
              icon={<BookOpenCheck className="h-4 w-4" />}
              value={firstEntry ? new Date(firstEntry.occurredAt).getFullYear() : '—'}
              label="desde"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="min-w-20 border-r border-white/10 px-4 py-3.5 last:border-r-0 text-center sm:text-left">
      <div className="mb-1 text-psi-vibrant flex justify-center sm:justify-start">{icon}</div>
      <p className="font-serif text-2xl font-bold leading-none text-white">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-psi-soft/60">{label}</p>
    </div>
  );
}
