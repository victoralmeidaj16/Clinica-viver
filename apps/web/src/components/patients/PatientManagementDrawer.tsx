'use client';

import { useState } from 'react';
import { Building2, CalendarDays, CircleDollarSign, Clock3, UserRoundCog, X } from 'lucide-react';
import { rotuloTurnoPreferencia } from '@/lib/turnos';
import PatientDropoutPanel from './PatientDropoutPanel';
import type { ManagedConvenio, ManagedPatient, ManagedPsychologist } from './managementTypes';

interface Props {
  patient: ManagedPatient | null;
  psychologists: readonly ManagedPsychologist[];
  convenios: readonly ManagedConvenio[];
  onClose: () => void;
  onReassign: (patientId: string, professionalId: string, reason: string) => Promise<void>;
  /** Recarrega a fila depois de registrar a saída ou o reengajamento. */
  onDropoutChange: () => Promise<void>;
  onConvenioChange: (patientId: string, convenioId: string | null, custeadoPelaEmpresa: boolean | null) => Promise<void>;
}

const money = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(cents / 100);

export default function PatientManagementDrawer({ patient, psychologists, convenios, onClose, onReassign, onDropoutChange, onConvenioChange }: Props) {
  const [professionalId, setProfessionalId] = useState(patient?.psicologoId ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [convenioId, setConvenioId] = useState(patient?.convenioId ?? '');
  const [custeio, setCusteio] = useState<'herdar' | 'sim' | 'nao'>(patient?.custeioConfigurado === undefined ? 'herdar' : patient.custeioConfigurado ? 'sim' : 'nao');
  const [savingConvenio, setSavingConvenio] = useState(false);
  const selectedConvenio = convenios.find((item) => item.id === convenioId);

  if (!patient) return null;

  const submit = async () => {
    if (!patient.patientId || !professionalId || !reason.trim()) return;
    setSaving(true);
    setError('');
    try { await onReassign(patient.patientId, professionalId, reason.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao reatribuir paciente.'); }
    finally { setSaving(false); }
  };

  const saveConvenio = async () => {
    if (!patient.patientId) return;
    setSavingConvenio(true); setError('');
    try {
      await onConvenioChange(patient.patientId, convenioId || null, convenioId ? (custeio === 'herdar' ? null : custeio === 'sim') : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao atualizar o convênio.'); }
    finally { setSavingConvenio(false); }
  };

  return (
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
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="WhatsApp" value={patient.whatsapp} />
            <Info label="E-mail" value={patient.email} />
            <Info label="CPF" value={patient.cpf} />
            <Info label="Idade" value={patient.idade} />
            <Info label="CEP / número" value={[patient.cep, patient.numeroResidencia].filter(Boolean).join(' · ')} />
            <Info label="Convênio informado" value={patient.convenioSelecionado} />
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-black text-ink">Vínculo com convênio</h3>
            </div>
            {!patient.patientId ? <p className="text-xs text-muted">O vínculo fica disponível depois que a triagem vira paciente.</p> : (
              <div className="space-y-3">
                <select value={convenioId} onChange={(event) => { setConvenioId(event.target.value); setCusteio('herdar'); }} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-medium text-ink">
                  <option value="">Sem convênio</option>
                  {convenios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
                {convenioId && (
                  <label className="block text-xs font-bold text-ink">
                    Quem paga as sessões
                    <select value={custeio} onChange={(event) => setCusteio(event.target.value as typeof custeio)} className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-medium text-ink">
                      <option value="herdar">Herdar: {selectedConvenio?.empresaPagaSessoes ? 'empresa paga' : 'paciente paga'}</option>
                      <option value="sim">Empresa paga (exceção)</option>
                      <option value="nao">Paciente paga (exceção)</option>
                    </select>
                  </label>
                )}
                <button type="button" onClick={() => void saveConvenio()} disabled={savingConvenio} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
                  {savingConvenio ? 'Salvando…' : 'Salvar vínculo'}
                </button>
              </div>
            )}
          </section>

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

          <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
            <Metric icon={Clock3} label="Espera" value={patient.horasEspera ? `${patient.horasEspera}h` : 'Concluída'} />
            <Metric icon={CalendarDays} label="Sessões" value={`${patient.agenda.realizadas}/${patient.agenda.total}`} />
            <Metric icon={CircleDollarSign} label="Em aberto" value={money(patient.financeiro.emAbertoCentavos)} />
          </section>

          <section className="rounded-2xl border border-psi-soft/60 bg-psi-soft/20 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRoundCog className="h-4 w-4 text-psi-vibrant" />
              <h3 className="text-sm font-black text-ink">Reatribuir psicólogo</h3>
            </div>
            {!patient.patientId ? (
              <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs font-semibold text-amber-800">
                A reatribuição fica disponível depois que o contato é confirmado e o lead vira paciente.
              </p>
            ) : (
              <div className="space-y-3">
                <select
                  value={professionalId}
                  onChange={(event) => setProfessionalId(event.target.value)}
                  className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs text-ink focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/20 font-medium"
                >
                  <option value="">Selecione o novo responsável</option>
                  {psychologists.map((psychologist) => <option key={psychologist.id} value={psychologist.id}>{psychologist.nome}</option>)}
                </select>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motivo obrigatório da troca"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs text-ink focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/20 font-medium"
                />
                {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving || !professionalId || !reason.trim()}
                  className="btn-primary w-full text-xs font-black py-3 rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Registrando troca…' : 'Confirmar reatribuição'}
                </button>
              </div>
            )}
          </section>

          <PatientDropoutPanel patient={patient} onChange={onDropoutChange} />

          <p className="rounded-xl border border-psi-soft/60 bg-psi-soft/30 p-3 text-[11px] leading-relaxed text-muted">
            Esta área mostra apenas dados operacionais. Conteúdo de sessões e prontuário clínico não é exposto à gestão.
          </p>
        </div>
      </aside>
    </div>
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
