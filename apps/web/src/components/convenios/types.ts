export interface ConvenioView {
  id: string; nome: string; razaoSocial?: string; cnpj?: string; emailFaturamento?: string;
  empresaPagaSessoes: boolean; pacoteSessoes?: number; diaVencimento?: number; ativo: boolean;
  pacientes: number; pacientesCusteados: number; sessoesProvisionadas: number; valorProvisionadoCents: number;
}

export interface PacienteConvenioView {
  id: string; nome: string; status: string; custeioConfigurado?: boolean;
  custeadoPelaEmpresa: boolean; psicologoNome?: string; sessoesNoPeriodo: number; valorNoPeriodoCents: number;
}

export interface SessaoConvenioView {
  chargeId: string; sessionId: string; patientId: string; pacienteNome: string;
  professionalId: string; psicologoNome: string; realizadaEm: string; valorCents: number;
  status: string; faturaId?: string;
}

export interface FaturaConvenioView {
  id: string; convenioId: string; competencia: string; periodoInicio: string; periodoFim: string;
  totalSessoes: number; valorCents: number; status: 'aberta' | 'boleto_gerado' | 'paga' | 'cancelada';
  venceEm?: string; providerId?: string; boletoUrl?: string; linhaDigitavel?: string; pagoEm?: string; criadoEm: string;
}

export interface ConvenioDetailView {
  convenio: ConvenioView; pacientes: PacienteConvenioView[];
  sessoes: SessaoConvenioView[]; faturas: FaturaConvenioView[];
}

export interface ConvenioPayload {
  nome: string; razaoSocial?: string; cnpj?: string; emailFaturamento?: string;
  empresaPagaSessoes: boolean; pacoteSessoes?: number; diaVencimento?: number; ativo: boolean;
}
