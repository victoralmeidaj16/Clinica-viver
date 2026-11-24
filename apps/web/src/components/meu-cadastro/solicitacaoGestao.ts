export interface SolicitacaoGestaoFormValues {
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
  segundaTurmaViverMais?: string;
  servicosPrestados: string[];
  justificativa?: string;
}

export interface ModalSolicitacaoGestaoProps {
  dadosAtuais: {
    turmaViverMais?: string;
    posGraduacaoViverMais?: string;
    segundaPosGraduacao?: string;
    segundaTurmaViverMais?: string;
    servicosPrestados?: string[];
    limitePacientesAtivos?: number;
  };
  solicitacaoPendente?: {
    turmaViverMais?: string;
    posGraduacaoViverMais?: string;
    segundaPosGraduacao?: string;
    segundaTurmaViverMais?: string;
    servicosPrestados?: string[];
    limitePacientesAtivos?: number;
    justificativa?: string;
  };
  onEnviar: (valores: SolicitacaoGestaoFormValues) => Promise<void>;
  onCancelar: () => void;
}

