export interface ConvenioView {
  politica?: import('@/lib/politicaConvenio').PoliticaConvenio;
  valorSessaoContratoCents?: number;
  id: string; nome: string; razaoSocial?: string; cnpj?: string; emailFaturamento?: string;
  empresaPagaSessoes: boolean; pacoteSessoes?: number | null; pacoteSessoesCiclo?: 'total' | 'mensal' | null; diaVencimento?: number | null; ativo: boolean;
  pacientes: number; pacientesCusteados: number; sessoesProvisionadas: number; valorProvisionadoCents: number;
}

export interface PacienteConvenioView {
  id: string; nome: string; status: string; custeioConfigurado?: boolean;
  custeadoPelaEmpresa: boolean; psicologoNome?: string; sessoesNoPeriodo: number; valorNoPeriodoCents: number;
}

export interface SessaoConvenioView {
  chargeId: string; sessionId: string; patientId: string; pacienteNome: string;
  professionalId: string; psicologoNome: string; realizadaEm: string; valorCents: number;
  status: string; faturaId?: string; custeadoPelaEmpresa: boolean; atendimentoRealizado?: boolean;
}

export interface FaturaConvenioView {
  id: string; convenioId: string; competencia: string; periodoInicio: string; periodoFim: string;
  totalSessoes: number; valorCents: number; valorRecebidoDivergenteCents?: number; status: 'aberta' | 'boleto_gerado' | 'paga' | 'cancelada' | 'revisao_estorno' | 'revisao_pagamento';
  venceEm?: string; providerId?: string; boletoUrl?: string; linhaDigitavel?: string; pagoEm?: string; criadoEm: string;
}

export interface ConvenioDetailView {
  pendencias?: { id:string; nome:string; inicio:string }[]; podeAutorizar?:boolean;
  previa?: { base:string; quantidade:number; unitario:number; total:number; sessoes:string[] };
  convenio: ConvenioView; pacientes: PacienteConvenioView[];
  sessoes: SessaoConvenioView[]; faturas: FaturaConvenioView[];
}

export interface ConvenioPayload {
  politica?: import('@/lib/politicaConvenio').PoliticaConvenio;
  valorSessaoContratoCents?: number;
  nome: string; razaoSocial?: string; cnpj?: string; emailFaturamento?: string;
  empresaPagaSessoes: boolean; pacoteSessoes?: number | null; pacoteSessoesCiclo?: 'total' | 'mensal' | null; diaVencimento?: number | null; ativo: boolean;
}
