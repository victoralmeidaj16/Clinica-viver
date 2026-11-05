import type { Dispatch, SetStateAction } from 'react';
import type { GenderValue } from '@/lib/gender';
import type { AcessibilidadePsicologo } from '@/lib/psychologistAccessibility';
import { POS_GRADUACOES_VIVER_MAIS } from './opcoesPsicologo';

export const CADASTRO_PSICOLOGO_INICIAL = {
    nomeCompleto: '',
    nomeSocial: '',
    crp: '',
    whatsapp: '',
    email: '',
    fotoUrl: '',
    acessibilidade: undefined as AcessibilidadePsicologo | undefined,
    modalidadeAtendimento: 'ONLINE',
    atendimentoPreferencia: 'AMBOS' as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
    estadoUf: '',
    cidade: '',
    logradouro: '',
    bairro: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
    turmaViverMais: '22A',
    posGraduacaoViverMais: POS_GRADUACOES_VIVER_MAIS[0],
    servicosPrestados: ['Atendimento Psicológico'] as string[],
    temposAtendimento: [50] as number[],
    publicoAlvo: ['Homens'] as string[],
    publicoAlvoOutro: '',
    especificarNecessidades: false,
    necessidadesAtendidas: [] as string[],
    especialidade: '',
    minibio: '',
    disponibilidadeTurnos: [] as string[],
  };

export type CadastroPsicologoFormState = typeof CADASTRO_PSICOLOGO_INICIAL;
export interface CamposCadastroPsicologoProps {
  formPsicologo: CadastroPsicologoFormState;
  setFormPsicologo: Dispatch<SetStateAction<CadastroPsicologoFormState>>;
}
