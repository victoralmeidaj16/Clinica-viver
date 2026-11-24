import 'server-only';
import { createHash } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, rowId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';

export async function registrarEstornoPaciente(input: { eventId:string; eventType:string; paymentId:string; refundCents:number; receivedAt:string }) {
  const conn = await getMysqlPool().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT p.ref_core,p.organizacao_ref,p.cobranca_ref,p.valor_centavos,
      COALESCE((SELECT SUM(e.valor_centavos) FROM financeiro_estornos e WHERE e.instituicao_id=p.instituicao_id
        AND e.organizacao_ref=p.organizacao_ref AND e.pagamento_ref=p.ref_core AND e.provedor_ref=?),0) AS estornado
      FROM financeiro_pagamentos p JOIN financeiro_cobrancas c ON c.instituicao_id=p.instituicao_id
        AND c.organizacao_ref=p.organizacao_ref AND c.ref_core=p.cobranca_ref
      WHERE p.instituicao_id=? AND p.provedor='asaas' AND p.status='confirmed' AND c.fatura_convenio_ref IS NULL
        AND (p.ref_core=CONCAT('asaas-',?,'-',c.ref_core) OR
          LEFT(p.ref_core,CHAR_LENGTH(CONCAT('asaas-',?,'-',c.ref_core,':')))=CONCAT('asaas-',?,'-',c.ref_core,':'))
      ORDER BY p.recebido_em,p.ref_core FOR UPDATE`,[input.paymentId,instituicaoId(),input.paymentId,input.paymentId,input.paymentId]);
    if (!rows.length) { await conn.rollback(); return 'unknown' as const; }
    const [[evento]] = await conn.query<RowDataPacket[]>('SELECT id FROM financeiro_webhooks_asaas WHERE instituicao_id=? AND evento_ref=? FOR UPDATE',[instituicaoId(),input.eventId]);
    if (evento) { await conn.rollback(); return 'duplicate' as const; }
    const pago = rows.reduce((n,r) => n+Number(r.valor_centavos),0);
    if (!Number.isSafeInteger(input.refundCents) || input.refundCents < 1 || input.refundCents > pago) throw new Error('Valor de estorno incompatível com o recebimento.');
    let restante = input.refundCents - rows.reduce((n,r) => n+Number(r.estornado),0);
    for (const p of rows) {
      const delta = Math.min(restante,Number(p.valor_centavos)-Number(p.estornado));
      if (delta <= 0) continue;
      const ref = 'estorno-' + createHash('sha256').update(JSON.stringify([input.eventId,p.ref_core])).digest('hex');
      await conn.execute(`INSERT INTO financeiro_estornos (id,instituicao_id,organizacao_ref,ref_core,pagamento_ref,
        valor_centavos,estornado_em,motivo,provedor_ref) VALUES (?,?,?,?,?,?,?,'Estorno confirmado pelo Asaas',?)`,
      [rowId('estorno',ref),instituicaoId(),p.organizacao_ref,ref,p.ref_core,delta,toSqlTimestamp(input.receivedAt),input.paymentId]);
      await conn.execute(`UPDATE financeiro_cobrancas c SET status=IF(
        (SELECT SUM(pg.valor_centavos) FROM financeiro_pagamentos pg WHERE pg.instituicao_id=c.instituicao_id AND pg.organizacao_ref=c.organizacao_ref
          AND pg.cobranca_ref=c.ref_core AND pg.status='confirmed') <=
        (SELECT SUM(e.valor_centavos) FROM financeiro_estornos e JOIN financeiro_pagamentos pg ON pg.instituicao_id=e.instituicao_id
          AND pg.organizacao_ref=e.organizacao_ref AND pg.ref_core=e.pagamento_ref WHERE pg.instituicao_id=c.instituicao_id
          AND pg.organizacao_ref=c.organizacao_ref AND pg.cobranca_ref=c.ref_core),'refunded',c.status)
        WHERE c.instituicao_id=? AND c.organizacao_ref=? AND c.ref_core=?`,[instituicaoId(),p.organizacao_ref,p.cobranca_ref]);
      restante -= delta;
    }
    await conn.execute(`INSERT INTO financeiro_webhooks_asaas (id,instituicao_id,evento_ref,evento_tipo,provedor_pagamento_ref)
      VALUES (?,?,?,?,?)`,[rowId('asaas_event',input.eventId),instituicaoId(),input.eventId,input.eventType,input.paymentId]);
    await conn.commit(); return 'processed' as const;
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}
