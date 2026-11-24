import { publicoAlvoCompativel } from '@thats-life/core';
import { normalizarModalidade } from './modalidade';

export interface HabilitacaoAtendimento {
  status: string;
  servicosHabilitados?: readonly string[];
  modalidadesAtendidas?: readonly string[];
  publicoAlvo?: readonly string[];
}

export function servicesForRegistration(habilitacao: HabilitacaoAtendimento | null) {
  if (habilitacao?.status !== 'APROVADO') return [];
  const servicos = habilitacao.servicosHabilitados ?? [];
  return PATIENT_SERVICES.filter(([key]) => servicos.includes(key)
    || (key === 'PSICOTERAPIA_CASAL' && servicos.includes('PSICOTERAPIA')));
}

export function publicoPermitido(
  habilitacao: HabilitacaoAtendimento | null,
  servicoKey: string,
  modalidade: string,
  paraQuemE?: string | null,
): boolean {
  if (habilitacao?.status !== 'APROVADO') return false;
  if (!habilitacao.publicoAlvo?.length) return true;
  if (paraQuemE?.trim() && !publicoAlvoCompativel(habilitacao.publicoAlvo, paraQuemE)) return false;
  if (servicoKey === 'PSICOTERAPIA_CASAL' && !publicoAlvoCompativel(habilitacao.publicoAlvo, 'Casal')) {
    return false;
  }
  if (modalidade.startsWith('FAMILIA_') && !publicoAlvoCompativel(habilitacao.publicoAlvo, 'Família')) {
    return false;
  }
  return true;
}

export function atendimentoPermitido(
  habilitacao: HabilitacaoAtendimento | null,
  servicoKey: string,
  modalidade: string,
  paraQuemE?: string | null,
): boolean {
  return (
    modalitiesForService(servicoKey, habilitacao).some(([value]) => value === modalidade) &&
    publicoPermitido(habilitacao, servicoKey, modalidade, paraQuemE)
  );
}

export const PATIENT_SERVICES = [
  ['PSICOTERAPIA', 'Psicoterapia Individual'],
  ['PSICOTERAPIA_CASAL', 'Psicoterapia de Casal'],
  ['AVALIACAO', 'Avaliação Psicológica e Neuropsicológica'],
  ['ORIENTACAO_VOCACIONAL', 'Orientação Vocacional'],
  ['ORIENTACAO_PROFISSIONAL', 'Orientação Profissional'],
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
