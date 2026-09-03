'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Save, ShieldCheck, UserRoundPen, X } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import type { PatientRegistrationRecord } from '@/lib/patientRegistrationDetails';
import { buscarEnderecoPorCep, maskCep, maskCpf, maskPhone, validCpf } from './patientRegistration';

interface Props {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSaved: (patient: PatientRegistrationRecord) => void | Promise<void>;
}

type Form = {
  legalName: string; socialName: string; phone: string; email: string; cpf: string;
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; uf: string; emergencyContactName: string;
  emergencyContactPhone: string; registrationNotes: string;
};

const EMPTY: Form = { legalName: '', socialName: '', phone: '', email: '', cpf: '', cep: '',
  logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  emergencyContactName: '', emergencyContactPhone: '', registrationNotes: '' };

function fromRecord(value: PatientRegistrationRecord): Form {
  return { legalName: value.legalName, socialName: value.socialName ?? '', phone: maskPhone(value.phone),
    email: value.email, cpf: maskCpf(value.cpf), cep: maskCep(value.address.cep),
    logradouro: value.address.logradouro, numero: value.address.numero,
    complemento: value.address.complemento ?? '', bairro: value.address.bairro,
    cidade: value.address.cidade, uf: value.address.uf,
    emergencyContactName: value.emergencyContactName ?? '',
    emergencyContactPhone: maskPhone(value.emergencyContactPhone ?? ''),
    registrationNotes: value.registrationNotes ?? '' };
}

export default function EditPatientModal({ patientId, patientName, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [record, setRecord] = useState<PatientRegistrationRecord>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'found' | 'manual'>('idle');
  const [error, setError] = useState<string>();
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    applicationRequest<PatientRegistrationRecord>(`/patients/${encodeURIComponent(patientId)}`)
      .then((value) => { if (active) { setRecord(value); setForm(fromRecord(value)); } })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o cadastro.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [patientId]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const changeCep = async (value: string) => {
    const cep = maskCep(value);
    update('cep', cep);
    if (cep.replace(/\D/g, '').length !== 8) { requestId.current += 1; setCepStatus('idle'); return; }
    const currentRequest = ++requestId.current;
    setCepStatus('loading');
    const address = await buscarEnderecoPorCep(cep);
    if (currentRequest !== requestId.current) return;
    if (!address) { setCepStatus('manual'); return; }
    setForm((current) => ({ ...current, logradouro: address.logradouro, bairro: address.bairro,
      cidade: address.cidade, uf: address.uf }));
    setCepStatus('found');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validCpf(form.cpf)) {
      setError('Informe um CPF válido.');
      return;
    }
    setSaving(true); setError(undefined);
    try {
      const updated = await applicationRequest<PatientRegistrationRecord>(`/patients/${encodeURIComponent(patientId)}`, {
        method: 'PATCH', headers: commandHeaders(), body: JSON.stringify({
          legalName: form.legalName, socialName: form.socialName, phone: form.phone,
          email: form.email, cpf: form.cpf,
          address: { cep: form.cep, logradouro: form.logradouro, numero: form.numero,
            complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, uf: form.uf },
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          registrationNotes: form.registrationNotes,
        }),
      });
      await onSaved(updated); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o cadastro.'); }
    finally { setSaving(false); }
  };

  const input = 'input mt-1 text-xs';
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-psi-darkest/70 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title">
    <section className="max-h-[96dvh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] border border-line bg-surface shadow-2xl sm:rounded-[2rem]">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-psi-darkest px-5 py-5 text-white sm:px-7">
        <div className="flex gap-3"><span className="rounded-2xl bg-psi-vibrant p-3"><UserRoundPen className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Cadastro protegido</p><h2 id="edit-patient-title" className="text-lg font-black">Editar dados de {patientName}</h2></div></div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </header>
      {loading ? <div className="flex items-center justify-center gap-2 p-16 text-xs font-bold text-muted"><Loader2 className="h-5 w-5 animate-spin" /> Carregando cadastro…</div> :
      <form onSubmit={submit} className="space-y-5 p-5 text-xs sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="font-bold text-ink">Nome completo *<input required className={input} value={form.legalName} onChange={(e) => update('legalName', e.target.value)} /></label>
          <label className="font-bold text-ink">Nome social<input className={input} value={form.socialName} onChange={(e) => update('socialName', e.target.value)} /></label>
          <label className="font-bold text-ink">WhatsApp / telefone *<input required className={input} value={form.phone} onChange={(e) => update('phone', maskPhone(e.target.value))} /></label>
          <label className="font-bold text-ink">E-mail *<input required type="email" className={input} value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
          <label className="font-bold text-ink">CPF *<input required maxLength={14} className={`${input} ${form.cpf.length === 14 && !validCpf(form.cpf) ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-600' : ''}`} value={form.cpf} onChange={(e) => update('cpf', maskCpf(e.target.value))} /></label>
        </div>
        <fieldset className="space-y-3 rounded-2xl border border-psi-soft bg-psi-light/40 p-4"><legend className="px-2 font-black text-psi-deep"><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Endereço completo</span></legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="font-bold text-ink">CEP *<input required className={input} value={form.cep} onChange={(e) => void changeCep(e.target.value)} /></label>
            <label className="font-bold text-ink sm:col-span-2">Rua / logradouro *<input required className={input} value={form.logradouro} onChange={(e) => update('logradouro', e.target.value)} /></label>
            <label className="font-bold text-ink">Número *<input required className={input} value={form.numero} onChange={(e) => update('numero', e.target.value)} /></label>
            <label className="font-bold text-ink">Complemento<input className={input} value={form.complemento} onChange={(e) => update('complemento', e.target.value)} /></label>
            <label className="font-bold text-ink">Bairro *<input required className={input} value={form.bairro} onChange={(e) => update('bairro', e.target.value)} /></label>
            <label className="font-bold text-ink sm:col-span-2">Cidade *<input required className={input} value={form.cidade} onChange={(e) => update('cidade', e.target.value)} /></label>
            <label className="font-bold text-ink">UF *<input required maxLength={2} className={input} value={form.uf} onChange={(e) => update('uf', e.target.value.replace(/[^a-z]/gi, '').toUpperCase())} /></label>
          </div>
          {cepStatus === 'loading' && <p className="font-semibold text-muted">Consultando CEP…</p>}
          {cepStatus === 'manual' && <p className="font-semibold text-amber-700">CEP não localizado. Preencha o endereço manualmente.</p>}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="font-bold text-ink">Contato de emergência<input className={input} value={form.emergencyContactName} onChange={(e) => update('emergencyContactName', e.target.value)} /></label>
          <label className="font-bold text-ink">Telefone de emergência<input className={input} value={form.emergencyContactPhone} onChange={(e) => update('emergencyContactPhone', maskPhone(e.target.value))} /></label>
        </div>
        <label className="block font-bold text-ink">Observações cadastrais<textarea rows={3} className={input} value={form.registrationNotes} onChange={(e) => update('registrationNotes', e.target.value)} /></label>
        {record?.lastRegistrationUpdate && <p className="flex items-center gap-2 rounded-xl border border-line bg-canvas p-3 text-[11px] text-muted"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Última alteração por {record.lastRegistrationUpdate.actorDisplayName ?? record.lastRegistrationUpdate.actorUserId}, em {new Date(record.lastRegistrationUpdate.updatedAt).toLocaleString('pt-BR')}.</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="btn-outline justify-center">Cancelar</button><button type="submit" disabled={saving} className="btn-primary justify-center"><Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
      </form>}
    </section>
  </div>;
}
