export type PatientManagementStatus = 'EM_TRIAGEM' | 'ATIVO' | 'ALTA' | 'DESISTENTE';
export type PatientSlaStatus = 'SEM_ALOCACAO' | 'ESTOURADO' | 'NO_PRAZO' | 'CONCLUIDO';

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
}

export interface ManagedPsychologist { id: string; nome: string; }
