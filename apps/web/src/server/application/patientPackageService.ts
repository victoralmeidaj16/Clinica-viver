import 'server-only';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, rowId, toSqlTimestamp, fromSqlTimestamp } from '@/server/persistence/mysql/mappers';
import { getOrCreateCheckoutCardPayment } from '@/server/payments/checkoutCardPayment';
import { bindProviderPayment, type ReservedCheckout } from '@/server/payments/paymentLinkRepository';
import { pagadorDoAtendimento, lerResponsavelFinanceiro } from '@/lib/responsavelFinanceiro';
import { responsavelDoPacienteSql } from '@/server/persistence/mysql/responsavelFinanceiroSql';
import { ApplicationError } from './http';
import type { RequestContext } from './context';
import { getApplicationStore } from './store';

function exigirGestao(ctx: RequestContext) {
  if (!ctx.actor.roles.some(r => r === 'admin' || r === 'owner')) throw new ApplicationError('FORBIDDEN', 'Pacotes são geridos pela administração.', 403);
}

export async function listarPacotes(ctx: RequestContext) {
  exigirGestao(ctx);
  const org = ctx.actor.organizationId;
  const pacientes = await getApplicationStore().identities.listPatients(org);
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`SELECT k.id,k.paciente_ref,k.profissional_ref,k.quantidade,k.utilizadas,k.valor_centavos,k.pago_em,
    EXISTS(SELECT 1 FROM financeiro_pacote_divergencias d WHERE d.pacote_id=k.id) AS divergente
    FROM financeiro_pacotes k WHERE instituicao_id=? AND organizacao_ref=? ORDER BY criado_em DESC`, [instituicaoId(),org]);
  return { pacientes: pacientes.filter(p => p.status === 'active' && p.primaryProfessionalId)
    .map(p => ({ id:p.id, nome:p.displayName, profissional:p.primaryProfessionalId })), pacotes: rows };
}

export async function criarPacote(ctx: RequestContext, body: Record<string, unknown>) {
  exigirGestao(ctx);
  const org = ctx.actor.organizationId;
  const paciente = await getApplicationStore().identities.getPatient(org, String(body.pacienteId));
  if (!paciente?.primaryProfessionalId || paciente.status !== 'active') throw new ApplicationError('INVALID_INPUT','Paciente sem vínculo ativo.',400);
  const qtd = Number(body.quantidade), valor = Number(body.valorCentavos), prazo = String(body.venceEm);
  if (!Number.isSafeInteger(qtd) || qtd < 1 || qtd > 65535 || !Number.isSafeInteger(valor) || valor < 1
    || !Number.isFinite(Date.parse(prazo)) || Date.parse(prazo) <= Date.now() || !ctx.idempotencyKey || ctx.idempotencyKey.length > 128)
    throw new ApplicationError('INVALID_INPUT','Informe quantidade, valor total e vencimento válidos.',400);
  const scope = [instituicaoId(),org];
  const conn = await getMysqlPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = randomUUID();
    const ref = 'pacote-' + id;
    await conn.execute(`INSERT INTO financeiro_pacotes (id,instituicao_id,organizacao_ref,paciente_ref,profissional_ref,
      cobranca_ref,chave_criacao,quantidade,valor_centavos) VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE id=id`,[id,...scope,paciente.id,paciente.primaryProfessionalId,ref,ctx.idempotencyKey,qtd,valor]);
    const [[row]] = await conn.query<RowDataPacket[]>(`SELECT k.*,c.vence_em FROM financeiro_pacotes k
      LEFT JOIN financeiro_cobrancas c ON c.instituicao_id=k.instituicao_id AND c.organizacao_ref=k.organizacao_ref AND c.ref_core=k.cobranca_ref
      WHERE k.instituicao_id=? AND k.organizacao_ref=? AND k.chave_criacao=? FOR UPDATE`,[...scope,ctx.idempotencyKey]);
    if (row.id === id) {
      await conn.execute(`INSERT INTO financeiro_cobrancas (id,instituicao_id,organizacao_ref,ref_core,sessao_ref,paciente_ref,profissional_ref,
        emitida_em,vence_em,valor_centavos,status,descricao,criado_em,atualizado_em)
        VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(3),?,?,'pending',?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
      [rowId('cobranca',ref),...scope,ref,id,paciente.id,paciente.primaryProfessionalId,toSqlTimestamp(prazo),valor,'Pacote de '+qtd+' sessões']);
      await conn.execute(`INSERT INTO financeiro_checkouts_asaas (id,instituicao_id,organizacao_ref,cobranca_ref,modalidade,referencia_externa,provedor)
        VALUES (?,?,?,?,'particular',?,'asaas')`,[randomUUID(),...scope,ref,'VM-'+id.replaceAll('-','')]);
    } else if (row.paciente_ref !== paciente.id || Number(row.quantidade)!==qtd || Number(row.valor_centavos)!==valor
        || fromSqlTimestamp(row.vence_em)!==new Date(prazo).toISOString()) {
      throw new ApplicationError('CONFLICT','Chave de criação já usada para outro pacote.',409);
    }
    await conn.commit();
    return { id:String(row.id) };
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}

export async function emitirPacote(ctx: RequestContext, id: string) {
  exigirGestao(ctx);
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`SELECT k.*, pa.nome,pa.documento,pa.email,pa.telefone,
    ${responsavelDoPacienteSql(true)} AS responsavel,x.id AS checkout_id,x.referencia_externa,x.provedor_pagamento_ref,c.vence_em
    FROM financeiro_pacotes k JOIN clinica_organizacoes o ON o.instituicao_id=k.instituicao_id AND o.ref_core=k.organizacao_ref
    JOIN clinica_pacientes pa ON pa.organizacao_id=o.id AND pa.instituicao_id=k.instituicao_id AND pa.ref_core=k.paciente_ref
    JOIN financeiro_cobrancas c ON c.instituicao_id=k.instituicao_id AND c.organizacao_ref=k.organizacao_ref AND c.ref_core=k.cobranca_ref
    JOIN financeiro_checkouts_asaas x ON x.instituicao_id=k.instituicao_id AND x.organizacao_ref=k.organizacao_ref AND x.cobranca_ref=k.cobranca_ref
    WHERE k.instituicao_id=? AND k.organizacao_ref=? AND k.id=? AND k.pago_em IS NULL AND c.vence_em>UTC_TIMESTAMP(3)
      AND NOT EXISTS(SELECT 1 FROM financeiro_pacote_divergencias d WHERE d.pacote_id=k.id)`, [instituicaoId(),ctx.actor.organizationId,id]);
  const k = rows[0];
  if (!k) throw new ApplicationError('NOT_FOUND','Pacote indisponível para emissão.',404);
  const payer = pagadorDoAtendimento({ nome:k.nome,cpf:k.documento,email:k.email,telefone:k.telefone },lerResponsavelFinanceiro(k.responsavel));
  const cpf = payer.cpf?.replace(/\D/g,'');
  if (cpf?.length !== 11) throw new ApplicationError('INVALID_INPUT','Cadastre o CPF do pagador antes de emitir.',400);
  const checkout: ReservedCheckout = { id:k.checkout_id, externalReference:k.referencia_externa, chargeId:k.cobranca_ref,
    organizationId:k.organizacao_ref, patientId:k.paciente_ref, patientName:payer.nome, patientCpf:cpf,
    patientEmail:payer.email, patientPhone:payer.telefone, professionalName:'', amountCents:Number(k.valor_centavos),
    providerPaymentId:k.provedor_pagamento_ref ?? undefined, dueAt:fromSqlTimestamp(k.vence_em)!, description:'Pacote de '+k.quantidade+' sessões' };
  const payment = await getOrCreateCheckoutCardPayment(checkout, ref => bindProviderPayment(checkout,ref,'card','asaas'));
  return { url:payment.invoiceUrl };
}
