import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import { isFutureChargeDueAt } from '@/lib/chargeDue';
import { cancelRemote } from './sessionChargeCancellation';

export type UpdateChargeDueOutcome = 'updated' | 'not_found' | 'paid' | 'invalid';

/** Participa da transação da agenda; o chamador já autorizou e travou o agendamento. */
export async function resetAppointmentChargeDue(
  connection: PoolConnection, appointmentId: string, dueAt: string
): Promise<UpdateChargeDueOutcome> {
  const [charges] = await connection.query<RowDataPacket[]>(
    `SELECT c.ref_core, c.status, c.provedor_ref, c.organizacao_ref,
            EXISTS(SELECT 1 FROM financeiro_pagamentos p
              WHERE p.instituicao_id = c.instituicao_id AND p.organizacao_ref = c.organizacao_ref
                AND p.cobranca_ref = c.ref_core AND p.status = 'confirmed') AS possui_pagamento
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN financeiro_cobrancas c ON c.instituicao_id = a.instituicao_id
        AND c.organizacao_ref = o.ref_core
        AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
      WHERE a.instituicao_id = ? AND (a.id = ? OR a.ref_core = ?) AND c.status <> 'cancelled'
      FOR UPDATE`,
    [instituicaoId(), appointmentId, appointmentId]
  );
  if (!charges.length) return 'not_found';
  if (charges.some((c) => Boolean(c.possui_pagamento) || ['paid', 'partially_paid', 'refunded'].includes(String(c.status)))) return 'paid';
  const refs = charges.map((c) => String(c.ref_core));
  const [checkouts] = await connection.query<RowDataPacket[]>(
    `SELECT x.id, x.referencia_externa, x.provedor, x.provedor_pagamento_ref, x.status
       FROM financeiro_checkouts_asaas x
      WHERE x.instituicao_id = ? AND x.organizacao_ref = ?
        AND (x.cobranca_ref IN (?) OR x.referencia_externa IN (
          SELECT m.referencia_externa FROM financeiro_checkout_cobrancas m
           WHERE m.instituicao_id = ? AND m.cobranca_ref IN (?)
        )) FOR UPDATE`,
    [instituicaoId(), charges[0].organizacao_ref, refs, instituicaoId(), refs]
  );
  if (checkouts.some((x) => ['paid', 'refunded'].includes(String(x.status)))) return 'paid';
  const remotes = new Map<string, { provider: string; id: string }>();
  for (const checkout of checkouts) {
    if (checkout.provedor && !checkout.provedor_pagamento_ref) {
      throw new Error('Pagamento em emissão. Aguarde a conclusão para alterar o vencimento.');
    }
    if (checkout.provedor_pagamento_ref) {
      const provider = String(checkout.provedor ?? 'asaas');
      const id = String(checkout.provedor_pagamento_ref);
      remotes.set(`${provider}:${id}`, { provider, id });
    }
  }
  for (const charge of charges) {
    if (!charge.provedor_ref) continue;
    const checkout = checkouts.find((x) => x.provedor_pagamento_ref === charge.provedor_ref);
    const provider = String(checkout?.provedor ?? 'asaas');
    const id = String(charge.provedor_ref);
    remotes.set(`${provider}:${id}`, { provider, id });
  }
  for (const remote of remotes.values()) {
    if (!await cancelRemote(remote.provider, remote.id)) return 'paid';
  }
  for (const checkout of checkouts) {
    // Desfaz todo o grupo: cada sessão volta a poder ser paga ou agrupada novamente.
    await connection.execute(
      `DELETE FROM financeiro_checkout_cobrancas WHERE instituicao_id = ? AND referencia_externa = ?`,
      [instituicaoId(), checkout.referencia_externa]
    );
    await connection.execute(
      `UPDATE financeiro_checkouts_asaas SET referencia_externa = ?, provedor_pagamento_ref = NULL,
          provedor = NULL, status = 'creating', erro_codigo = NULL, expirado_em = NULL,
          atualizado_em = CURRENT_TIMESTAMP(3) WHERE instituicao_id = ? AND id = ?`,
      [`VM-${randomUUID()}`, instituicaoId(), checkout.id]
    );
  }
  await connection.execute(
    `UPDATE financeiro_cobrancas SET vence_em = ?, status = 'pending', provedor_ref = NULL,
        forma_pagamento = NULL, atualizado_em = CURRENT_TIMESTAMP(3)
      WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core IN (${refs.map(() => '?').join(', ')})`,
    [toSqlTimestamp(dueAt), instituicaoId(), charges[0].organizacao_ref, ...refs]
  );
  return 'updated';
}

export async function atualizarVencimentoCobrancaSessao(input: {
  organizationId: string; professionalId: string; appointmentId: string; dueAt: string;
}): Promise<UpdateChargeDueOutcome> {
  if (!isFutureChargeDueAt(input.dueAt)) return 'invalid';
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN clinica_profissionais p ON p.id = a.profissional_id
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
          AND (a.id = ? OR a.ref_core = ?) LIMIT 1 FOR UPDATE`,
      [instituicaoId(), input.organizationId, input.professionalId, input.appointmentId, input.appointmentId]
    );
    if (!rows[0]) { await connection.rollback(); return 'not_found'; }
    const result = await resetAppointmentChargeDue(connection, String(rows[0].id), input.dueAt);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
