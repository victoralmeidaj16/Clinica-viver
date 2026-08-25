import type { GenderValue } from '@/lib/gender';
import type { TurnoPreferencia } from '@/lib/turnos';

export type PatientRegistrationForm = {
  nome: string; nomeSocial: string; whatsapp: string; whatsappConfirmacao: string;
  dataNascimento: string; email: string; cpf: string; cep: string; numeroResidencia: string;
  possuiConvenio: 'SIM' | 'NAO'; convenioSelecionado: string; origem: string;
  turno: TurnoPreferencia | ''; paraQuemE: string; paraQuemEOutro: string;
  genero: GenderValue | ''; generoOutro: string; servicoKey: string; modalidade: string;
  opcaoAvaliacaoPsicologica: string;
};

export const EMPTY_PATIENT_REGISTRATION: PatientRegistrationForm = {
  nome: '', nomeSocial: '', whatsapp: '', whatsappConfirmacao: '', dataNascimento: '',
  email: '', cpf: '', cep: '', numeroResidencia: '', possuiConvenio: 'NAO',
  convenioSelecionado: '', origem: 'Indicação', turno: '', paraQuemE: '',
  paraQuemEOutro: '', genero: '', generoOutro: '',
  servicoKey: '', modalidade: '', opcaoAvaliacaoPsicologica: '',
};

export const PATIENT_AUDIENCES = ['Criança', 'Adolescente', 'Homem', 'Mulher', 'Idoso', 'Casal', 'Família', 'Grupo', 'Outro'] as const;
export const PATIENT_ORIGINS = ['Facebook', 'Instagram', 'Google', 'Whatsapp', 'Sou aluno', 'Conveniado', 'Indicação', 'Outros'] as const;
export const PATIENT_SERVICES = [
  ['PSICOTERAPIA', 'Psicoterapia Individual'],
  ['PSICOTERAPIA_CASAL', 'Psicoterapia de Casal'],
  ['AVALIACAO', 'Avaliação Psicológica e Neuropsicológica'],
  ['ORIENTACAO_PROFISSIONAL', 'Orientação Profissional/Vocacional'],
  ['ORIENTACAO_PARENTAL', 'Orientação Parental'],
] as const;
export const PATIENT_MODALITIES = [
  ['SOCIAL', 'Agendamento Acessível'], ['PARTICULAR', 'Agendamento Particular'],
  ['CASAL_SOCIAL', 'Agendamento Acessível (Casal)'], ['CASAL_PARTICULAR', 'Agendamento Particular (Casal)'],
] as const;

export function serviceName(key: string): string {
  return PATIENT_SERVICES.find(([value]) => value === key)?.[1] ?? '';
}

export function modalitiesForService(serviceKey: string) {
  const casal = serviceKey === 'PSICOTERAPIA_CASAL';
  return PATIENT_MODALITIES.filter(([value]) => value.startsWith('CASAL_') === casal);
}

export function audiencesForService(serviceKey?: string | null): readonly string[] {
  if (serviceKey === 'PSICOTERAPIA_CASAL') {
    return ['Casal', 'Outro'] as const;
  }
  return ['Criança', 'Adolescente', 'Homem', 'Mulher', 'Idoso', 'Outro'] as const;
}


export function maskPhone(value: string): string {
  return value.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);
}
export function maskCpf(value: string): string {
  return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
}
export function maskCep(value: string): string {
  return value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
}
