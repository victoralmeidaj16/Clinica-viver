'use client';

import { useState } from 'react';
import { CircleDollarSign, Info, Pencil, Save } from 'lucide-react';
import type { ManagedPatient } from './managementTypes';
import {
  formatCents,
  parseReaisToCents,
  sessionPricingLabels,
  type SessionPricingCategory,
} from './patientSessionPricingView';

interface Props {
  patient: ManagedPatient;
  onChange: (patientId: string, input: { category: SessionPricingCategory; customAmountCents?: number }) => Promise<void>;
}

export default function PatientSessionPricingPanel({ patient, onChange }: Props) {
  const current = patient.sessionPricing;
  const [category, setCategory] = useState<SessionPricingCategory>(current?.category ?? 'particular');
  const [amount, setAmount] = useState(current?.customAmountCents ? (current.customAmountCents / 100).toFixed(2).replace('.', ',') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const customAmountCents = parseReaisToCents(amount);
  const custom = category === 'personalizado';
  const service = patient.servicoNome ?? patient.servicoKey ?? 'Atendimento psicológico';

  const selectCategory = (next: SessionPricingCategory) => {
    setCategory(next);
    if (next !== 'personalizado') setAmount('');
  };

  const save = async () => {
    if (!patient.patientId) return;
    if (custom && !customAmountCents) {
      setError('Informe um valor válido, por exemplo 75,00.');
      return;
    }
    setSaving(true); setError('');
    try {
      await onChange(patient.patientId, {
        category,
        ...(custom ? { customAmountCents: customAmountCents! } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o valor da sessão.');
    } finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-psi-soft bg-surface p-4 shadow-card sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <CircleDollarSign aria-hidden className="h-4 w-4 text-psi-vibrant" />
      <h3 className="text-sm font-black text-ink">Categoria e valor da sessão</h3>
    </div>
    {!patient.patientId ? <p className="text-xs text-muted">A configuração fica disponível depois que a triagem vira paciente.</p> : <div className="space-y-4">
      <label className="block text-xs font-bold text-ink">Modalidade de atendimento
        <div className="mt-1 rounded-xl border border-psi-soft bg-psi-light px-3 py-2.5 text-sm font-medium text-muted">{service}</div>
      </label>
      <div>
        <p className="text-xs font-bold text-ink">Categoria de atendimento</p>
        <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          {(Object.keys(sessionPricingLabels) as SessionPricingCategory[]).map((item) => <button
            key={item} type="button" onClick={() => selectCategory(item)}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-black transition-colors ${category === item ? 'border-psi-deep bg-psi-soft text-psi-darkest ring-1 ring-psi-vibrant/30' : 'border-psi-soft bg-white text-muted hover:bg-psi-light hover:text-ink'}`}
          >{item === 'personalizado' && <Pencil className="h-3.5 w-3.5" />}{sessionPricingLabels[item]}</button>)}
        </div>
      </div>
      {custom && <label className="block text-xs font-bold text-ink">Valor da sessão (R$)
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Ex.: 75,00" className="mt-1 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-sm font-medium text-ink focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20" />
      </label>}
      <div className="rounded-xl border border-psi-soft bg-psi-light p-3 text-xs">
        <p className="font-black text-psi-darkest">Resumo da configuração</p>
        <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <Summary label="Modalidade" value={service} />
          <Summary label="Categoria" value={sessionPricingLabels[category]} />
          <Summary label="Valor por sessão" value={custom && customAmountCents ? formatCents(customAmountCents) : 'Valor padrão'} />
        </div>
      </div>
      <p className="flex gap-2 rounded-xl bg-psi-soft/60 p-3 text-xs leading-relaxed text-psi-darkest"><Info className="mt-0.5 h-4 w-4 shrink-0" />O valor é exclusivo deste paciente e só será usado nos próximos agendamentos. Sessões e cobranças já criadas não mudam.</p>
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary w-full text-sm"><Save className="h-4 w-4" />{saving ? 'Salvando…' : 'Salvar alteração'}</button>
    </div>}
  </section>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p><p className="mt-0.5 font-bold text-ink">{value}</p></div>;
}
