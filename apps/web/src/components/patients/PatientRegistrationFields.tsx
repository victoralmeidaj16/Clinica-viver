'use client';

import { GenderFields } from '@/components/forms/GenderFields';
import { TurnoPreferenceField } from '@/components/forms/TurnoPreferenceField';
import { OPCOES_AVALIACAO_PSICOLOGICA } from '@/components/forms/necessidades';
import { PATIENT_AUDIENCES, PATIENT_ORIGINS, PATIENT_SERVICES, maskCep, maskCpf, maskPhone, modalitiesForService, type PatientRegistrationForm } from './patientRegistration';

interface Props {
  form: PatientRegistrationForm;
  setForm: React.Dispatch<React.SetStateAction<PatientRegistrationForm>>;
  convenios: readonly string[];
  temNomeSocial: boolean;
  onTemNomeSocialChange: (value: boolean) => void;
}

const field = 'input';

export function PatientRegistrationFields({ form, setForm, convenios, temNomeSocial, onTemNomeSocialChange }: Props) {
  const update = <K extends keyof PatientRegistrationForm>(key: K, value: PatientRegistrationForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block font-bold text-ink">Serviço *</label><select className={field} required value={form.servicoKey} onChange={(e) => setForm((current) => ({ ...current, servicoKey: e.target.value, modalidade: '', opcaoAvaliacaoPsicologica: '', paraQuemE: e.target.value === 'ORIENTACAO_PARENTAL' ? '' : current.paraQuemE }))}><option value="">Selecione</option>{PATIENT_SERVICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="mb-1 block font-bold text-ink">Modalidade *</label><select className={field} required disabled={!form.servicoKey} value={form.modalidade} onChange={(e) => update('modalidade', e.target.value)}><option value="">Selecione</option>{modalitiesForService(form.servicoKey).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </div>
    <div>
      <label className="mb-1 block font-bold text-ink">Nome completo *</label>
      <input className={field} required value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Nome completo" />
      <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold text-ink"><input type="checkbox" checked={temNomeSocial} onChange={(e) => onTemNomeSocialChange(e.target.checked)} className="h-4 w-4 accent-primary" />Possui nome social?</label>
    </div>
    {form.servicoKey === 'AVALIACAO' && <div><label className="mb-1 block font-bold text-ink">Objetivo da avaliação psicológica *</label><select className={field} required value={form.opcaoAvaliacaoPsicologica} onChange={(e) => update('opcaoAvaliacaoPsicologica', e.target.value)}><option value="">Selecione</option>{OPCOES_AVALIACAO_PSICOLOGICA.map((item) => <option key={item}>{item}</option>)}</select></div>}
    {temNomeSocial && <div><label className="mb-1 block font-bold text-ink">Nome social <span className="font-normal text-muted">(como prefere ser chamado)</span></label><input className={field} value={form.nomeSocial} onChange={(e) => update('nomeSocial', e.target.value)} placeholder="Digite o nome social" /></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block font-bold text-ink">Telefone *</label><input className={field} required value={form.whatsapp} onChange={(e) => update('whatsapp', maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></div>
      <div><label className="mb-1 block font-bold text-ink">Confirme o telefone *</label><input className={field} required value={form.whatsappConfirmacao} onChange={(e) => update('whatsappConfirmacao', maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block font-bold text-ink">Data de nascimento <span className="font-normal text-muted">(opcional)</span></label><input type="date" className={field} value={form.dataNascimento} onChange={(e) => update('dataNascimento', e.target.value)} /></div>
      <div><label className="mb-1 block font-bold text-ink">E-mail *</label><input type="email" className={field} required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="paciente@email.com" /></div>
    </div>
    <GenderFields idPrefix="cadastro-interno-paciente" gender={form.genero} other={form.generoOutro} onGenderChange={(value) => update('genero', value)} onOtherChange={(value) => update('generoOutro', value)} />
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="mb-1 block font-bold text-ink">CPF *</label><input className={field} required value={form.cpf} onChange={(e) => update('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" /></div>
      <div><label className="mb-1 block font-bold text-ink">CEP *</label><input className={field} required value={form.cep} onChange={(e) => update('cep', maskCep(e.target.value))} placeholder="00000-000" /></div>
      <div><label className="mb-1 block font-bold text-ink">Nº residência *</label><input className={field} required value={form.numeroResidencia} onChange={(e) => update('numeroResidencia', e.target.value)} placeholder="123 ou Apto 4" /></div>
    </div>
    <fieldset><legend className="mb-2 font-bold text-ink">Conveniado com empresa parceira? *</legend><div className="flex gap-5">{(['SIM', 'NAO'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name="possuiConvenioInterno" checked={form.possuiConvenio === value} onChange={() => setForm((current) => ({ ...current, possuiConvenio: value, convenioSelecionado: value === 'NAO' ? '' : current.convenioSelecionado }))} className="accent-primary" />{value === 'SIM' ? 'Sim' : 'Não'}</label>)}</div></fieldset>
    {form.possuiConvenio === 'SIM' && <div><label className="mb-1 block font-bold text-ink">Selecione o convênio *</label>{convenios.length ? <select className={field} required value={form.convenioSelecionado} onChange={(e) => update('convenioSelecionado', e.target.value)}><option value="">Selecione</option>{convenios.map((item) => <option key={item}>{item}</option>)}</select> : <input className={field} required value={form.convenioSelecionado} onChange={(e) => update('convenioSelecionado', e.target.value)} placeholder="Nome da empresa" />}</div>}
    {form.servicoKey !== 'ORIENTACAO_PARENTAL' && <div>
      <label className="mb-2 block font-bold text-ink">Para quem é o atendimento? <span className="font-normal text-muted">(opcional)</span></label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{PATIENT_AUDIENCES.map((item) => <button key={item} type="button" onClick={() => update('paraQuemE', form.paraQuemE === item ? '' : item)} className={`rounded-xl border p-2.5 text-left font-semibold transition ${form.paraQuemE === item ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-white text-ink hover:bg-canvas'}`}>{item}</button>)}</div>
      {form.paraQuemE === 'Outro' && <input className={`${field} mt-2`} required value={form.paraQuemEOutro} onChange={(e) => update('paraQuemEOutro', e.target.value)} placeholder="Especifique para quem é o atendimento" />}
    </div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block font-bold text-ink">Como conheceu a clínica? *</label><select className={field} value={form.origem} onChange={(e) => update('origem', e.target.value)}>{PATIENT_ORIGINS.map((item) => <option key={item}>{item}</option>)}</select></div>
      <TurnoPreferenceField value={form.turno} onChange={(value) => update('turno', value)} />
    </div>
  </div>;
}
