import 'server-only';

import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { exigirAdminFiscal } from './clinicFinanceService';
import {
  atualizarConvenio, cancelarFatura, criarConvenio, fecharFatura, listarConvenios, listarFaturas,
  obterConvenio, obterFatura, pacientesDoConvenio, registrarBoleto, sessoesDoConvenio,
  vincularPacienteConvenio,
} from '@/server/persistence/mysql/convenioRepository';
import {
  createAsaasPayment, deleteAsaasPayment, findAsaasPaymentByExternalReference, getAsaasBoletoIdentificationField,
  getOrCreateAsaasCustomer,
} from '@/server/adapters/asaasAdapter';
import { gerarRelatorioConvenioPdf } from '@/server/reports/convenioReportPdf';
import { transferirCobrancasParaEmpresa } from '@/server/payments/convenioChargeTransfer';
import { normalizarCicloCusteio } from '@/lib/convenioBilling';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

function admin(context: RequestContext) {
  exigirAdminFiscal(context);
  return context.actor.organizationId;
}

function texto(value: unknown, max = 255): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function cnpj(value: unknown): string | undefined {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.length !== 14) throw new ApplicationError('INVALID_INPUT', 'Informe um CNPJ com 14 dígitos.', 400);
  return digits;
}

function numeroOpcional(value: unknown, min: number, max: number, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ApplicationError('INVALID_INPUT', `${label} deve ficar entre ${min} e ${max}.`, 400);
  }
  return number;
}

function dadosConvenio(body: Record<string, unknown>, partial = false) {
  const nome = texto(body.nome);
  if (!partial && !nome) throw new ApplicationError('INVALID_INPUT', 'O nome do convênio é obrigatório.', 400);
  return {
    ...(nome !== undefined ? { nome } : {}),
    ...(body.razaoSocial !== undefined ? { razaoSocial: texto(body.razaoSocial) } : {}),
    ...(body.cnpj !== undefined ? { cnpj: cnpj(body.cnpj) } : {}),
    ...(body.emailFaturamento !== undefined ? { emailFaturamento: texto(body.emailFaturamento) } : {}),
    ...(body.empresaPagaSessoes !== undefined ? { empresaPagaSessoes: body.empresaPagaSessoes === true } : {}),
    ...(body.pacoteSessoes !== undefined ? { pacoteSessoes: numeroOpcional(body.pacoteSessoes, 1, 65535, 'O pacote de sessões') } : {}),
    ...(body.diaVencimento !== undefined ? { diaVencimento: numeroOpcional(body.diaVencimento, 1, 28, 'O dia de vencimento') } : {}),
    ...(body.ativo !== undefined ? { ativo: body.ativo === true } : {}),
  };
}

function isConvenioNameConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const mysqlError = error as { code?: unknown; message?: unknown; sqlMessage?: unknown };
  if (mysqlError.code !== 'ER_DUP_ENTRY') return false;
  const details = `${String(mysqlError.message ?? '')} ${String(mysqlError.sqlMessage ?? '')}`;
  return details.includes('clinica_convenios_nome_uq');
}

function convenioNameConflict(error: unknown): never {
  if (isConvenioNameConflict(error)) {
    throw new ApplicationError(
      'CONVENIO_NAME_CONFLICT',
      'Já existe um convênio com este nome. Localize-o na lista para editar o cadastro existente.',
      409
    );
  }
  throw error;
}

export async function listConvenios(context: RequestContext) {
  const organizationId = admin(context);
  const convenios = await listarConvenios(organizationId);
  return {
    convenios,
    resumo: {
      total: convenios.length,
      ativos: convenios.filter((item) => item.ativo).length,
      custeados: convenios.filter((item) => item.empresaPagaSessoes || item.pacientesCusteados > 0).length,
      pacientes: convenios.reduce((sum, item) => sum + item.pacientes, 0),
      provisionadoCents: convenios.reduce((sum, item) => sum + item.valorProvisionadoCents, 0),
    },
  };
}

export async function getConvenioDetail(context: RequestContext, id: string, periodo: { inicio?: string; fim?: string } = {}) {
  const organizationId = admin(context);
  const convenio = await obterConvenio(organizationId, id);
  if (!convenio) throw new ApplicationError('NOT_FOUND', 'Convênio não encontrado.', 404);
  const [pacientes, sessoes, faturas] = await Promise.all([
    pacientesDoConvenio(organizationId, id, periodo.inicio, periodo.fim),
    sessoesDoConvenio(organizationId, id, periodo.inicio, periodo.fim),
    listarFaturas(organizationId, id),
  ]);
  return { convenio, pacientes, sessoes, faturas };
}

export async function createConvenio(context: RequestContext, body: Record<string, unknown>) {
  const organizationId = admin(context);
  const input = dadosConvenio(body) as ReturnType<typeof dadosConvenio> & { nome: string };
  try {
    return await criarConvenio(organizationId, {
      nome: input.nome, razaoSocial: input.razaoSocial, cnpj: input.cnpj,
      emailFaturamento: input.emailFaturamento,
      empresaPagaSessoes: input.empresaPagaSessoes ?? false,
      pacoteSessoes: input.pacoteSessoes, diaVencimento: input.diaVencimento,
      ativo: input.ativo ?? true,
    });
  } catch (error) {
    return convenioNameConflict(error);
  }
}

export async function updateConvenio(context: RequestContext, id: string, body: Record<string, unknown>) {
  let updated;
  try {
    updated = await atualizarConvenio(admin(context), id, dadosConvenio(body, true));
  } catch (error) {
    return convenioNameConflict(error);
  }
  if (!updated) throw new ApplicationError('NOT_FOUND', 'Convênio não encontrado.', 404);
  return updated;
}

function periodo(body: Record<string, unknown>) {
  const competencia = String(body.competencia ?? '').trim();
  const periodoInicio = String(body.periodoInicio ?? '').slice(0, 10);
  const periodoFim = String(body.periodoFim ?? '').slice(0, 10);
  const cobrancaRefs = Array.isArray(body.cobrancaRefs)
    ? body.cobrancaRefs.map(String).filter(Boolean)
    : undefined;

  if (!/^\d{4}-\d{2}$/.test(competencia) || !/^\d{4}-\d{2}-\d{2}$/.test(periodoInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(periodoFim) || periodoFim < periodoInicio) {
    throw new ApplicationError('INVALID_INPUT', 'Informe competência e período válidos.', 400);
  }
  return { competencia, periodoInicio, periodoFim, cobrancaRefs };
}

export async function closeConvenioInvoice(context: RequestContext, convenioId: string, body: Record<string, unknown>) {
  const organizationId = admin(context);
  if (!(await obterConvenio(organizationId, convenioId))) throw new ApplicationError('NOT_FOUND', 'Convênio não encontrado.', 404);
  return fecharFatura(organizationId, convenioId, periodo(body));
}

function dueDate(day: number | undefined): string {
  const now = new Date();
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [year, month, today] = local.split('-').map(Number);
  if (day === undefined) return new Date(Date.UTC(year, month - 1, today + 7, 12)).toISOString().slice(0, 10);
  const selectedDay = day;
  let due = new Date(Date.UTC(year, month - 1, selectedDay, 12));
  if (selectedDay < today) due = new Date(Date.UTC(year, month, selectedDay, 12));
  return due.toISOString().slice(0, 10);
}

export async function createConvenioBoleto(context: RequestContext, convenioId: string, faturaId: string) {
  const organizationId = admin(context);
  const connection = await getMysqlPool().getConnection();
  try {
  await connection.beginTransaction();
  await connection.query(
    `SELECT id FROM financeiro_faturas_convenio WHERE instituicao_id = ? AND organizacao_ref = ? AND convenio_ref = ? AND ref_core = ? FOR UPDATE`,
    [instituicaoId(), organizationId, convenioId, faturaId]
  );
  const [convenio, fatura] = await Promise.all([
    obterConvenio(organizationId, convenioId, connection), obterFatura(organizationId, convenioId, faturaId, connection),
  ]);
  if (!convenio || !fatura) throw new ApplicationError('NOT_FOUND', 'Convênio ou fatura não encontrado.', 404);
  if (!convenio.cnpj) throw new ApplicationError('CNPJ_REQUIRED', 'Cadastre o CNPJ real da empresa antes de gerar o boleto.', 422);
  if (['paga', 'revisao_estorno', 'revisao_pagamento'].includes(fatura.status)) throw new ApplicationError('INVALID_INVOICE_STATE', 'Esta fatura está paga ou em revisão.', 409);
  if (fatura.providerId) { await connection.commit(); return fatura; }

  const externalReference = `VMPJ-${fatura.id}`;
  let payment = await findAsaasPaymentByExternalReference(externalReference);
  const pagamentoRecuperado = Boolean(payment);
  if (!payment) {
    const customerId = await getOrCreateAsaasCustomer({
      name: convenio.razaoSocial ?? convenio.nome, cpfCnpj: convenio.cnpj,
      email: convenio.emailFaturamento,
    });
    payment = await createAsaasPayment({
      customerId, value: fatura.valorCents / 100, dueDate: dueDate(convenio.diaVencimento),
      description: `Atendimentos psicoterápicos - ${fatura.competencia} - ${fatura.totalSessoes} sessões`,
      billingType: 'BOLETO', externalReference,
    });
  }
  if (!Number.isFinite(payment.value) || Math.round(payment.value * 100) !== fatura.valorCents) {
    throw new ApplicationError('PROVIDER_AMOUNT_MISMATCH', 'O boleto existente no provedor tem valor diferente da fatura. Confira antes de continuar.', 409);
  }
  const linhaDigitavel = await getAsaasBoletoIdentificationField(payment.id);
  await registrarBoleto(organizationId, convenioId, faturaId, {
    providerId: payment.id, venceEm: payment.dueDate,
    boletoUrl: payment.bankSlipUrl ?? payment.invoiceUrl, linhaDigitavel,
    tomador: pagamentoRecuperado ? undefined : {
      cnpj: convenio.cnpj, nome: convenio.razaoSocial ?? convenio.nome, email: convenio.emailFaturamento,
    },
  }, connection);
  await connection.commit();
  return (await obterFatura(organizationId, convenioId, faturaId, connection))!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updatePatientConvenio(context: RequestContext, patientId: string, body: Record<string, unknown>) {
  const organizationId = admin(context);
  const convenioId = texto(body.convenioId, 128) ?? null;
  const custeio = body.custeadoPelaEmpresa === null || body.custeadoPelaEmpresa === undefined
    ? null : body.custeadoPelaEmpresa === true;
  // A cota descreve um custeio empresarial limitado, então só existe junto de
  // um convênio que paga. Aceitá-la solta gravaria um limite invisível, que
  // voltaria a valer no dia em que alguém marcasse o paciente como custeado.
  const cota = convenioId && custeio === true
    ? numeroOpcional(body.custeioCota, 1, 65535, 'A quantidade de sessões custeadas') ?? null
    : null;
  const ciclo = cota === null ? null : normalizarCicloCusteio(body.custeioCiclo) ?? 'total';
  await vincularPacienteConvenio(organizationId, patientId, convenioId, custeio, { cota, ciclo });
  // O vínculo vale também para sessões já marcadas: as que a empresa passou a
  // cobrir deixam a cobrança individual e entram no que ela tem a faturar.
  const cobrancas = convenioId
    ? await transferirCobrancasParaEmpresa(organizationId, patientId)
    : { transferidas: 0, mantidas: 0, pendentes: 0 };
  return {
    patientId, convenioId, custeadoPelaEmpresa: custeio, custeioCota: cota, custeioCiclo: ciclo,
    cobrancasTransferidas: cobrancas.transferidas,
    cobrancasPendentes: cobrancas.pendentes,
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function convenioReport(context: RequestContext, convenioId: string, input: { inicio?: string; fim?: string; format: 'csv' | 'pdf' }) {
  const organizationId = admin(context);
  const [convenio, sessions] = await Promise.all([
    obterConvenio(organizationId, convenioId), sessoesDoConvenio(organizationId, convenioId, input.inicio, input.fim),
  ]);
  if (!convenio) throw new ApplicationError('NOT_FOUND', 'Convênio não encontrado.', 404);
  if (input.format === 'pdf') {
    return { contentType: 'application/pdf', filename: `relatorio-${convenioId}.pdf`, body: await gerarRelatorioConvenioPdf(convenio, sessions, input) };
  }
  const rows = [
    ['Data', 'Paciente', 'Psicólogo', 'Sessão', 'Situação', 'Valor'],
    ...sessions.map((item) => [item.realizadaEm, item.pacienteNome, item.psicologoNome, item.sessionId, item.faturaId ? 'Faturado' : 'A faturar', (item.valorCents / 100).toFixed(2).replace('.', ',')]),
  ];
  return { contentType: 'text/csv; charset=utf-8', filename: `relatorio-${convenioId}.csv`, body: `﻿${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}` };
}

export async function cancelConvenioInvoice(context: RequestContext, convenioId: string, faturaId: string) {
  const organizationId = admin(context);
  const connection = await getMysqlPool().getConnection();
  try {
  await connection.beginTransaction();
  await connection.query(
    `SELECT id FROM financeiro_faturas_convenio WHERE instituicao_id = ? AND organizacao_ref = ? AND convenio_ref = ? AND ref_core = ? FOR UPDATE`,
    [instituicaoId(), organizationId, convenioId, faturaId]
  );
  const [convenio, fatura] = await Promise.all([
    obterConvenio(organizationId, convenioId, connection),
    obterFatura(organizationId, convenioId, faturaId, connection),
  ]);
  if (!convenio || !fatura) throw new ApplicationError('NOT_FOUND', 'Convênio ou fatura não encontrado.', 404);
  if (['paga', 'revisao_estorno', 'revisao_pagamento'].includes(fatura.status)) throw new ApplicationError('INVALID_INVOICE_STATE', 'Esta fatura está paga ou em revisão e não pode ser cancelada.', 409);

  // O cancelamento local só pode acontecer depois que o provedor confirmar a
  // remoção: o adaptador já trata 404 como sucesso, então qualquer erro aqui é
  // uma cobrança que continua viva no Asaas. Apagar a fatura mesmo assim
  // liberaria as sessões para um segundo faturamento do mesmo atendimento.
  if (fatura.providerId) {
    let removido: boolean;
    try {
      removido = await deleteAsaasPayment(fatura.providerId);
    } catch (cause) {
      console.error('[convenios] Falha ao remover boleto no Asaas:', fatura.providerId, cause);
      throw new ApplicationError(
        'PROVIDER_CANCEL_FAILED',
        'Não foi possível remover o boleto no Asaas; a fatura não foi cancelada. Tente novamente em instantes.',
        502
      );
    }
    if (!removido) {
      throw new ApplicationError(
        'PROVIDER_CANCEL_FAILED',
        'O Asaas não confirmou a remoção do boleto; a fatura não foi cancelada.',
        502
      );
    }
  }

  await cancelarFatura(organizationId, convenioId, faturaId, connection);
  await connection.commit();
  return { cancelled: true, id: faturaId };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
