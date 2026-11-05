import { normalizarModalidade } from './modalidade';

export interface HabilitacaoAtendimento {
  status: string;
  servicosHabilitados?: readonly string[];
  modalidadesAtendidas?: readonly string[];
}

export function servicesForRegistration(habilitacao: HabilitacaoAtendimento | null) {
  if (habilitacao?.status !== 'APROVADO') return [];
  const servicos = habilitacao.servicosHabilitados ?? [];
  return PATIENT_SERVICES.filter(([key]) => servicos.includes(key)
    || (key === 'PSICOTERAPIA_CASAL' && servicos.includes('PSICOTERAPIA')));
}

export function atendimentoPermitido(
  habilitacao: HabilitacaoAtendimento | null,
  servicoKey: string,
  modalidade: string,
): boolean {
  return modalitiesForService(servicoKey, habilitacao).some(([value]) => value === modalidade);
}

export const PATIENT_SERVICES = [
  ['PSICOTERAPIA', 'Psicoterapia Individual'],
  ['PSICOTERAPIA_CASAL', 'Psicoterapia de Casal'],
  ['AVALIACAO', 'Avaliação Psicológica e Neuropsicológica'],
  ['ORIENTACAO_PROFISSIONAL', 'Orientação Profissional/Vocacional'],
  ['ORIENTACAO_PARENTAL', 'Orientação Parental'],
] as const;
export const PATIENT_MODALITIES = [
  ['SOCIAL', 'Agendamento Acessível/Social'], ['PARTICULAR', 'Agendamento Particular'],
  ['CASAL_SOCIAL', 'Agendamento Acessível/Social (Casal)'], ['CASAL_PARTICULAR', 'Agendamento Particular (Casal)'],
  ['FAMILIA_SOCIAL', 'Agendamento Acessível/Social (Em família)'], ['FAMILIA_PARTICULAR', 'Agendamento Particular (Em família)'],
] as const;

export function serviceName(key: string): string {
  return PATIENT_SERVICES.find(([value]) => value === key)?.[1] ?? '';
}

export function modalitiesForService(serviceKey: string, habilitacao?: HabilitacaoAtendimento | null) {
  const opcoes = modalitiesOfService(serviceKey);
  if (habilitacao === undefined) return opcoes;
  if (!servicesForRegistration(habilitacao).some(([key]) => key === serviceKey)) return [];
  return opcoes.filter(([value]) => (habilitacao?.modalidadesAtendidas ?? [])
    .some((modalidade) => normalizarModalidade(modalidade) === normalizarModalidade(value)));
}

function modalitiesOfService(serviceKey: string) {
  if (serviceKey === 'PSICOTERAPIA_CASAL') {
    return PATIENT_MODALITIES.filter(([value]) => value.startsWith('CASAL_'));
  }
  if (serviceKey === 'ORIENTACAO_PARENTAL') {
    return [
      ['SOCIAL', 'Agendamento Acessível/Social (Individual)'],
      ['PARTICULAR', 'Agendamento Particular (Individual)'],
      ['FAMILIA_SOCIAL', 'Agendamento Acessível/Social (Em família)'],
      ['FAMILIA_PARTICULAR', 'Agendamento Particular (Em família)'],
    ] as const;
  }
  return PATIENT_MODALITIES.filter(([value]) => !value.startsWith('CASAL_') && !value.startsWith('FAMILIA_'));
}
