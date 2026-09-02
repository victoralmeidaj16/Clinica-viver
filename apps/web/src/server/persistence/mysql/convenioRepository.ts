import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, rowId } from './mappers';
import { ratearFatura, resolveCusteio } from '@/lib/convenioBilling';

export type StatusFaturaConvenio = 'aberta' | 'boleto_gerado' | 'paga' | 'cancelada';

export interface Convenio {
  id: string;
  nome: string;
  razaoSocial?: string;
  cnpj?: string;
  emailFaturamento?: string;
  empresaPagaSessoes: boolean;
  pacoteSessoes?: number;
  diaVencimento?: number;
  ativo: boolean;
  pacientes: number;
  pacientesCusteados: number;
  sessoesProvisionadas: number;
  valorProvisionadoCents: number;
}

export interface PacienteConvenio {
  id: string;
  nome: string;
  status: string;
  custeioConfigurado?: boolean;
  custeadoPelaEmpresa: boolean;
  psicologoNome?: string;
  sessoesNoPeriodo: number;
  valorNoPeriodoCents: number;
}

export interface SessaoConvenio {
  chargeId: string;
  sessionId: string;
  patientId: string;
  pacienteNome: string;
  professionalId: string;
  psicologoNome: string;
  realizadaEm: string;
  valorCents: number;
  status: string;
  faturaId?: string;
}

export interface FaturaConvenio {
  id: string;
  convenioId: string;
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  valorCents: number;
  status: StatusFaturaConvenio;
  venceEm?: string;
  providerId?: string;
  boletoUrl?: string;
  linhaDigitavel?: string;
  pagoEm?: string;
  criadoEm: string;
}

interface ConvenioRow extends RowDataPacket {
  ref_core: string; nome: string; razao_social: string | null; cnpj: string | null;
  email_faturamento: string | null; empresa_paga_sessoes: number;
  pacote_sessoes: number | null; dia_vencimento: number | null; ativo: number;
  pacientes: number; pacientes_custeados: number; sessoes_provisionadas: number; valor_provisionado_centavos: number;
}

interface FaturaRow extends RowDataPacket {
  ref_core: string; organizacao_ref: string; convenio_ref: string; competencia: string; periodo_inicio: string;
  periodo_fim: string; total_sessoes: number; valor_centavos: number;
  status: StatusFaturaConvenio; vence_em: string | null; provedor_ref: string | null;
  boleto_url: string | null; boleto_linha_digitavel: string | null;
  pago_em: string | null; criado_em: string;
}

const CONVENIO_SELECT = `
  SELECT c.ref_core, c.nome, c.razao_social, c.cnpj, c.email_faturamento,
         c.empresa_paga_sessoes, c.pacote_sessoes, c.dia_vencimento, c.ativo,
         COUNT(DISTINCT p.id) AS pacientes,
         COUNT(DISTINCT CASE
           WHEN p.convenio_ref IS NOT NULL
            AND COALESCE(p.custeado_pela_empresa, c.empresa_paga_sessoes, 1) = 1
           THEN p.id END) AS pacientes_custeados,
         COUNT(DISTINCT CASE WHEN fc.fatura_convenio_ref IS NULL AND fc.status IN ('pending','overdue') THEN fc.id END)
           AS sessoes_provisionadas,
         COALESCE(SUM(CASE WHEN fc.fatura_convenio_ref IS NULL AND fc.status IN ('pending','overdue')
                           THEN fc.valor_centavos ELSE 0 END), 0) AS valor_provisionado_centavos
    FROM clinica_convenios c
    LEFT JOIN clinica_pacientes p
      ON p.instituicao_id = c.instituicao_id AND p.convenio_ref = c.ref_core
     AND p.organizacao_id = (SELECT o.id FROM clinica_organizacoes o
       WHERE o.instituicao_id = c.instituicao_id AND o.ref_core = c.organizacao_ref LIMIT 1)
    LEFT JOIN financeiro_cobrancas fc
      ON fc.instituicao_id = c.instituicao_id AND fc.organizacao_ref = c.organizacao_ref
     AND fc.paciente_ref = p.ref_core`;

const FATURA_SELECT = `SELECT ref_core, organizacao_ref, convenio_ref, competencia, periodo_inicio, periodo_fim,
  total_sessoes, valor_centavos, status, vence_em, provedor_ref, boleto_url,
  boleto_linha_digitavel, pago_em, criado_em FROM financeiro_faturas_convenio`;

function toConvenio(row: ConvenioRow): Convenio {
  return {
    id: row.ref_core,
    nome: row.nome,
    razaoSocial: row.razao_social ?? undefined,
    cnpj: row.cnpj ?? undefined,
    emailFaturamento: row.email_faturamento ?? undefined,
    empresaPagaSessoes: Boolean(row.empresa_paga_sessoes),
    pacoteSessoes: row.pacote_sessoes === null ? undefined : Number(row.pacote_sessoes),
    diaVencimento: row.dia_vencimento === null ? undefined : Number(row.dia_vencimento),
    ativo: Boolean(row.ativo),
    pacientes: Number(row.pacientes),
    pacientesCusteados: Number(row.pacientes_custeados),
    sessoesProvisionadas: Number(row.sessoes_provisionadas),
    valorProvisionadoCents: Number(row.valor_provisionado_centavos),
  };
}

function toFatura(row: FaturaRow): FaturaConvenio {
  return {
    id: row.ref_core, convenioId: row.convenio_ref, competencia: row.competencia,
    periodoInicio: String(row.periodo_inicio).slice(0, 10), periodoFim: String(row.periodo_fim).slice(0, 10),
    totalSessoes: Number(row.total_sessoes), valorCents: Number(row.valor_centavos), status: row.status,
    venceEm: row.vence_em ? String(row.vence_em).slice(0, 10) : undefined,
    providerId: row.provedor_ref ?? undefined, boletoUrl: row.boleto_url ?? undefined,
    linhaDigitavel: row.boleto_linha_digitavel ?? undefined,
    pagoEm: fromSqlTimestamp(row.pago_em) ?? undefined,
    criadoEm: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
  };
}

export async function listarConvenios(organizationId: string, somenteAtivos = false): Promise<Convenio[]> {
  const [rows] = await getMysqlPool().query<ConvenioRow[]>(
    `${CONVENIO_SELECT} WHERE c.instituicao_id = ? AND c.organizacao_ref = ?
      ${somenteAtivos ? 'AND c.ativo = 1' : ''}
      GROUP BY c.id ORDER BY c.nome`,
    [instituicaoId(), organizationId]
  );
  return rows.map(toConvenio);
}

export async function listarConveniosPublicos(): Promise<Array<{ id: string; nome: string }>> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT ref_core, nome FROM clinica_convenios
      WHERE instituicao_id = ? AND organizacao_ref = 'org-viver-mais' AND ativo = 1 ORDER BY nome`,
    [instituicaoId()]
  );
  return rows.map((row) => ({ id: String(row.ref_core), nome: String(row.nome) }));
}

export async function obterConvenio(organizationId: string, id: string): Promise<Convenio | null> {
  const [rows] = await getMysqlPool().query<ConvenioRow[]>(
    `${CONVENIO_SELECT} WHERE c.instituicao_id = ? AND c.organizacao_ref = ? AND c.ref_core = ?
      GROUP BY c.id LIMIT 1`,
    [instituicaoId(), organizationId, id]
  );
  return rows[0] ? toConvenio(rows[0]) : null;
}

export async function criarConvenio(organizationId: string, input: Omit<Convenio, 'id' | 'pacientes' | 'pacientesCusteados' | 'sessoesProvisionadas' | 'valorProvisionadoCents'>): Promise<Convenio> {
  const id = `convenio-${randomUUID()}`;
  await getMysqlPool().execute(
    `INSERT INTO clinica_convenios
       (id, instituicao_id, organizacao_ref, ref_core, nome, razao_social, cnpj,
        email_faturamento, empresa_paga_sessoes, pacote_sessoes, dia_vencimento, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [rowId('convenio', id), instituicaoId(), organizationId, id, input.nome,
      input.razaoSocial ?? null, input.cnpj ?? null, input.emailFaturamento ?? null,
      input.empresaPagaSessoes ? 1 : 0, input.pacoteSessoes ?? null,
      input.diaVencimento ?? null, input.ativo ? 1 : 0]
  );
  return (await obterConvenio(organizationId, id))!;
}

export async function atualizarConvenio(organizationId: string, id: string, input: Partial<Omit<Convenio, 'id' | 'pacientes' | 'pacientesCusteados' | 'sessoesProvisionadas' | 'valorProvisionadoCents'>>): Promise<Convenio | null> {
  const atual = await obterConvenio(organizationId, id);
  if (!atual) return null;
  const proximo = { ...atual, ...input };
  await getMysqlPool().execute(
    `UPDATE clinica_convenios SET nome = ?, razao_social = ?, cnpj = ?, email_faturamento = ?,
       empresa_paga_sessoes = ?, pacote_sessoes = ?, dia_vencimento = ?, ativo = ?
      WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ?`,
    [proximo.nome, proximo.razaoSocial ?? null, proximo.cnpj ?? null,
      proximo.emailFaturamento ?? null, proximo.empresaPagaSessoes ? 1 : 0,
      proximo.pacoteSessoes ?? null, proximo.diaVencimento ?? null, proximo.ativo ? 1 : 0,
      instituicaoId(), organizationId, id]
  );
  return obterConvenio(organizationId, id);
}

export async function pacientesDoConvenio(organizationId: string, convenioId: string, inicio?: string, fim?: string): Promise<PacienteConvenio[]> {
  const params: unknown[] = [instituicaoId(), organizationId, convenioId];
  const periodo = inicio && fim ? 'AND fc.emitida_em >= ? AND fc.emitida_em < DATE_ADD(?, INTERVAL 1 DAY)' : '';
  if (inicio && fim) params.push(inicio, fim);
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT p.ref_core, COALESCE(p.nome_social, p.nome) AS nome, p.status,
            p.custeado_pela_empresa, c.empresa_paga_sessoes,
            pr.nome AS psicologo_nome,
            COUNT(DISTINCT fc.id) AS sessoes_periodo,
            COALESCE(SUM(fc.valor_centavos), 0) AS valor_periodo
       FROM clinica_pacientes p
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
       JOIN clinica_convenios c ON c.instituicao_id = p.instituicao_id
        AND c.organizacao_ref = o.ref_core AND c.ref_core = p.convenio_ref
       LEFT JOIN clinica_profissionais pr ON pr.id = p.profissional_id
       LEFT JOIN financeiro_cobrancas fc ON fc.instituicao_id = p.instituicao_id
        AND fc.organizacao_ref = o.ref_core AND fc.paciente_ref = p.ref_core ${periodo}
      WHERE p.instituicao_id = ? AND o.ref_core = ? AND c.ref_core = ?
      GROUP BY p.id ORDER BY nome`,
    params
  );
  return rows.map((row) => ({
    id: String(row.ref_core), nome: String(row.nome), status: String(row.status),
    custeioConfigurado: row.custeado_pela_empresa === null ? undefined : Boolean(row.custeado_pela_empresa),
    custeadoPelaEmpresa: resolveCusteio(row.custeado_pela_empresa, row.empresa_paga_sessoes),
    psicologoNome: row.psicologo_nome ? String(row.psicologo_nome) : undefined,
    sessoesNoPeriodo: Number(row.sessoes_periodo), valorNoPeriodoCents: Number(row.valor_periodo),
  }));
}

export async function sessoesDoConvenio(organizationId: string, convenioId: string, inicio?: string, fim?: string): Promise<SessaoConvenio[]> {
  const clauses = ['fc.instituicao_id = ?', 'fc.organizacao_ref = ?', 'p.convenio_ref = ?'];
  const params: unknown[] = [instituicaoId(), organizationId, convenioId];
  if (inicio) { clauses.push('fc.emitida_em >= ?'); params.push(inicio); }
  if (fim) { clauses.push('fc.emitida_em < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(fim); }
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT fc.ref_core, fc.sessao_ref, fc.paciente_ref, fc.profissional_ref,
            fc.emitida_em, fc.valor_centavos, fc.status, fc.fatura_convenio_ref,
            COALESCE(p.nome_social, p.nome) AS paciente_nome, pr.nome AS psicologo_nome
       FROM financeiro_cobrancas fc
       JOIN clinica_pacientes p ON p.instituicao_id = fc.instituicao_id AND p.ref_core = fc.paciente_ref
       LEFT JOIN clinica_profissionais pr ON pr.instituicao_id = fc.instituicao_id AND pr.ref_core = fc.profissional_ref
      WHERE ${clauses.join(' AND ')} ORDER BY fc.emitida_em DESC`,
    params
  );
  return rows.map((row) => ({
    chargeId: String(row.ref_core), sessionId: String(row.sessao_ref), patientId: String(row.paciente_ref),
    pacienteNome: String(row.paciente_nome), professionalId: String(row.profissional_ref),
    psicologoNome: String(row.psicologo_nome ?? row.profissional_ref),
    realizadaEm: fromSqlTimestamp(row.emitida_em)!, valorCents: Number(row.valor_centavos),
    status: String(row.status), faturaId: row.fatura_convenio_ref ? String(row.fatura_convenio_ref) : undefined,
  }));
}

export async function listarFaturas(organizationId: string, convenioId: string): Promise<FaturaConvenio[]> {
  const [rows] = await getMysqlPool().query<FaturaRow[]>(
    `${FATURA_SELECT} WHERE instituicao_id = ? AND organizacao_ref = ? AND convenio_ref = ? ORDER BY competencia DESC`,
    [instituicaoId(), organizationId, convenioId]
  );
  return rows.map(toFatura);
}

export async function obterFatura(organizationId: string, convenioId: string, faturaId: string): Promise<FaturaConvenio | null> {
  const [rows] = await getMysqlPool().query<FaturaRow[]>(
    `${FATURA_SELECT} WHERE instituicao_id = ? AND organizacao_ref = ? AND convenio_ref = ? AND ref_core = ? LIMIT 1`,
    [instituicaoId(), organizationId, convenioId, faturaId]
  );
  return rows[0] ? toFatura(rows[0]) : null;
}

export async function fecharFatura(
  organizationId: string,
  convenioId: string,
  input: {
    competencia: string;
    periodoInicio: string;
    periodoFim: string;
    cobrancaRefs?: string[];
  }
): Promise<FaturaConvenio> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();

    const whereClauses = [
      'fc.instituicao_id = ?',
      'fc.organizacao_ref = ?',
      'p.convenio_ref = ?',
      'fc.fatura_convenio_ref IS NULL',
      "fc.status IN ('pending','overdue')",
      'fc.emitida_em >= ?',
      'fc.emitida_em < DATE_ADD(?, INTERVAL 1 DAY)',
    ];
    const queryParams: unknown[] = [
      instituicaoId(),
      organizationId,
      convenioId,
      input.periodoInicio,
      input.periodoFim,
    ];

    if (input.cobrancaRefs && input.cobrancaRefs.length > 0) {
      whereClauses.push('fc.ref_core IN (?)');
      queryParams.push(input.cobrancaRefs);
    }

    const [charges] = await connection.query<RowDataPacket[]>(
      `SELECT fc.ref_core, fc.valor_centavos
         FROM financeiro_cobrancas fc
         JOIN clinica_pacientes p ON p.instituicao_id = fc.instituicao_id AND p.ref_core = fc.paciente_ref
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY fc.emitida_em, fc.ref_core FOR UPDATE`,
      queryParams
    );

    if (charges.length === 0) {
      throw new Error('Nenhum atendimento selecionado ou disponível nesse período para fechar a fatura.');
    }

    const valorCents = charges.reduce((total, row) => total + Number(row.valor_centavos), 0);

    const [existentes] = await connection.query<FaturaRow[]>(
      `${FATURA_SELECT} WHERE instituicao_id = ? AND convenio_ref = ? AND competencia = ? LIMIT 1 FOR UPDATE`,
      [instituicaoId(), convenioId, input.competencia]
    );

    let faturaId: string;
    if (existentes[0]) {
      if (existentes[0].status !== 'aberta') {
        throw new Error(`A fatura da competência ${input.competencia} já possui boleto gerado ou foi paga (${existentes[0].status}).`);
      }
      faturaId = existentes[0].ref_core;
      const novoTotalSessoes = existentes[0].total_sessoes + charges.length;
      const novoValorCents = Number(existentes[0].valor_centavos) + valorCents;
      await connection.execute(
        `UPDATE financeiro_faturas_convenio
            SET total_sessoes = ?, valor_centavos = ?,
                periodo_inicio = LEAST(periodo_inicio, ?),
                periodo_fim = GREATEST(periodo_fim, ?),
                atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ?`,
        [novoTotalSessoes, novoValorCents, input.periodoInicio, input.periodoFim, instituicaoId(), organizationId, faturaId]
      );
    } else {
      faturaId = `fatura-convenio-${randomUUID()}`;
      await connection.execute(
        `INSERT INTO financeiro_faturas_convenio
          (id, instituicao_id, organizacao_ref, ref_core, convenio_ref, competencia,
           periodo_inicio, periodo_fim, total_sessoes, valor_centavos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rowId('fatura_convenio', faturaId), instituicaoId(), organizationId, faturaId,
          convenioId, input.competencia, input.periodoInicio, input.periodoFim, charges.length, valorCents]
      );
    }

    await connection.query(
      `UPDATE financeiro_cobrancas SET fatura_convenio_ref = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core IN (?) AND fatura_convenio_ref IS NULL`,
      [faturaId, instituicaoId(), organizationId, charges.map((row) => row.ref_core)]
    );

    await connection.commit();
    return (await obterFatura(organizationId, convenioId, faturaId))!;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function registrarBoleto(organizationId: string, convenioId: string, faturaId: string, input: { providerId: string; venceEm: string; boletoUrl: string; linhaDigitavel?: string }): Promise<FaturaConvenio> {
  await getMysqlPool().execute(
    `UPDATE financeiro_faturas_convenio SET status = 'boleto_gerado', vence_em = ?,
       provedor_ref = ?, boleto_url = ?, boleto_linha_digitavel = ?
      WHERE instituicao_id = ? AND organizacao_ref = ? AND convenio_ref = ?
        AND ref_core = ? AND status = 'aberta'`,
    [input.venceEm, input.providerId, input.boletoUrl, input.linhaDigitavel ?? null,
      instituicaoId(), organizationId, convenioId, faturaId]
  );
  return (await obterFatura(organizationId, convenioId, faturaId))!;
}

export async function vincularPacienteConvenio(organizationId: string, patientId: string, convenioId: string | null, custeio: boolean | null): Promise<void> {
  if (convenioId) {
    const convenio = await obterConvenio(organizationId, convenioId);
    if (!convenio) throw new Error('Convênio não encontrado.');
  }
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE clinica_pacientes p JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        SET p.convenio_ref = ?, p.custeado_pela_empresa = ?
      WHERE p.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?`,
    [convenioId, convenioId ? custeio : null, instituicaoId(), organizationId, patientId]
  );
  if (result.affectedRows === 0) throw new Error('Paciente não encontrado.');
}

export async function reconcileConvenioInvoicePayment(input: { eventId: string; eventType: string; paymentId: string; amountCents: number; receivedAt: string }): Promise<'processed' | 'duplicate' | 'unknown'> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [faturas] = await connection.query<FaturaRow[]>(
      `${FATURA_SELECT} WHERE instituicao_id = ? AND provedor_ref = ? LIMIT 1 FOR UPDATE`,
      [instituicaoId(), input.paymentId]
    );
    const fatura = faturas[0];
    if (!fatura) { await connection.rollback(); return 'unknown'; }
    const [eventos] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM financeiro_webhooks_asaas WHERE instituicao_id = ? AND evento_ref = ? LIMIT 1',
      [instituicaoId(), input.eventId]
    );
    if (eventos[0]) { await connection.rollback(); return 'duplicate'; }
    await connection.execute(
      `INSERT INTO financeiro_webhooks_asaas
       (id, instituicao_id, evento_ref, evento_tipo, provedor_pagamento_ref) VALUES (?, ?, ?, ?, ?)`,
      [rowId('asaas_event', input.eventId), instituicaoId(), input.eventId, input.eventType, input.paymentId]
    );
    const [charges] = await connection.query<RowDataPacket[]>(
      `SELECT ref_core, valor_centavos FROM financeiro_cobrancas
        WHERE instituicao_id = ? AND organizacao_ref = ? AND fatura_convenio_ref = ?
        ORDER BY emitida_em, ref_core FOR UPDATE`,
      [instituicaoId(), fatura.organizacao_ref, fatura.ref_core]
    );
    if (charges.length === 0) throw new Error('A fatura do convênio não possui cobranças vinculadas.');
    const rateio = ratearFatura(input.amountCents, charges.map((row) => Number(row.valor_centavos)));
    for (const [indice, charge] of charges.entries()) {
      const paymentRef = `asaas-convenio-${input.paymentId}-${indice + 1}`;
      await connection.execute(
        `INSERT INTO financeiro_pagamentos
          (id, instituicao_id, organizacao_ref, ref_core, cobranca_ref, recebido_em,
           valor_centavos, forma, status, provedor, provedor_transacao_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'bank_transfer', 'confirmed', 'asaas', ?)
         ON DUPLICATE KEY UPDATE status = 'confirmed'`,
        [rowId('pagamento', paymentRef), instituicaoId(), fatura.organizacao_ref, paymentRef,
          charge.ref_core, input.receivedAt, rateio[indice], `${input.paymentId}:${charge.ref_core}`]
      );
    }
    await connection.execute(
      `UPDATE financeiro_cobrancas SET status = 'paid', forma_pagamento = 'bank_transfer', atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND organizacao_ref = ? AND fatura_convenio_ref = ?`,
      [instituicaoId(), fatura.organizacao_ref, fatura.ref_core]
    );
    await connection.execute(
      `UPDATE financeiro_faturas_convenio SET status = 'paga', pago_em = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND ref_core = ?`,
      [input.receivedAt, instituicaoId(), fatura.ref_core]
    );
    await connection.commit();
    return 'processed';
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function cancelarFatura(organizationId: string, convenioId: string, faturaId: string): Promise<void> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();

    const [faturas] = await connection.query<FaturaRow[]>(
      `${FATURA_SELECT} WHERE instituicao_id = ? AND organizacao_ref = ? AND convenio_ref = ? AND ref_core = ? LIMIT 1 FOR UPDATE`,
      [instituicaoId(), organizationId, convenioId, faturaId]
    );
    const fatura = faturas[0];
    if (!fatura) throw new Error('Fatura não encontrada.');
    if (fatura.status === 'paga') throw new Error('Não é possível cancelar uma fatura que já foi paga.');

    // Desvincula as cobranças associadas para que voltem a ficar disponíveis para faturamento
    await connection.execute(
      `UPDATE financeiro_cobrancas
          SET fatura_convenio_ref = NULL, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND organizacao_ref = ? AND fatura_convenio_ref = ?`,
      [instituicaoId(), organizationId, faturaId]
    );

    // Remove a fatura para liberar a competência e permitir faturar novamente
    await connection.execute(
      `DELETE FROM financeiro_faturas_convenio
        WHERE instituicao_id = ? AND organizacao_ref = ? AND convenio_ref = ? AND ref_core = ?`,
      [instituicaoId(), organizationId, convenioId, faturaId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
