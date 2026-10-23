import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export type DeliveryState = 'sending' | 'sent' | 'rejected' | 'unknown';
export interface DeliveryReservation {
  key: string; fingerprint: string; attempt: string; state: DeliveryState;
  providerMessageId?: string; acquired: boolean;
}
export const deliveryHash = (value: string) => createHash('sha256').update(value).digest('hex');
const memory = new Map<string, DeliveryReservation>();

export async function reserveDelivery(key: string, fingerprint: string): Promise<DeliveryReservation> {
  const attempt = randomUUID();
  if (!isMysqlConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Persistência de envios não configurada.');
    const previous = memory.get(key);
    if (previous && (previous.fingerprint !== fingerprint || previous.state !== 'rejected')) {
      return { ...previous, acquired: false };
    }
    const reservation: DeliveryReservation = { key, fingerprint, attempt, state: 'sending', acquired: true };
    memory.set(key, reservation);
    return reservation;
  }
  const pool = getMysqlPool();
  await pool.execute(
    `INSERT IGNORE INTO clinica_envios_whatsapp
      (instituicao_id, chave_hash, conteudo_hash, tentativa, estado) VALUES (?, ?, ?, ?, 'sending')`,
    [instituicaoId(), key, fingerprint, attempt],
  );
  // Só uma recusa explícita permite reservar novamente. Sending/unknown não expiram.
  await pool.execute(
    `UPDATE clinica_envios_whatsapp SET tentativa = ?, estado = 'sending', atualizado_em = CURRENT_TIMESTAMP(3)
      WHERE instituicao_id = ? AND chave_hash = ? AND conteudo_hash = ? AND estado = 'rejected'`,
    [attempt, instituicaoId(), key, fingerprint],
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM clinica_envios_whatsapp WHERE instituicao_id = ? AND chave_hash = ?', [instituicaoId(), key],
  );
  const row = rows[0];
  if (!row) throw new Error('Reserva de envio não encontrada.');
  return { key, fingerprint: row.conteudo_hash, attempt: row.tentativa, state: row.estado,
    providerMessageId: row.provedor_ref ?? undefined, acquired: row.tentativa === attempt };
}

export async function finishDelivery(reservation: DeliveryReservation, state: DeliveryState, providerMessageId?: string) {
  if (!isMysqlConfigured()) {
    const previous = memory.get(reservation.key);
    if (previous?.attempt !== reservation.attempt) throw new Error('Reserva de envio alterada.');
    memory.set(reservation.key, { ...reservation, state, providerMessageId });
    return;
  }
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `UPDATE clinica_envios_whatsapp SET estado = ?, provedor_ref = ?, atualizado_em = CURRENT_TIMESTAMP(3)
      WHERE instituicao_id = ? AND chave_hash = ? AND tentativa = ? AND estado = 'sending'`,
    [state, providerMessageId ?? null, instituicaoId(), reservation.key, reservation.attempt],
  );
  if (result.affectedRows !== 1) throw new Error('Não foi possível confirmar o estado do envio.');
}
