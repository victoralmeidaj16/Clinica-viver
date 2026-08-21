import {
  assertStaffAuthorized,
  avaliarBaseFiscalAtendimento,
  competenciaNfseDoAtendimento,
  dividirSplit7030Centavos,
  generateFinancialReports,
  type ChargeStatus,
  type FinancialCharge,
  type FinancialFilter,
  type SessionReceivable,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { getApplicationStore } from './store';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { statusCertificadoNfse, type StatusCertificadoNfse } from '@/server/fiscal/certificadoNfse';
import { PRESTADOR_NFSE, SERVICO_NFSE } from '@/server/fiscal/prestador';
import { ambienteNfse, type AmbienteNfse } from '@/server/fiscal/sefinNacional';
import { NfseRepository, type StatusEmissaoNfse } from '@/server/fiscal/nfseRepository';
import { isMysqlConfigured } from '@/server/oci/runtime';
import type { PatientContactCapable } from '@/server/persistence/mysql/identityRepository';
import { ApplicationError } from './http';
import { descricaoFiscalDaSessao } from '@/lib/sessionReference';

/**
 * Financeiro da clínica — o outro lado do extrato que o psicólogo vê.
 *
 * `financialService` devolve o pacote genérico do motor financeiro, em
 * identificadores e sem a divisão 70/30. A gestão não lê identificadores: lê
 * nomes, e precisa saber quanto do que entrou é receita da clínica e quanto é
 * crédito de abatimento do aluno. É essa tradução que mora aqui.
 *
 * O split incide sobre o **recebido líquido** (pagamentos confirmados menos
 * estornos), nunca sobre o faturado. Dividir uma cobrança em aberto criaria um
 * crédito que ainda não existe, e o psicólogo cobraria por ele.
 */

export interface AtendimentoFinanceiroClinica {
  chargeId: string;
  patientId: string;
  sessionId: string;
  pacienteNome: string;
  psicologoId: string;
  psicologoNome: string;
  vencimentoEm: string;
  status: ChargeStatus;
  valorLiquidoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  creditoPsicologoCents: number;
  receitaClinicaCents: number;
  nfseStatus: StatusEmissaoNfse | 'none';
  nfseNumero?: string;
}

export interface ConsolidadoPsicologo {
  psicologoId: string;
  psicologoNome: string;
  atendimentos: number;
  faturadoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  creditoPsicologoCents: number;
  receitaClinicaCents: number;
}

export interface ResumoFinanceiroClinica {
  atendimentos: number;
  liquidados: number;
  vencidos: number;
  faturadoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  vencidoCents: number;
  inadimplencia: number;
  creditoPsicologosCents: number;
  receitaClinicaCents: number;
}

export interface PanoramaFinanceiroClinica {
  periodo: { inicio?: string; fim?: string };
  geradoEm: string;
  resumo: ResumoFinanceiroClinica;
  atendimentos: readonly AtendimentoFinanceiroClinica[];
  porPsicologo: readonly ConsolidadoPsicologo[];
}

/** Pagamentos confirmados menos estornos: o dinheiro que de fato ficou. */
function recebidoLiquido(receivable: SessionReceivable): number {
  return Math.max(receivable.paidAmountCents - receivable.refundedAmountCents, 0);
}

async function resolverNomes(organizationId: string) {
  const store = getApplicationStore();

  const [pacientes, memberships] = await Promise.all([
    store.identities.listPatients(organizationId),
    store.identities.listMemberships(organizationId),
  ]);

  const perfis = await Promise.all(
    memberships
      .filter((membership) => membership.professionalProfileId)
      .map((membership) =>
        store.identities.getProfessional(organizationId, membership.professionalProfileId as string)
      )
  );

  return {
    pacientes: new Map(pacientes.map((paciente) => [paciente.id, paciente.displayName])),
    psicologos: new Map(
      perfis
        .filter((perfil): perfil is NonNullable<typeof perfil> => perfil !== null)
        .map((perfil) => [perfil.id, perfil.displayName])
    ),
  };
}

export async function getClinicFinanceOverview(
  context: RequestContext,
  filter: FinancialFilter = {}
): Promise<PanoramaFinanceiroClinica> {
  const store = getApplicationStore();
  const { organizationId } = context.actor;

  assertStaffAuthorized(context.actor, 'billing.read', { organizationId });

  const ledger = await store.financial.getLedger({
    organizationId,
    startDate: filter.startDate,
    endDate: filter.endDate,
  });
  const bundle = generateFinancialReports(
    ledger,
    { organizationId, startDate: filter.startDate, endDate: filter.endDate },
    new Date().toISOString()
  );

  const nomes = await resolverNomes(organizationId);
  const emissoes = isMysqlConfigured()
    ? await new NfseRepository().porCobrancas(
        organizationId,
        bundle.receivables.map((item) => item.chargeId)
      )
    : new Map();

  const atendimentos = bundle.receivables.map((receivable): AtendimentoFinanceiroClinica => {
    const recebidoCents = recebidoLiquido(receivable);
    const { creditoPsicologoCents, receitaClinicaCents } = dividirSplit7030Centavos(recebidoCents);

    return {
      chargeId: receivable.chargeId,
      patientId: receivable.patientId,
      sessionId: receivable.sessionId,
      // O identificador é o último recurso, não um espaço em branco: uma linha
      // sem nome ainda é dinheiro que a gestão precisa conseguir rastrear.
      pacienteNome: nomes.pacientes.get(receivable.patientId) ?? receivable.patientId,
      psicologoId: receivable.professionalId,
      psicologoNome: nomes.psicologos.get(receivable.professionalId) ?? receivable.professionalId,
      vencimentoEm: receivable.dueAt,
      status: receivable.chargeStatus,
      valorLiquidoCents: receivable.netAmountCents,
      recebidoCents,
      emAbertoCents: receivable.outstandingAmountCents,
      creditoPsicologoCents,
      receitaClinicaCents,
      nfseStatus: emissoes.get(receivable.chargeId)?.status ?? 'none',
      nfseNumero: emissoes.get(receivable.chargeId)?.numeroNfse,
    };
  });

  const porPsicologo = [...
    atendimentos
      .reduce((acumulado, item) => {
        const atual = acumulado.get(item.psicologoId) ?? {
          psicologoId: item.psicologoId,
          psicologoNome: item.psicologoNome,
          atendimentos: 0,
          faturadoCents: 0,
          recebidoCents: 0,
          emAbertoCents: 0,
          creditoPsicologoCents: 0,
          receitaClinicaCents: 0,
        };

        acumulado.set(item.psicologoId, {
          ...atual,
          atendimentos: atual.atendimentos + 1,
          faturadoCents: atual.faturadoCents + item.valorLiquidoCents,
          recebidoCents: atual.recebidoCents + item.recebidoCents,
          emAbertoCents: atual.emAbertoCents + item.emAbertoCents,
          creditoPsicologoCents: atual.creditoPsicologoCents + item.creditoPsicologoCents,
          receitaClinicaCents: atual.receitaClinicaCents + item.receitaClinicaCents,
        });
        return acumulado;
      }, new Map<string, ConsolidadoPsicologo>())
      .values(),
  ].sort((esquerda, direita) => direita.recebidoCents - esquerda.recebidoCents);

  const somar = (selecionar: (item: AtendimentoFinanceiroClinica) => number) =>
    atendimentos.reduce((total, item) => total + selecionar(item), 0);

  const recebidoCents = somar((item) => item.recebidoCents);
  const { creditoPsicologoCents, receitaClinicaCents } = dividirSplit7030Centavos(recebidoCents);

  return {
    periodo: { inicio: filter.startDate, fim: filter.endDate },
    geradoEm: bundle.summary.generatedAt,
    resumo: {
      atendimentos: bundle.summary.chargeCount,
      liquidados: bundle.summary.settledChargeCount,
      vencidos: bundle.summary.overdueChargeCount,
      faturadoCents: bundle.summary.netBilledCents,
      recebidoCents,
      emAbertoCents: bundle.summary.outstandingCents,
      vencidoCents: bundle.summary.overdueCents,
      inadimplencia: bundle.summary.delinquencyRate,
      // O total do período é dividido uma vez só, e não pela soma das linhas:
      // somar arredondamentos linha a linha faz o consolidado divergir do
      // extrato em alguns centavos — o suficiente para a conferência não bater.
      creditoPsicologosCents: creditoPsicologoCents,
      receitaClinicaCents,
    },
    atendimentos,
    porPsicologo,
  };
}

// A identidade fiscal vem de `server/fiscal/prestador`: é o mesmo CNPJ que
// precisa bater com o titular do certificado A1, e mantê-lo em dois lugares
// era exatamente como as telas passaram a divergir.
const CONFIGURACAO_FISCAL_VIVER_MAIS = {
  ...SERVICO_NFSE,
  municipioPrestacao: PRESTADOR_NFSE.municipio,
  ufPrestacao: PRESTADOR_NFSE.uf,
  inscricaoMunicipal: PRESTADOR_NFSE.inscricaoMunicipal,
  cnpjPrestador: PRESTADOR_NFSE.cnpj,
} as const;

export interface PreviaNfse {
  chargeId: string;
  /** `pacienteRef` é o que a tela usa para gravar o CPF que estiver faltando. */
  paciente: { ref: string; nome: string; cpf?: string; email?: string };
  competencia: string;
  descricaoServico: string;
  valorCents: number;
  servico: typeof CONFIGURACAO_FISCAL_VIVER_MAIS;
  camposPendentes: readonly string[];
  integracaoConfigurada: boolean;
  ambiente: AmbienteNfse;
  /** Estado do certificado A1 — sem chave nem senha, só o diagnóstico. */
  certificado: StatusCertificadoNfse;
}

/**
 * O adaptador em uso sabe ler contato de paciente? Em modo demonstração não
 * sabe, e a prévia segue com o que a triagem tiver.
 */
function contactSource(valor: unknown): PatientContactCapable | null {
  const candidato = valor as Partial<PatientContactCapable>;
  return typeof candidato.listPatientContacts === 'function' ? (candidato as PatientContactCapable) : null;
}

/** Emissão fiscal é uma atribuição da administração, não de billing em geral. */
export function exigirAdminFiscal(context: RequestContext) {
  const eAdmin = context.actor.roles.some((role) => role === 'owner' || role === 'admin');
  if (!eAdmin) {
    throw new ApplicationError('FORBIDDEN', 'A emissão de NFS-e é exclusiva do perfil administrador.', 403);
  }
}

/**
 * Resolve o fato gerador da cobrança.
 *
 * A cobrança informa quando foi criada; a NFS-e precisa de quando o serviço
 * foi prestado. Primeiro procuramos a sessão clínica, depois o agendamento
 * concluído (inclusive o que aponta para a sessão clínica). Referências
 * sintéticas de links antigos não viram competência por aproximação: emitir
 * no dia errado é pior do que pedir a correção do vínculo.
 */
async function competenciaFiscalDaCobranca(
  organizationId: string,
  charge: FinancialCharge
): Promise<{ competencia: string; inicioAtendimento: string }> {
  const store = getApplicationStore();
  const sessao = await store.sessions.getById(organizationId, charge.sessionId);
  if (sessao) {
    if (sessao.status !== 'completed') {
      throw new ApplicationError(
        'INVALID_FISCAL_STATE',
        'A NFS-e só pode ser emitida para um atendimento concluído.',
        422
      );
    }
    const inicioAtendimento = sessao.actualStart ?? sessao.scheduledStart;
    const comp = competenciaNfseDoAtendimento(inicioAtendimento);
    const hoje = competenciaNfseDoAtendimento(new Date().toISOString());
    return { competencia: comp > hoje ? hoje : comp, inicioAtendimento };
  }

  const agendamentoDireto = await store.appointments.getById(organizationId, charge.sessionId);
  const agendamentosDoPaciente = agendamentoDireto
    ? []
    : await store.appointments.list({
        organizationId,
        patientId: charge.patientId,
        professionalId: charge.professionalId,
        statuses: ['completed'],
      });
  const agendamento = agendamentoDireto
    ?? agendamentosDoPaciente.find((item) => item.clinicalSessionId === charge.sessionId);

  if (!agendamento) {
    throw new ApplicationError(
      'FISCAL_SESSION_REQUIRED',
      'A cobrança não está vinculada a um atendimento. Vincule-a à sessão realizada antes de emitir a NFS-e.',
      422
    );
  }
  if (agendamento.status !== 'completed') {
    throw new ApplicationError(
      'INVALID_FISCAL_STATE',
      'A NFS-e só pode ser emitida para um atendimento concluído.',
      422
    );
  }
  const inicioAtendimento = agendamento.startsAt;
  const competenciaCalculada = competenciaNfseDoAtendimento(inicioAtendimento);
  const hoje = competenciaNfseDoAtendimento(new Date().toISOString());
  return {
    competencia: competenciaCalculada > hoje ? hoje : competenciaCalculada,
    inicioAtendimento,
  };
}

/**
 * Monta a conferência antes de uma emissão fiscal real.
 *
 * Ainda não envia nada à SEFIN: enquanto certificado e credenciais não forem
 * configurados, devolver a prévia é o único comportamento seguro. Assim a tela
 * pode validar o cadastro sem criar uma NFS-e fictícia nem permitir duplicidade.
 */
export async function getNfsePreview(
  context: RequestContext,
  chargeId: string
): Promise<PreviaNfse> {
  exigirAdminFiscal(context);
  const store = getApplicationStore();
  const { organizationId } = context.actor;
  const ledger = await store.financial.getLedger({ organizationId });
  const charge = ledger.charges.find((item) => item.id === chargeId);
  if (!charge) throw new ApplicationError('NOT_FOUND', 'Cobrança não encontrada.', 404);

  const valorRecebido = ledger.payments
    .filter((payment) => payment.chargeId === chargeId && payment.status === 'confirmed')
    .reduce((total, payment) => total + payment.amountCents, 0);
  const valorEstornado = ledger.refunds
    .filter((refund) => ledger.payments.some((payment) => payment.id === refund.paymentId && payment.chargeId === chargeId))
    .reduce((total, refund) => total + refund.amountCents, 0);
  const baseFiscal = avaliarBaseFiscalAtendimento({
    valorBrutoCents: charge.amountCents,
    valorPagoConfirmadoCents: valorRecebido,
    valorEstornadoCents: valorEstornado,
    statusCobranca: charge.status,
  });
  if (!baseFiscal.apta) {
    if (baseFiscal.motivo === 'estorno_exige_revisao') {
      throw new ApplicationError(
        'FISCAL_REFUND_REVIEW_REQUIRED',
        'Esta cobrança possui estorno. Defina com a contabilidade se a nota deve ser cancelada ou substituída antes de prosseguir.',
        422
      );
    }
    throw new ApplicationError(
      'INVALID_FISCAL_STATE',
      baseFiscal.motivo === 'sem_pagamento_confirmado'
        ? 'A NFS-e só pode ser preparada para um pagamento confirmado.'
        : 'A NFS-e só pode ser preparada para uma cobrança integralmente quitada.',
      422
    );
  }

  const fatoFiscal = await competenciaFiscalDaCobranca(organizationId, charge);

  const paciente = await store.identities.getPatient(organizationId, charge.patientId);
  const state = await getCaptureRepository().read();
  const lead = state.triagensPacientes.find((item) => item.pacienteRef === charge.patientId);

  // O CPF pode estar em dois lugares, e os dois valem: a triagem, para quem
  // chegou pela vitrine, e o cadastro, para quem a recepção lançou direto.
  // Olhar só a triagem transformava metade dos pacientes em nota impossível.
  const contatos = contactSource(store.identities);
  const cadastro = contatos ? (await contatos.listPatientContacts(organizationId))[charge.patientId] : undefined;
  const cpf = lead?.cpf?.replace(/\D/g, '') || cadastro?.documento?.replace(/\D/g, '') || undefined;

  const camposPendentes: string[] = [];
  if (!cpf) camposPendentes.push('CPF do tomador');

  // O certificado responde se a emissão é possível hoje. Antes isto era um
  // `false` fixo; agora vencer o certificado, ou trocá-lo por um de outro
  // CNPJ, desabilita o botão de emitir por si só.
  const certificado = statusCertificadoNfse();

  return {
    chargeId,
    paciente: {
      ref: charge.patientId,
      nome: paciente?.displayName ?? lead?.nomePaciente ?? charge.patientId,
      cpf,
      email: lead?.email ?? cadastro?.email,
    },
    competencia: fatoFiscal.competencia,
    descricaoServico: descricaoFiscalDaSessao(fatoFiscal.inicioAtendimento),
    // A nota documenta o serviço prestado. Taxa do gateway, split 70/30 e
    // data/valor do repasse não reduzem o valor fiscal do atendimento.
    valorCents: baseFiscal.valorCents,
    servico: CONFIGURACAO_FISCAL_VIVER_MAIS,
    camposPendentes,
    integracaoConfigurada: certificado.apto,
    ambiente: ambienteNfse(),
    certificado,
  };
}

const rotuloStatus: Record<ChargeStatus, string> = {
  draft: 'Rascunho',
  paid: 'Pago',
  pending: 'Pendente',
  partially_paid: 'Parcial',
  overdue: 'Vencido',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

function escaparCsv(valor: string | number): string {
  const texto = String(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function linha(valores: readonly (string | number)[]): string {
  return valores.map(escaparCsv).join(';');
}

function reais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function dataBr(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

/**
 * CSV com `;` e vírgula decimal porque quem abre é o Excel em português, que
 * com `,` como separador de campo joga a planilha inteira numa coluna só. O
 * BOM na frente é o que faz o acento aparecer.
 */
export async function exportClinicFinanceCsv(
  context: RequestContext,
  filter: FinancialFilter = {}
): Promise<string> {
  const panorama = await getClinicFinanceOverview(context, filter);
  const { resumo } = panorama;

  return [
    '﻿FINANCEIRO DA CLÍNICA — VIVER MAIS PSICOLOGIA',
    linha(['Métrica', 'Valor']),
    linha(['Atendimentos no período', resumo.atendimentos]),
    linha(['Atendimentos liquidados', resumo.liquidados]),
    linha(['Cobranças vencidas', resumo.vencidos]),
    linha(['Faturado', reais(resumo.faturadoCents)]),
    linha(['Recebido', reais(resumo.recebidoCents)]),
    linha(['Crédito dos psicólogos (70%)', reais(resumo.creditoPsicologosCents)]),
    linha(['Receita da clínica (30%)', reais(resumo.receitaClinicaCents)]),
    linha(['Em aberto', reais(resumo.emAbertoCents)]),
    linha(['Vencido', reais(resumo.vencidoCents)]),
    linha(['Inadimplência', `${(resumo.inadimplencia * 100).toFixed(2).replace('.', ',')}%`]),
    '',
    'ATENDIMENTOS NO PERÍODO',
    linha([
      'Cobrança',
      'Sessão',
      'Paciente',
      'Psicólogo',
      'Vencimento',
      'Status',
      'Valor líquido',
      'Recebido',
      'Em aberto',
      'Crédito psicólogo (70%)',
      'Receita clínica (30%)',
    ]),
    ...panorama.atendimentos.map((item) =>
      linha([
        item.chargeId,
        item.sessionId,
        item.pacienteNome,
        item.psicologoNome,
        dataBr(item.vencimentoEm),
        rotuloStatus[item.status],
        reais(item.valorLiquidoCents),
        reais(item.recebidoCents),
        reais(item.emAbertoCents),
        reais(item.creditoPsicologoCents),
        reais(item.receitaClinicaCents),
      ])
    ),
    '',
    'CONSOLIDADO POR PSICÓLOGO',
    linha([
      'Psicólogo',
      'Atendimentos',
      'Faturado',
      'Recebido',
      'Em aberto',
      'Crédito psicólogo (70%)',
      'Receita clínica (30%)',
    ]),
    ...panorama.porPsicologo.map((item) =>
      linha([
        item.psicologoNome,
        item.atendimentos,
        reais(item.faturadoCents),
        reais(item.recebidoCents),
        reais(item.emAbertoCents),
        reais(item.creditoPsicologoCents),
        reais(item.receitaClinicaCents),
      ])
    ),
  ].join('\r\n');
}
