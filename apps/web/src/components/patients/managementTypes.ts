import type { MotivoDesistencia } from '@/lib/desistencias';

export type PatientManagementStatus = 'EM_TRIAGEM' | 'ATIVO' | 'ALTA' | 'DESISTENTE';
export type PatientSlaStatus = 'SEM_ALOCACAO' | 'ESTOURADO' | 'NO_PRAZO' | 'CONCLUIDO';

/** Auditoria da saída daquele paciente, quando existe. */
export interface PatientDropout {
  id: string;
  motivo: MotivoDesistencia;
  descricaoDetalhada?: string;
  acaoSugestao?: string;
  dataDesistencia: string;
  reengajado: boolean;
  observacoesReengajamento?: string;
  permitirTrocaPsicologo?: boolean;
}

export interface ManagedPatient {
  id: string;
  patientId?: string;
  leadId?: string;
  protocolo?: string;
  nome: string;
  whatsapp?: string;
  email?: string;
  cpf?: string;
  idade?: string;
  cep?: string;
  numeroResidencia?: string;
  servicoKey?: string;
  servicoNome?: string;
  modalidade?: string;
  /** `'Sim'`/`'Não'` como veio do formulário público, não booleano. */
  possuiConvenio?: string;
  /** `'Nenhum'` quando a pessoa chegou sem convênio — é o default da triagem. */
  convenioSelecionado?: string;
  convenioId?: string;
  convenioNome?: string;
  custeioConfigurado?: boolean;
  custeadoPelaEmpresa?: boolean;
  paraQuemE?: string;
  turno?: string;
  necessidadesPaciente?: readonly string[];
  necessidadesOutro?: string;
  opcaoAvaliacaoPsicologica?: string;
  psicologoId?: string;
  psicologoNome?: string;
  status: PatientManagementStatus;
  criadoEm?: string;
  confirmadoEm?: string;
  horasEspera: number;
  slaStatus: PatientSlaStatus;
  agenda: { total: number; realizadas: number; proximaEm?: string };
  financeiro: { cobrancas: number; totalCentavos: number; emAbertoCentavos: number };
  desistencia?: PatientDropout;
}

export interface ManagedPsychologist { id: string; nome: string; }
export interface ManagedConvenio { id: string; nome: string; empresaPagaSessoes: boolean; }
