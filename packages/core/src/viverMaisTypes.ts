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

/**
 * Gênero do profissional como a indicação o enxerga.
 *
 * Só duas opções porque é isso que o pedido do paciente distingue — "prefiro
 * uma psicóloga". Quem se declarou de outra forma no cadastro fica sem valor
 * aqui, e não como um terceiro caso a ser comparado: a pergunta que a fila
 * precisa responder é "atende ao que a pessoa pediu?", e a resposta honesta
 * para um gênero fora dessas duas opções é que não dá para afirmar que sim.
 */
export type GeneroProfissional = 'MASCULINO' | 'FEMININO';

/** Preferência declarada pelo paciente na triagem. */
export type PreferenciaGeneroPsicologo = 'SEM_PREFERENCIA' | GeneroProfissional;

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
  paraQuemE?: string;
  especificarNecessidades?: boolean;
  necessidadesPaciente?: string[];
  necessidadesOutro?: string;
  opcaoAvaliacaoPsicologica?: string;
  /**
   * Gênero de profissional que a pessoa pediu na triagem. Ausente vale como
   * `SEM_PREFERENCIA` — leads gravados antes deste campo existirem continuam
   * válidos e seguem indo para a fila inteira.
   */
  preferenciaGeneroPsicologo?: PreferenciaGeneroPsicologo;
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
  /**
   * Ausente quando o cadastro não declarou gênero, ou declarou um que não é
   * masculino nem feminino. Nesse caso o perfil só entra em indicações sem
   * preferência declarada. Ver `GeneroProfissional`.
   */
  genero?: GeneroProfissional;
  turnosDisponiveis: TurnoAtendimento[];
  modalidadesAtendidas: ModalidadeAtendimento[];
  servicosHabilitados?: string[]; // Ex: ['PSICOTERAPIA', 'AVALIACAO', 'ORIENTACAO_PROFISSIONAL', 'ORIENTACAO_PARENTAL']
  publicoAlvo?: string[];
  especificarNecessidades?: boolean;
  necessidadesAtendidas?: string[];
  necessidadesOutro?: string;
  turmaViverMais?: string; // Ex: '23A', '23B', '24A', '25B'
  posGraduacaoViverMais?: string;
  outrasPosGraduacoes?: string[];
  limitePacientesAtivos: number; // Capacidade operacional definida pela gestão
  pacientesAtivosCount: number;
  exibirNaVitrine: boolean; // Aparece no site público
  motivoDesativacao?: string; // Ex: 'Férias', 'Limite de Pacientes', 'Pausa Solicitada'
  /**
   * Fora da fila de encaminhamento, independentemente da vitrine. Quem está de
   * férias para de receber sem sumir para os próprios pacientes.
   */
  pausadoNoRodizio?: boolean;
  /**
   * Não é usado: a ordem real da fila é derivada de `ultimoLeadRecebidoEm`,
   * mais antigo primeiro. Mantido porque o tipo é público, mas uma segunda
   * noção de ordem só criaria a chance de as duas discordarem.
   */
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
  nome: string;
  razaoSocial?: string;
  cnpj?: string;
  emailFaturamento?: string;
  empresaPagaSessoes: boolean;
  pacoteSessoes?: number;
  diaVencimento?: number;
  ativo: boolean;
  totalPacientesVinculados: number;
  sessoesProvisionadas: number;
  valorProvisionadoCentavos: number;
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
