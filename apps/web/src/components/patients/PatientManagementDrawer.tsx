'use client';

import { useState } from 'react';
import { UserRoundPen, CalendarDays, CircleDollarSign, Clock3, X } from 'lucide-react';
import { rotuloTurnoPreferencia } from '@/lib/turnos';
import EditPatientModal from './EditPatientModal';
import PatientConvenioPanel from './PatientConvenioPanel';
import PatientSessionPricingPanel from './PatientSessionPricingPanel';
import PatientDropoutPanel from './PatientDropoutPanel';
import PatientAdministrativeHistoryPanel from './PatientAdministrativeHistoryPanel';
import PatientReassignPanel from './PatientReassignPanel';
import PatientPreferencesPanel from './PatientPreferencesPanel';
import PatientWaitlistPanel from './PatientWaitlistPanel';
import PatientInactivationPanel from './PatientInactivationPanel';
import PatientBondForm from './PatientBondForm';
import type { ManagedConvenio, ManagedPatient, ManagedPsychologist, ReassignOptions } from './managementTypes';
import type { CusteioCiclo } from '@/lib/convenioBilling';
import type { SessionPricingCategory } from './patientSessionPricingView';

interface Props {
  patient: ManagedPatient | null;
  psychologists: readonly ManagedPsychologist[];
  convenios: readonly ManagedConvenio[];
  onClose: () => void;
  onReassign: (
    patient: ManagedPatient,
    professionalId: string,
    reason: string,
    options?: ReassignOptions,
  ) => Promise<void>;
  /** Recarrega a fila depois de registrar a saída ou o reengajamento. */
  onDropoutChange: () => Promise<void>;
  onRegistrationChange: () => Promise<void>;
  onConvenioChange: (
    patientId: string,
    convenioId: string | null,
    custeadoPelaEmpresa: boolean | null,
    cota: { custeioCota: number | null; custeioCiclo: CusteioCiclo | null },
  ) => Promise<void>;
  onSessionPricingChange: (patientId: string, input: { category: SessionPricingCategory; customAmountCents?: number }) => Promise<void>;
}

const money = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(cents / 100);

export default function PatientManagementDrawer({ patient, psychologists, convenios, onClose, onReassign, onDropoutChange, onConvenioChange, onSessionPricingChange, onRegistrationChange }: Props) {
  const [editing, setEditing] = useState(false);

  if (!patient) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end bg-psi-darkest/60 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-psi-soft bg-surface shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-psi-soft bg-surface/95 p-4 backdrop-blur sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-psi-vibrant">Visão administrativa</p>
            <h2 className="mt-1 break-words text-xl font-extrabold text-ink sm:text-2xl">{patient.nome}</h2>
            <p className="mt-0.5 text-xs text-muted font-medium">{patient.protocolo ?? patient.id}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-psi-soft p-2 text-muted transition-colors hover:bg-psi-soft/50 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
          {patient.patientId ? (
            <button type="button" className="btn-primary w-full justify-center" onClick={() => setEditing(true)}>
              <UserRoundPen className="h-4 w-4" /> Editar dados
            </button>
          ) : <p className="text-xs text-muted">A edição cadastral fica disponível depois que a triagem vira paciente.</p>}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="WhatsApp" value={patient.whatsapp} />
            <Info label="E-mail" value={patient.email} />
            <Info label="CPF" value={patient.cpf || (patient.identificadoPeloResponsavel
              ? `Sem CPF próprio — pelo responsável (${patient.responsavelFinanceiro?.cpf ?? ''})`
              : patient.vinculoColetivo ? 'No responsável e nos participantes' : undefined)} />
            <Info label="Idade" value={patient.idade} />
            <Info label="CEP / número" value={[patient.cep, patient.numeroResidencia].filter(Boolean).join(' · ')} />
            <Info label="Convênio informado" value={patient.convenioSelecionado} />
          </section>

          <PatientConvenioPanel patient={patient} convenios={convenios} onConvenioChange={onConvenioChange} />
          <PatientSessionPricingPanel patient={patient} onChange={onSessionPricingChange} />

          {/* O que a pessoa pediu na triagem, do jeito que pediu. */}
          <section className="grid grid-cols-1 gap-3 border-t border-psi-soft/60 pt-4 sm:grid-cols-2">
            <Info label="Serviço" value={patient.servicoNome ?? patient.servicoKey} />
            <Info
              label="Modalidade / turno"
              value={[patient.modalidade, patient.turno && rotuloTurnoPreferencia(patient.turno)].filter(Boolean).join(' · ')}
            />
            <Info label="Público" value={patient.paraQuemE} />
            <Info label="Opção de avaliação" value={patient.opcaoAvaliacaoPsicologica} />
            <Info label="Necessidades" value={[...(patient.necessidadesPaciente ?? []), patient.necessidadesOutro].filter(Boolean).join(', ')} />
            <Info
              label="Entrada / confirmação"
              value={[
                patient.criadoEm && `entrou ${new Date(patient.criadoEm).toLocaleDateString('pt-BR')}`,
                patient.confirmadoEm && `confirmou ${new Date(patient.confirmadoEm).toLocaleDateString('pt-BR')}`,
              ].filter(Boolean).join(' · ')}
            />
          </section>

          <PatientPreferencesPanel key={`pref-${patient.id}`} patient={patient} onChange={onRegistrationChange} />

          {patient.patientId
            ? <PatientBondForm key={`vinculo-${patient.patientId}`} patientId={patient.patientId} onSaved={onRegistrationChange} />
            : patient.responsavelFinanceiro && (
              <Info label="Responsável financeiro" value={`${patient.responsavelFinanceiro.nome} · CPF ${patient.responsavelFinanceiro.cpf}`} />
            )}

          <PatientAdministrativeHistoryPanel patient={patient} />

          <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
            <Metric icon={Clock3} label="Espera" value={patient.horasEspera ? `${patient.horasEspera}h` : 'Concluída'} />
            <Metric icon={CalendarDays} label="Sessões" value={`${patient.agenda.realizadas}/${patient.agenda.total}`} />
            <Metric icon={CircleDollarSign} label="Em aberto" value={money(patient.financeiro.emAbertoCentavos)} />
          </section>

          <PatientReassignPanel
            key={patient.id}
            patient={patient}
            psychologists={psychologists}
            onReassign={onReassign}
          />

          <PatientWaitlistPanel key={`espera-${patient.id}`} patient={patient} onChange={onRegistrationChange} />

          <PatientInactivationPanel key={`inativo-${patient.id}`} patient={patient} onChange={onRegistrationChange} />

          <PatientDropoutPanel patient={patient} onChange={onDropoutChange} />

          <p className="rounded-xl border border-psi-soft/60 bg-psi-soft/30 p-3 text-[11px] leading-relaxed text-muted">
            Esta área mostra apenas dados operacionais. Conteúdo de sessões e prontuário clínico não é exposto à gestão.
          </p>
        </div>
      </aside>
    </div>
    {editing && patient.patientId && <EditPatientModal
      patientId={patient.patientId}
      patientName={patient.nome}
      onClose={() => setEditing(false)}
      onSaved={onRegistrationChange}
    />}
    </>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-psi-soft/60 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xs font-bold text-ink">{value || 'Não informado'}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-psi-darkest p-3 text-white border border-white/10 shadow-sm">
      <Icon className="mb-2 h-4 w-4 text-psi-vibrant" />
      <p className="text-[9px] font-bold uppercase tracking-wider text-psi-soft/70">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
