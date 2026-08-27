export type StatusCadastro = 'EM_ANALISE' | 'APROVADO' | 'RECUSADO';

export interface PsicologoItem {
  id: string;
  nomeCompleto: string;
  nomeSocial?: string;
  crp: string;
  whatsapp: string;
  email?: string;
  fotoUrl?: string;
  cidade?: string;
  estadoUf?: string;
  logradouro?: string;
  bairro?: string;
  status: StatusCadastro;
  genero?: string;
  generoOutro?: string;
  especialidade?: string;
  minibio?: string;
  modalidadeAtendimento?: string;
  especificarNecessidades?: boolean;
  atendimentoPreferencia?: 'PARTICULAR' | 'SOCIAL' | 'AMBOS';
  turnosDisponiveis?: string[];
  servicosPrestados?: string[];
  publicoAlvo?: string[];
  necessidadesAtendidas?: string[];
  necessidadesOutro?: string;
  publicoAlvoOutro?: string;
  limitePacientesAtivos?: number;
  pacientesAtivosCount?: number;
  exibirNaVitrine?: boolean;
  motivoDesativacao?: string;
  pausadoNoRodizio?: boolean;
  motivoPausaRodizio?: string;
  /**
   * Férias/folgas que o profissional marcou na própria agenda, vigentes ou
   * futuras. Só de leitura: quem as cria é ele, e a pausa que elas provocam é
   * derivada — não se desfaz pelo botão de retomar, que responde por
   * `pausadoNoRodizio`.
   */
  ausenciasAgenda?: Array<{ inicio: string; fim: string; motivo?: string; criadoEm: string }>;
  ultimoLeadRecebidoEm?: string;
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
  solicitacaoAlteracaoGestao?: {
    turmaViverMais?: string;
    posGraduacaoViverMais?: string;
    segundaPosGraduacao?: string;
    servicosPrestados?: string[];
    limitePacientesAtivos?: number;
    justificativa?: string;
    solicitadoEm: string;
    status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
    respondidoEm?: string;
    motivoRecusa?: string;
  };
  /** Marcos do credenciamento. `contaAtivada` vem da junção com clinica_usuarios. */
  boasVindasEnviadaEm?: string;
  acessoCriadoEm?: string;
  usuarioRef?: string;
  contaAtivada?: boolean;
  criadoEm?: string;
}

export type FiltroStatus =
  | 'TODOS'
  | 'EM_ANALISE'
  | 'SOLICITACOES'
  | 'APROVADO'
  | 'PAUSADO'
  | 'RECUSADO';
