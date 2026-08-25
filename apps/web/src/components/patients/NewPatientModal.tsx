'use client';

import { useEffect, useState } from 'react';
import { Save, UserPlus, X } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import { validateGender } from '@/lib/gender';
import { PatientRegistrationFields } from './PatientRegistrationFields';
import { EMPTY_PATIENT_REGISTRATION, serviceName, type PatientRegistrationForm } from './patientRegistration';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPatientCreated: () => void | Promise<void>;
}

export default function NewPatientModal({ isOpen, onClose, onPatientCreated }: Props) {
  const [form, setForm] = useState<PatientRegistrationForm>(EMPTY_PATIENT_REGISTRATION);
  const [temNomeSocial, setTemNomeSocial] = useState(false);
  const [convenios, setConvenios] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/convenios/publicos', { cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { convenios?: Array<{ nome?: string }> }) =>
        setConvenios((body.convenios ?? []).map((item) => item.nome?.trim() ?? '').filter(Boolean)))
      .catch(() => setConvenios([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => { if (!saving) onClose(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (form.whatsapp !== form.whatsappConfirmacao) return setError('Os números de telefone não coincidem.');
    if (!validateGender(form.genero, form.generoOutro)) return setError('Selecione o gênero e detalhe a opção “Outro”, se necessário.');
    if (!form.turno) return setError('Selecione o período de preferência.');

    setSaving(true);
    setError(null);
    try {
      await applicationRequest('/patients', {
        method: 'POST', headers: commandHeaders(),
        body: JSON.stringify({
          ...form,
          nomeSocial: temNomeSocial ? form.nomeSocial : undefined,
          paraQuemE: form.paraQuemE === 'Outro' ? `Outro: ${form.paraQuemEOutro.trim()}` : form.paraQuemE,
          displayName: temNomeSocial && form.nomeSocial.trim() ? form.nomeSocial : form.nome,
          legalName: form.nome,
          socialName: temNomeSocial ? form.nomeSocial : undefined,
          phone: form.whatsapp,
          birthDate: form.dataNascimento || undefined,
          professionalId: undefined,
          servico: serviceName(form.servicoKey),
          especificarNecessidades: false,
          necessidadesPaciente: [],
        }),
      });
      await onPatientCreated();
      setForm(EMPTY_PATIENT_REGISTRATION);
      setTemNomeSocial(false);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o paciente.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="new-patient-title">
    <div className="relative max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-line bg-surface p-4 shadow-2xl sm:rounded-3xl sm:p-6">
      <button type="button" aria-label="Fechar" onClick={close} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-canvas hover:text-ink"><X className="h-5 w-5" /></button>
      <div className="mb-5 flex items-center gap-3 border-b border-line pb-4 pr-12">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserPlus className="h-5 w-5" /></div>
        <div><h2 id="new-patient-title" className="text-base font-extrabold text-ink">Cadastrar novo paciente</h2><p className="text-xs text-muted">O paciente será vinculado automaticamente ao seu perfil.</p></div>
      </div>
      <form onSubmit={submit} className="space-y-5 text-xs">
        <PatientRegistrationFields form={form} setForm={setForm} convenios={convenios} temNomeSocial={temNomeSocial} onTemNomeSocialChange={(checked) => { setTemNomeSocial(checked); if (!checked) setForm((current) => ({ ...current, nomeSocial: '' })); }} />
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-semibold text-rose-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="btn-ghost min-h-11 justify-center" disabled={saving}>Cancelar</button><button type="submit" className="btn-primary min-h-11 justify-center" disabled={saving}><Save className="h-4 w-4" />{saving ? 'Salvando…' : 'Salvar paciente'}</button></div>
      </form>
    </div>
  </div>;
}
