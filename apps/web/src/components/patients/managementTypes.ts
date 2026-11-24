import type { MotivoDesistencia } from '@/lib/desistencias';
import type { CusteioCiclo } from '@/lib/convenioBilling';
import type { ListaEsperaRegistro } from '@/lib/listaEspera';
import type { InativacaoVinculo } from '@/lib/inativacaoVinculo';
import type { AlteracaoPreferencias, PreferenciasSolicitacao } from '@/lib/preferenciasSolicitacao';
import type { ResponsavelFinanceiro } from '@/lib/responsavelFinanceiro';
import type { VinculoColetivo } from '@/lib/vinculoColetivo';

export type PatientManagementStatus = 'EM_TRIAGEM' | 'ATIVO' | 'ALTA' | 'DESISTENTE' | 'INATIVO';
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
  registradoPorPerfil?: 'PSICOLOGO' | 'GESTAO';
}

export interface CpfHistoryEntry {
  leadId: string;
  protocolo: string;
  criadoEm: string;
  status: string;
  servico?: string;
  modalidade?: string;
  psicologoNome?: string;
  atual: boolean;
}

export interface LeadRefusalEntry {
  psicologoId: string;
  psicologoNome?: string;
  recusadoEm: string;
  motivo?: string;
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
  /** Quem paga a **próxima** sessão — já descontada a cota, quando há uma. */
  custeadoPelaEmpresa?: boolean;
  /** Sessões que a empresa cobre; ausente é o custeio sem limite. */
  custeioCota?: number;
  custeioCiclo?: CusteioCiclo;
  /** Sessões já realizadas por conta da empresa no ciclo corrente. */
  custeioConsumidas?: number;
  sessionPricing?: {
    category: 'acessivel' | 'particular' | 'personalizado' | null;
    customAmountCents?: number;
  };
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
  psicologosCompativeis?: readonly CompatiblePsychologist[];
  historicoCpf?: readonly CpfHistoryEntry[];
  recusas?: readonly LeadRefusalEntry[];
  /** Status do pedido na captação, para decidir quais ações cabem. */
  leadStatus?: string;
  formatoAtendimento?: string;
  preferenciaGeneroPsicologo?: string;
  abordagemDesejada?: string;
  duracaoSessaoMinutos?: number;
  preferenciasOriginais?: PreferenciasSolicitacao;
  alteracoesPreferencias?: readonly AlteracaoPreferencias[];
  prazoRespostaHoras?: number;
  expiraEm?: string;
  listaEspera?: ListaEsperaRegistro;
  posicaoListaEspera?: number;
  inativacao?: InativacaoVinculo;
  inativacoes?: readonly InativacaoVinculo[];
  responsavelFinanceiro?: ResponsavelFinanceiro;
  identificadoPeloResponsavel?: boolean;
  vinculoColetivo?: VinculoColetivo;
}

export interface ManagedPsychologist {
  id: string;
  nome: string;
  pacientesAtivos?: number;
  limitePacientes?: number;
}
export interface CompatiblePsychologist {
  id: string;
  nome: string;
  pacientesAtivos: number;
  limitePacientes: number;
  lotado?: boolean;
}
export type AllocationMode = 'PEDIR_ACEITE' | 'VINCULAR_DIRETO';
export interface ReassignOptions {
  modo?: AllocationMode;
  excederLimite?: boolean;
  justificativaExcesso?: string;
}
export interface ManagedConvenio {
  id: string; nome: string; empresaPagaSessoes: boolean;
  pacoteSessoes?: number; pacoteSessoesCiclo?: CusteioCiclo;
}
