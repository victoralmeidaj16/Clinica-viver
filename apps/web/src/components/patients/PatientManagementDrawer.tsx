'use client';

import { useState } from 'react';
import { CalendarDays, CircleDollarSign, Clock3, UserRoundCog, X } from 'lucide-react';
import type { ManagedPatient, ManagedPsychologist } from './managementTypes';

interface Props {
  patient: ManagedPatient | null;
  psychologists: readonly ManagedPsychologist[];
  onClose: () => void;
  onReassign: (patientId: string, professionalId: string, reason: string) => Promise<void>;
}

const money = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(cents / 100);

export default function PatientManagementDrawer({ patient, psychologists, onClose, onReassign }: Props) {
  const [professionalId, setProfessionalId] = useState(patient?.psicologoId ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!patient) return null;

  const submit = async () => {
    if (!patient.patientId || !professionalId || !reason.trim()) return;
    setSaving(true);
    setError('');
    try { await onReassign(patient.patientId, professionalId, reason.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao reatribuir paciente.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-[#fbfaf7] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-stone-200 bg-[#fbfaf7]/95 p-6 backdrop-blur">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">Visão administrativa</p>
            <h2 className="mt-1 font-serif text-3xl font-bold text-slate-950">{patient.nome}</h2>
            <p className="mt-1 text-xs text-slate-500">{patient.protocolo ?? patient.id}</p>
          </div>
          <button aria-label="Fechar detalhes" onClick={onClose} className="rounded-full border border-stone-200 p-2 text-slate-500 hover:bg-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <section className="grid grid-cols-2 gap-3">
            <Info label="WhatsApp" value={patient.whatsapp} />
            <Info label="E-mail" value={patient.email} />
            <Info label="CPF" value={patient.cpf} />
            <Info label="Idade" value={patient.idade} />
            <Info label="CEP / número" value={[patient.cep, patient.numeroResidencia].filter(Boolean).join(' · ')} />
            <Info label="Convênio" value={patient.convenioSelecionado} />
          </section>

          {/* O que a pessoa pediu na triagem, do jeito que pediu. */}
          <section className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-4">
            <Info label="Serviço" value={patient.servicoNome ?? patient.servicoKey} />
            <Info label="Modalidade / turno" value={[patient.modalidade, patient.turno].filter(Boolean).join(' · ')} />
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

          <section className="grid grid-cols-3 gap-3">
            <Metric icon={Clock3} label="Espera" value={patient.horasEspera ? `${patient.horasEspera}h` : 'Concluída'} />
            <Metric icon={CalendarDays} label="Sessões" value={`${patient.agenda.realizadas}/${patient.agenda.total}`} />
            <Metric icon={CircleDollarSign} label="Em aberto" value={money(patient.financeiro.emAbertoCentavos)} />
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRoundCog className="h-4 w-4 text-teal-700" />
              <h3 className="text-sm font-black text-slate-900">Reatribuir psicólogo</h3>
            </div>
            {!patient.patientId ? (
              <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                A reatribuição fica disponível depois que o contato é confirmado e o lead vira paciente.
              </p>
            ) : (
              <div className="space-y-3">
                <select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm">
                  <option value="">Selecione o novo responsável</option>
                  {psychologists.map((psychologist) => <option key={psychologist.id} value={psychologist.id}>{psychologist.nome}</option>)}
                </select>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatório da troca" rows={3} className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
                {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
                <button onClick={submit} disabled={saving || !professionalId || !reason.trim()} className="w-full rounded-xl bg-teal-800 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                  {saving ? 'Registrando troca…' : 'Confirmar reatribuição'}
                </button>
              </div>
            )}
          </section>

          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            Esta área mostra apenas dados operacionais. Conteúdo de sessões e prontuário clínico não é exposto à gestão.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value || 'Não informado'}</p></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="rounded-xl bg-slate-900 p-3 text-white"><Icon className="mb-3 h-4 w-4 text-teal-300" /><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}
