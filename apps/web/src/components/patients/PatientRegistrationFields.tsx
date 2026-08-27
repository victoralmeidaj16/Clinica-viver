'use client';

import { useRef, useState } from 'react';
import { GenderFields } from '@/components/forms/GenderFields';
import { TurnoPreferenceField } from '@/components/forms/TurnoPreferenceField';
import { NecessidadesSelector, OPCOES_AVALIACAO_PSICOLOGICA } from '@/components/forms/necessidades';
import { audiencesForService, buscarEnderecoPorCep, PATIENT_ORIGINS, PATIENT_SERVICES, maskCep, maskCpf, maskPhone, modalitiesForService, type PatientRegistrationForm } from './patientRegistration';

interface Props {
  form: PatientRegistrationForm;
  setForm: React.Dispatch<React.SetStateAction<PatientRegistrationForm>>;
  convenios: readonly string[];
  /** A lista ainda está sendo buscada: o select existe, mas não dá para escolher. */
  conveniosCarregando: boolean;
  /** A busca falhou ou voltou vazia — só aí o campo aceita texto livre. */
  conveniosIndisponiveis: boolean;
  temNomeSocial: boolean;
  onTemNomeSocialChange: (value: boolean) => void;
}

const field = 'input';

export function PatientRegistrationFields({ form, setForm, convenios, conveniosCarregando, conveniosIndisponiveis, temNomeSocial, onTemNomeSocialChange }: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepConsultado, setCepConsultado] = useState(false);
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false);
  const cepRequest = useRef(0);

  const update = <K extends keyof PatientRegistrationForm>(key: K, value: PatientRegistrationForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /**
   * O endereço aparece assim que o CEP fecha oito dígitos.
   *
   * Só CEP e número chegam ao servidor: rua, bairro e cidade servem para quem
   * está digitando conferir que não trocou um dígito — um CEP errado passa
   * despercebido até alguém precisar do endereço.
   */
  const handleCepChange = async (valor: string) => {
    const mascarado = maskCep(valor);
    update('cep', mascarado);
    if (mascarado.replace(/\D/g, '').length !== 8) {
      cepRequest.current += 1;
      setBuscandoCep(false);
      setCepConsultado(false);
      setCepNaoEncontrado(false);
      return;
    }
    const requestId = ++cepRequest.current;
    setBuscandoCep(true);
    const encontrado = await buscarEnderecoPorCep(mascarado);
    if (requestId !== cepRequest.current) return;
    setForm((current) => ({
      ...current,
      logradouro: encontrado?.logradouro ?? '', bairro: encontrado?.bairro ?? '',
      cidade: encontrado?.cidade ?? '', uf: encontrado?.uf ?? '',
    }));
    setCepConsultado(true);
    setCepNaoEncontrado(!encontrado);
    setBuscandoCep(false);
  };

  const handleServiceChange = (serviceKey: string) => {
    setForm((current) => {
      let paraQuemE = current.paraQuemE;
      if (serviceKey === 'ORIENTACAO_PARENTAL') {
        paraQuemE = '';
      } else if (serviceKey === 'PSICOTERAPIA_CASAL') {
        if (paraQuemE !== 'Casal' && paraQuemE !== 'Outro') {
          paraQuemE = 'Casal';
        }
      } else if (!audiencesForService(serviceKey).includes(paraQuemE)) {
        paraQuemE = '';
      }
      return {
        ...current,
        servicoKey: serviceKey,
        modalidade: '',
        opcaoAvaliacaoPsicologica: '',
        paraQuemE,
      };
    });
  };

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block font-bold text-ink">Serviço *</label><select className={field} required value={form.servicoKey} onChange={(e) => handleServiceChange(e.target.value)}><option value="">Selecione</option>{PATIENT_SERVICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
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
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="mb-1 block font-bold text-ink">Data de nascimento <span className="font-normal text-muted">(opcional)</span></label><input type="date" className={field} value={form.dataNascimento} onChange={(e) => update('dataNascimento', e.target.value)} /></div>
      <div><label className="mb-1 block font-bold text-ink">Idade <span className="font-normal text-muted">(opcional)</span></label><input inputMode="numeric" className={field} value={form.idade} onChange={(e) => update('idade', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Ex: 34" /></div>
      <div><label className="mb-1 block font-bold text-ink">E-mail *</label><input type="email" className={field} required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="paciente@email.com" /></div>
    </div>
    <GenderFields idPrefix="cadastro-interno-paciente" gender={form.genero} other={form.generoOutro} onGenderChange={(value) => update('genero', value)} onOtherChange={(value) => update('generoOutro', value)} />
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="mb-1 block font-bold text-ink">CPF *</label><input className={field} required value={form.cpf} onChange={(e) => update('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" /></div>
      <div>
        <label className="mb-1 block font-bold text-ink">CEP *</label>
        <input className={field} required value={form.cep} onChange={(e) => void handleCepChange(e.target.value)} placeholder="00000-000" />
        {buscandoCep && <p className="mt-1 text-[11px] font-semibold text-muted">Buscando endereço…</p>}
      </div>
      <div><label className="mb-1 block font-bold text-ink">Nº residência *</label><input className={field} required value={form.numeroResidencia} onChange={(e) => update('numeroResidencia', e.target.value)} placeholder="123 ou Apto 4" /></div>
    </div>
    {cepConsultado && <div className="space-y-3 rounded-xl border border-line bg-canvas p-3">
      <div>
        <p className="font-bold text-ink">Endereço do paciente</p>
        <p className={`mt-0.5 text-[11px] font-semibold ${cepNaoEncontrado ? 'text-amber-700' : 'text-muted'}`}>
          {cepNaoEncontrado ? 'Não foi possível localizar o CEP. Preencha todos os campos manualmente.' : 'Confira os dados preenchidos automaticamente antes de salvar.'}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="mb-1 block font-bold text-ink">Rua / logradouro *</label><input className={field} required value={form.logradouro} onChange={(e) => update('logradouro', e.target.value)} placeholder="Nome da rua" /></div>
        <div><label className="mb-1 block font-bold text-ink">Bairro *</label><input className={field} required value={form.bairro} onChange={(e) => update('bairro', e.target.value)} /></div>
        <div><label className="mb-1 block font-bold text-ink">Complemento <span className="font-normal text-muted">(opcional)</span></label><input className={field} value={form.complemento} onChange={(e) => update('complemento', e.target.value)} placeholder="Apto, bloco…" /></div>
        <div><label className="mb-1 block font-bold text-ink">Cidade *</label><input className={field} required value={form.cidade} onChange={(e) => update('cidade', e.target.value)} /></div>
        <div><label className="mb-1 block font-bold text-ink">Estado (UF) *</label><input className={field} required maxLength={2} value={form.uf} onChange={(e) => update('uf', e.target.value.replace(/[^a-z]/gi, '').toUpperCase())} placeholder="SP" /></div>
      </div>
    </div>}
    <fieldset><legend className="mb-2 font-bold text-ink">Conveniado com empresa parceira? *</legend><div className="flex gap-5">{(['SIM', 'NAO'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name="possuiConvenioInterno" checked={form.possuiConvenio === value} onChange={() => setForm((current) => ({ ...current, possuiConvenio: value, convenioSelecionado: value === 'NAO' ? '' : current.convenioSelecionado }))} className="accent-primary" />{value === 'SIM' ? 'Sim' : 'Não'}</label>)}</div></fieldset>
    {/*
      O convênio é escolhido da lista de empresas parceiras, como na vitrine.
      O texto livre só aparece quando a lista realmente não veio: antes, o
      campo caía em `input` enquanto a busca estava em andamento, e quem
      cadastrava digitava o nome da empresa à mão sem saber que havia lista —
      gerando um nome que não casa com nenhum convênio no faturamento.
    */}
    {form.possuiConvenio === 'SIM' && <div>
      <label className="mb-1 block font-bold text-ink">Selecione o convênio *</label>
      {conveniosIndisponiveis ? <>
        <input className={field} required value={form.convenioSelecionado} onChange={(e) => update('convenioSelecionado', e.target.value)} placeholder="Nome da empresa" />
        <p className="mt-1 text-[11px] font-semibold text-amber-700">A lista de convênios não carregou. Informe a empresa pelo nome — confira a grafia, porque ela não será casada automaticamente com o cadastro do convênio.</p>
      </> : <select className={field} required={!conveniosCarregando} disabled={conveniosCarregando} value={form.convenioSelecionado} onChange={(e) => update('convenioSelecionado', e.target.value)}>
        <option value="">{conveniosCarregando ? 'Carregando convênios…' : 'Selecione'}</option>
        {convenios.map((item) => <option key={item}>{item}</option>)}
      </select>}
    </div>}
    {form.servicoKey !== 'ORIENTACAO_PARENTAL' && <div>
      <label className="mb-2 block font-bold text-ink">Para quem é o atendimento? <span className="font-normal text-muted">(opcional)</span></label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{audiencesForService(form.servicoKey).map((item) => <button key={item} type="button" onClick={() => update('paraQuemE', form.paraQuemE === item ? '' : item)} className={`rounded-xl border p-2.5 text-left font-semibold transition ${form.paraQuemE === item ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-white text-ink hover:bg-canvas'}`}>{item}</button>)}</div>

      {form.paraQuemE === 'Outro' && <input className={`${field} mt-2`} required value={form.paraQuemEOutro} onChange={(e) => update('paraQuemEOutro', e.target.value)} placeholder="Especifique para quem é o atendimento" />}
    </div>}
    {/*
      As necessidades vinham fixas como "não especificadas" no cadastro
      interno: o psicólogo preenchia o formulário inteiro e o campo que a
      vitrine usa como filtro chegava vazio ao servidor, sem nenhum lugar na
      tela onde pudesse ser informado.
    */}
    <NecessidadesSelector
      prefix="cadastro-interno-paciente"
      titulo="Deseja especificar a necessidade do paciente?"
      subtitulo="Usado como filtro. Selecione uma ou mais."
      especificar={form.especificarNecessidades}
      onEspecificarChange={(value) => setForm((current) => ({
        ...current,
        especificarNecessidades: value,
        necessidadesPaciente: value ? current.necessidadesPaciente : [],
        necessidadesOutro: value ? current.necessidadesOutro : '',
      }))}
      selecionados={form.necessidadesPaciente}
      onSelecionadosChange={(lista) => update('necessidadesPaciente', lista)}
      outro={form.necessidadesOutro}
      onOutroChange={(value) => update('necessidadesOutro', value)}
    />
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block font-bold text-ink">Contato de emergência <span className="font-normal text-muted">(opcional)</span></label><input className={field} value={form.emergencyContactName} onChange={(e) => update('emergencyContactName', e.target.value)} placeholder="Nome e vínculo" /></div>
      <div><label className="mb-1 block font-bold text-ink">Telefone de emergência <span className="font-normal text-muted">(opcional)</span></label><input className={field} value={form.emergencyContactPhone} onChange={(e) => update('emergencyContactPhone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></div>
    </div>
    <div><label className="mb-1 block font-bold text-ink">Observações cadastrais <span className="font-normal text-muted">(opcional)</span></label><textarea className={field} rows={3} value={form.registrationNotes} onChange={(e) => update('registrationNotes', e.target.value)} placeholder="Informações administrativas; não use este campo para evolução clínica." /></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block font-bold text-ink">Como conheceu a clínica? *</label><select className={field} value={form.origem} onChange={(e) => update('origem', e.target.value)}>{PATIENT_ORIGINS.map((item) => <option key={item}>{item}</option>)}</select></div>
      <TurnoPreferenceField value={form.turno} onChange={(value) => update('turno', value)} />
    </div>
  </div>;
}
