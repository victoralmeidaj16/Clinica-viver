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
  return criarConvenio(organizationId, {
    nome: input.nome, razaoSocial: input.razaoSocial, cnpj: input.cnpj,
    emailFaturamento: input.emailFaturamento,
    empresaPagaSessoes: input.empresaPagaSessoes ?? false,
    pacoteSessoes: input.pacoteSessoes, diaVencimento: input.diaVencimento,
    ativo: input.ativo ?? true,
  });
}

export async function updateConvenio(context: RequestContext, id: string, body: Record<string, unknown>) {
  const updated = await atualizarConvenio(admin(context), id, dadosConvenio(body, true));
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
  const selectedDay = day ?? Math.min(today + 7, 28);
  let due = new Date(Date.UTC(year, month - 1, selectedDay, 12));
  if (due.getTime() <= now.getTime()) due = new Date(Date.UTC(year, month, selectedDay, 12));
  return due.toISOString().slice(0, 10);
}

export async function createConvenioBoleto(context: RequestContext, convenioId: string, faturaId: string) {
  const organizationId = admin(context);
  const [convenio, fatura] = await Promise.all([
    obterConvenio(organizationId, convenioId), obterFatura(organizationId, convenioId, faturaId),
  ]);
  if (!convenio || !fatura) throw new ApplicationError('NOT_FOUND', 'Convênio ou fatura não encontrado.', 404);
  if (!convenio.cnpj) throw new ApplicationError('CNPJ_REQUIRED', 'Cadastre o CNPJ real da empresa antes de gerar o boleto.', 422);
  if (fatura.status === 'paga') throw new ApplicationError('INVALID_INVOICE_STATE', 'Esta fatura já está paga.', 409);
  if (fatura.providerId) return fatura;

  const externalReference = `VMPJ-${fatura.id}`;
  let payment = await findAsaasPaymentByExternalReference(externalReference);
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
  const linhaDigitavel = await getAsaasBoletoIdentificationField(payment.id);
  return registrarBoleto(organizationId, convenioId, faturaId, {
    providerId: payment.id, venceEm: payment.dueDate,
    boletoUrl: payment.bankSlipUrl ?? payment.invoiceUrl, linhaDigitavel,
  });
}

export async function updatePatientConvenio(context: RequestContext, patientId: string, body: Record<string, unknown>) {
  const organizationId = admin(context);
  const convenioId = texto(body.convenioId, 128) ?? null;
  const custeio = body.custeadoPelaEmpresa === null || body.custeadoPelaEmpresa === undefined
    ? null : body.custeadoPelaEmpresa === true;
  await vincularPacienteConvenio(organizationId, patientId, convenioId, custeio);
  return { patientId, convenioId, custeadoPelaEmpresa: custeio };
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
  const [convenio, fatura] = await Promise.all([
    obterConvenio(organizationId, convenioId),
    obterFatura(organizationId, convenioId, faturaId),
  ]);
  if (!convenio || !fatura) throw new ApplicationError('NOT_FOUND', 'Convênio ou fatura não encontrado.', 404);
  if (fatura.status === 'paga') throw new ApplicationError('INVALID_INVOICE_STATE', 'Esta fatura já está paga e não pode ser cancelada.', 409);

  if (fatura.providerId) {
    try {
      await deleteAsaasPayment(fatura.providerId);
    } catch {
      // continua se o boleto já havia sido removido no provedor
    }
  }

  await cancelarFatura(organizationId, convenioId, faturaId);
  return { cancelled: true, id: faturaId };
}
