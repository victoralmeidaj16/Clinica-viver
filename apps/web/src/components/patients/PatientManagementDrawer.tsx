'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, UserRoundPen, X } from 'lucide-react';
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

/**
 * Visão administrativa do paciente, em modal central.
 *
 * O cabeçalho repete o bloco roxo das páginas de gestão (título grande sobre
 * `psi-darkest`, números ao lado), para a janela parecer parte da plataforma e
 * não um painel genérico por cima dela.
 */
export default function PatientManagementDrawer({ patient, psychologists, convenios, onClose, onReassign, onDropoutChange, onConvenioChange, onSessionPricingChange, onRegistrationChange }: Props) {
  const [editing, setEditing] = useState(false);
  const fechar = useRef<HTMLButtonElement>(null);
  const aberto = Boolean(patient);
  // Quem abre costuma passar uma função nova a cada render; o efeito abaixo
  // não pode reagir a isso, ou o foco voltaria ao "fechar" a cada atualização.
  const aoFechar = useRef(onClose);
  useEffect(() => { aoFechar.current = onClose; }, [onClose]);
  const editando = useRef(editing);
  useEffect(() => { editando.current = editing; }, [editing]);

  // Modal de verdade: o foco entra nele, o Esc fecha, a página de trás não
  // rola, e ao fechar o foco volta para onde estava.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fechar.current?.focus();
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !editando.current) aoFechar.current();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!patient) return null;

  const metricas = [
    { label: 'Espera', value: patient.horasEspera ? `${patient.horasEspera}h` : 'Concluída' },
    { label: 'Sessões', value: `${patient.agenda.realizadas}/${patient.agenda.total}` },
    { label: 'Em aberto', value: money(patient.financeiro.emAbertoCentavos) },
  ];

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-psi-darkest/60 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-visao-administrativa"
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-canvas shadow-contrast sm:max-h-[90dvh] sm:rounded-3xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="relative shrink-0 bg-psi-darkest px-5 pb-6 pt-5 text-white sm:px-8 sm:pb-8 sm:pt-7">
          <button
            ref={fechar}
            type="button"
            aria-label="Fechar visão administrativa"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-psi-soft transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-psi-vibrant sm:right-6 sm:top-6"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>

          <p className="flex items-center gap-2 pr-14 text-xs font-black uppercase tracking-[0.2em] text-psi-vibrant">
            <ShieldCheck aria-hidden className="h-4 w-4" /> Visão administrativa
          </p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h2 id="titulo-visao-administrativa" className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
                {patient.nome}
              </h2>
              <p className="mt-1 text-sm tabular-nums text-psi-soft/80">{patient.protocolo ?? patient.id}</p>
            </div>
            <dl className="grid shrink-0 grid-cols-3 gap-2">
              {metricas.map((item) => (
                <div key={item.label} className="min-w-24 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-psi-soft/70">{item.label}</dt>
                  <dd className="mt-1 text-base font-black tabular-nums text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {patient.patientId && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-psi-darkest transition-colors hover:bg-psi-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-psi-vibrant"
            >
              <UserRoundPen aria-hidden className="h-4 w-4" /> Editar dados
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-8">
          {!patient.patientId && (
            <p className="rounded-xl border border-psi-soft bg-surface p-3 text-sm text-muted">
              A edição cadastral fica disponível depois que a triagem vira paciente.
            </p>
          )}

          <section aria-label="Contato e cadastro" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="WhatsApp" value={patient.whatsapp} />
            <Info label="E-mail" value={patient.email} />
            <Info label="CPF" value={patient.cpf || (patient.identificadoPeloResponsavel
              ? `Sem CPF próprio — pelo responsável (${patient.responsavelFinanceiro?.cpf ?? ''})`
              : patient.vinculoColetivo ? 'No responsável e nos participantes' : undefined)} />
            <Info label="Idade" value={patient.idade} />
            <Info label="CEP / número" value={[patient.cep, patient.numeroResidencia].filter(Boolean).join(' · ')} />
            <Info label="Convênio informado" value={patient.convenioSelecionado} />
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <PatientConvenioPanel patient={patient} convenios={convenios} onConvenioChange={onConvenioChange} />
            <PatientSessionPricingPanel patient={patient} onChange={onSessionPricingChange} />
          </div>

          {/* O que a pessoa pediu na triagem, do jeito que pediu. */}
          <section aria-label="Pedido na triagem" className="grid grid-cols-1 gap-3 border-t border-psi-soft pt-6 sm:grid-cols-2 lg:grid-cols-3">
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <PatientReassignPanel key={patient.id} patient={patient} psychologists={psychologists} onReassign={onReassign} />
            <PatientWaitlistPanel key={`espera-${patient.id}`} patient={patient} onChange={onRegistrationChange} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <PatientInactivationPanel key={`inativo-${patient.id}`} patient={patient} onChange={onRegistrationChange} />
            <PatientDropoutPanel patient={patient} onChange={onDropoutChange} />
          </div>

          <p className="flex items-start gap-2 rounded-2xl border border-psi-soft bg-psi-soft/40 p-4 text-xs leading-relaxed text-psi-darkest">
            <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-psi-vibrant" />
            Esta área mostra apenas dados operacionais. Conteúdo de sessões e prontuário clínico não é exposto à gestão.
          </p>
        </div>
      </div>
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
    <div className="rounded-2xl border border-psi-soft bg-surface p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-ink">{value || 'Não informado'}</p>
    </div>
  );
}
