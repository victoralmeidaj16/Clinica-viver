export interface NfsePreview {
  chargeId: string;
  paciente: { ref: string; nome: string; cpf?: string; email?: string };
  competencia: string;
  descricaoServico: string;
  valorCents: number;
  servico: {
    codigoTributacaoNacional: string;
    codigoNbs: string;
    descricaoPadrao: string;
    municipioPrestacao: string;
    ufPrestacao: string;
    inscricaoMunicipal: string;
  };
  camposPendentes: readonly string[];
  integracaoConfigurada: boolean;
  ambiente: 'producao_restrita' | 'producao';
  certificado?: {
    configurado: boolean;
    apto: boolean;
    validoAte?: string;
    diasParaVencer?: number;
    impedimentos: readonly string[];
    alertas: readonly string[];
  };
}

export interface NfseEmissao {
  status: 'none' | 'reserved' | 'processing' | 'issued' | 'failed' | 'cancelled';
  ambiente?: 'producao_restrita' | 'producao';
  numeroNfse?: string;
  serie?: string;
  numeroDps?: string;
  canceladoEm?: string;
  cancelamentoMotivo?: string;
  erroCodigo?: string;
  erroMensagem?: string;
  emailStatus?: 'sending' | 'sent' | 'failed';
  emailDestinatario?: string;
  emailEnviadoEm?: string;
  emailErro?: string;
  emailTentativas?: number;
  xmlNfseDisponivel?: boolean;
  xmlDpsDisponivel?: boolean;
  danfseDisponivel?: boolean;
  podeCancelar?: boolean;
  eventos?: readonly {
    tipoEvento: string;
    numeroPedido: number;
    status: 'processing' | 'registered' | 'failed';
    motivo?: string;
    criadoEm: string;
    erroMensagem?: string;
  }[];
}
