import 'server-only';
import { createHash } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';

export interface WhatsAppReplyTarget { psychologistId?: string; leadId?: string; }
interface EventRow extends RowDataPacket {
  conteudo_hash: string;
  psicologo_ref: string | null;
  triagem_ref: string | null;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Vincular antes de agir permite retomar falhas sem consumir o próximo paciente da fila. */
export async function bindIncomingWhatsAppEvent(
  event: { id: string; phone: string; text: string },
  selectTarget: () => WhatsAppReplyTarget,
): Promise<WhatsAppReplyTarget> {
  if (!isMysqlConfigured()) throw new Error('Persistência de eventos WhatsApp não configurada.');
  const key = hash([process.env.EVOLUTION_INSTANCE_NAME?.trim() ?? '',
    normalizeBrazilPhone(event.phone) ?? event.phone.replace(/\D/g, ''), event.id]);
  const fingerprint = hash(event.text);
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [claim] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO clinica_whatsapp_eventos_recebidos
        (instituicao_id, evento_hash, conteudo_hash) VALUES (?, ?, ?)`,
      [instituicaoId(), key, fingerprint],
    );
    let target: WhatsAppReplyTarget;
    if (claim.affectedRows === 1) {
      target = selectTarget();
      await connection.execute(
        `UPDATE clinica_whatsapp_eventos_recebidos SET psicologo_ref = ?, triagem_ref = ?
          WHERE instituicao_id = ? AND evento_hash = ?`,
        [target.psychologistId ?? null, target.leadId ?? null, instituicaoId(), key],
      );
    } else {
      // O vínculo é imutável; compartilhar a leitura evita escalada de locks entre reentregas.
      const [rows] = await connection.query<EventRow[]>(
        `SELECT conteudo_hash, psicologo_ref, triagem_ref FROM clinica_whatsapp_eventos_recebidos
          WHERE instituicao_id = ? AND evento_hash = ? FOR SHARE`,
        [instituicaoId(), key],
      );
      const row = rows[0];
      if (!row || row.conteudo_hash !== fingerprint) throw new Error('Evento WhatsApp inconsistente.');
      target = { psychologistId: row.psicologo_ref ?? undefined, leadId: row.triagem_ref ?? undefined };
    }
    await connection.commit();
    return target;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
