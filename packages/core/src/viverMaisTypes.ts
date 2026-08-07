/**
 * Domínio da Clínica Viver Mais Psicologia — Clínica Escola
 */

export type ModalidadeAtendimento = 'ACESSIVEL_SOCIAL' | 'PARTICULAR' | 'AVALIACAO_PSICOLOGICA';

export type TurnoAtendimento = 'MANHA' | 'TARDE' | 'NOITE';

export type StatusLead = 
  | 'AGUARDANDO_CONTATO' 
  | 'CONTATO_CONFIRMADO' 
  | 'EM_ATENDIMENTO' 
  | 'TRANSBORDADO' 
  | 'DESISTENTE'
  | 'FINALIZADO';

export type StatusPaciente = 'ATIVO' | 'EM_FERIAS' | 'DESISTENTE';

export type ModoAgendamentoCobranca = 'PRE_SESSAO_24H' | 'POS_SESSAO' | 'MANUAL';

export type MotivoCancelamento = 
  | 'FALTA_PACIENTE' 
  | 'SOLICITACAO_PACIENTE' 
  | 'MOTIVO_SAUDE_PSI' 
  | 'REAGENDAMENTO_CONCORDADO' 
  | 'OUTRO';

export interface LeadTriagem {
  id: string;
  nomePaciente: string;
  telefoneWhatsApp: string;
  email?: string;
  /**
   * CPF e endereço completo são exigência da emissão da nota fiscal, não da
   * triagem: o formulário público coleta apenas o CEP, e o resto entra depois,
   * quando o lead vira paciente. Opcionais aqui para que o registro represente
   * o que de fato se sabe da pessoa neste ponto — nenhum critério de indicação
   * depende deles.
   */
  cpf?: string;
  endereco?: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  modalidade: ModalidadeAtendimento;
  turno: TurnoAtendimento;
  origemLead: string; // Ex: 'Site Viver Mais', 'Tráfego Pago', 'Indicação', 'Redes Sociais'
  convenioEmpresarialId?: string; // Ex: Canguru
  criadoEm: string;
  psicologoAlocadoId?: string;
  dataAlocacao?: string;
  status: StatusLead;
  nomeSocial?: string;
  confirmadoPeloPsicologoEm?: string;
  slaExpirado: boolean;
}

export interface PsicologoPerfil {
  id: string;
  nome: string;
  nomeSocial?: string;
  crp: string;
  telefoneWhatsApp: string;
  email: string;
  fotoUrl?: string;
  apresentacaoCurta?: string;
  turnosDisponiveis: TurnoAtendimento[];
  modalidadesAtendidas: ModalidadeAtendimento[];
  servicosHabilitados?: string[]; // Ex: ['PSICOTERAPIA', 'AVALIACAO', 'ORIENTACAO_PROFISSIONAL', 'ORIENTACAO_PARENTAL']
  turmaViverMais?: string; // Ex: '23A', '23B', '24A', '25B'
  posGraduacaoViverMais?: string;
  outrasPosGraduacoes?: string[];
  limitePacientesAtivos: number; // Padrão: 33
  pacientesAtivosCount: number;
  exibirNaVitrine: boolean; // Gestão pode privar/desativar ao atingir capacidade
  motivoDesativacao?: string; // Ex: 'Férias', 'Limite de Pacientes', 'Pausa Solicitada'
  posicaoFilaRoundRobin: number;
  ultimoLeadRecebidoEm?: string;
  saldoCreditoAbatimento: number; // 70% acumulado para abatimento no boleto
}

export interface SessaoAgendamentoViverMais {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  psicologoId: string;
  psicologoNome: string;
  dataHora: string;
  duracaoMinutos: number; // Bloqueado: 50min (Somente leitura para Psi)
  valorSessao: number; // Bloqueado (Somente leitura para Psi)
  status: 'AGENDADA' | 'REALIZADA' | 'REAGENDADA' | 'CANCELADA';
  modoCobranca: ModoAgendamentoCobranca;
  vencimentoCobrancaEm: string;
  statusPagamento: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  motivoCancelamento?: string;
  motivoReagendamento?: string;
  criadoEm: string;
}

export interface LinkCobrancaAsaas {
  id: string;
  leadId: string;
  pacienteNome: string;
  psicologoId: string;
  psicologoNome: string;
  valorTotal: number; // Ex: 75.00 ou 130.00
  valorCreditoAluno: number; // 70%
  valorReceitaClinica: number; // 30%
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  checkoutUrl: string;
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  criadoEm: string;
  pagoEm?: string;
  transacaoIdAsaas?: string;
}

export interface ConvenioEmpresarial {
  id: string;
  nomeEmpresa: string; // Ex: "Canguru Soluções"
  cnpj: string;
  pacoteSessoes: number; // Ex: 6 sessões
  valorPorSessao: number;
  totalPacientesVinculados: number;
  dataEmissaoNotaFiscal?: string;
  numeroNotaFiscal?: string;
  dataVencimentoBoleto?: string;
  dataPagamentoBoleto?: string;
  statusPagamento: 'AGUARDANDO_NF' | 'NF_EMITIDA' | 'BOLETO_GERADO' | 'PAGO';
}

export interface AuditoriaDesistencia {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  psicologoId: string;
  psicologoNome: string;
  motivo: 'FINANCEIRO' | 'INSATISFACAO_CONDUTA' | 'TROCA_ABORDAGEM' | 'MOTIVOS_PESSOAIS' | 'OUTRO';
  descricaoDetalhada?: string;
  dataDesistencia: string;
  contatoReengajamentoEfetuado: boolean;
  observacoesReengajamento?: string;
  permitirTrocaPsicologo: boolean;
}

export interface FiltroExtratoPeriodo {
  psicologoId: string;
  dataInicio: string;
  dataFim: string;
}

export interface IndicadoresClinicaViverMais {
  totalLeadsFilaEspera: number;
  slasEstourados24h: number;
  distribuicaoGenero: { masculino: number; feminino: number; outro: number };
  faixaEtariaPredominante: { faixa: string; porcentagem: number }[];
  origemLeads: { origem: string; quantidade: number; cacEstimado: number }[];
  totalAtendimentosMes: number;
  detalhamentoModalidades: { modalidade: ModalidadeAtendimento; quantidade: number; receitaBruta: number }[];
  faixasDeValor: { faixa: string; sessoes: number }[];
  cpaMarketing: number;
  projetosConveniosAtivos: number;
  totalCreditosRepassadosAlunos: number;
  totalReceitaBrutaClinica: number;
}

/**
 * Garante a regra de sigilo profissional (Row-Level Access Security):
 * O psicólogo visualiza e altera EXCLUSIVAMENTE dados vinculados a seu próprio ID.
 */
export function validarAcessoExclusivoPsicologo(
  solicitanteId: string,
  donoRecursoId: string,
  eGestor: boolean = false
): boolean {
  if (eGestor) return true;
  return solicitanteId === donoRecursoId;
}
