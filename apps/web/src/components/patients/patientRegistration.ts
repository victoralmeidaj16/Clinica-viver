import type { GenderValue } from '@/lib/gender';
import type { TurnoPreferencia } from '@/lib/turnos';

export type PatientRegistrationForm = {
  nome: string; nomeSocial: string; whatsapp: string; whatsappConfirmacao: string;
  dataNascimento: string; idade: string; email: string; cpf: string; cep: string;
  numeroResidencia: string; logradouro: string; complemento: string; bairro: string; cidade: string; uf: string;
  possuiConvenio: 'SIM' | 'NAO'; convenioSelecionado: string; origem: string;
  turno: TurnoPreferencia | ''; paraQuemE: string; paraQuemEOutro: string;
  genero: GenderValue | ''; generoOutro: string; servicoKey: string; modalidade: string;
  opcaoAvaliacaoPsicologica: string;
  especificarNecessidades: boolean; necessidadesPaciente: string[]; necessidadesOutro: string;
  emergencyContactName: string; emergencyContactPhone: string; registrationNotes: string;
};

export const EMPTY_PATIENT_REGISTRATION: PatientRegistrationForm = {
  nome: '', nomeSocial: '', whatsapp: '', whatsappConfirmacao: '', dataNascimento: '',
  idade: '', email: '', cpf: '', cep: '', numeroResidencia: '', logradouro: '', complemento: '', bairro: '', cidade: '', uf: '',
  possuiConvenio: 'NAO', convenioSelecionado: '', origem: 'Indicação', turno: '', paraQuemE: '',
  paraQuemEOutro: '', genero: '', generoOutro: '',
  servicoKey: '', modalidade: '', opcaoAvaliacaoPsicologica: '',
  especificarNecessidades: false, necessidadesPaciente: [], necessidadesOutro: '',
  emergencyContactName: '', emergencyContactPhone: '', registrationNotes: '',
};

/** O que o ViaCEP devolve e a tela mostra para conferência. */
export interface EnderecoDoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export const ENDERECO_VAZIO: EnderecoDoCep = { logradouro: '', bairro: '', cidade: '', uf: '' };

/** Endereço a partir do CEP, enviado ao cadastro clínico e à triagem manual. */
export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoDoCep | null> {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    if ('ok' in resposta && !resposta.ok) return null;
    const dados = (await resposta.json()) as {
      erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string;
    };
    if (dados.erro) return null;
    return {
      logradouro: dados.logradouro ?? '',
      bairro: dados.bairro ?? '',
      cidade: dados.localidade ?? '',
      uf: dados.uf ?? '',
    };
  } catch {
    return null;
  }
}

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
  if (serviceKey === 'AVALIACAO') {
    return ['Criança', 'Adolescente', 'Homem', 'Mulher', 'Idoso'] as const;
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
