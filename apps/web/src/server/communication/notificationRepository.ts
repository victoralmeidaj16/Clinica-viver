import 'server-only';
import type { NotificationMessage, NotificationRepository } from '@thats-life/core';
import type { Pool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import { encryptDocument, decryptDocument } from '@/server/documents/documentEncryption';
import { deliveryHash } from './whatsappDeliveryRepository';

const scope = (organization: string, id: string) => JSON.stringify([instituicaoId(), organization, 'notification', id]);

export class MysqlNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  private decode(row: RowDataPacket): NotificationMessage {
    return decryptDocument<NotificationMessage>(row.conteudo_cifrado, scope(row.organizacao_ref, row.id_hash));
  }

  private async find(organizationId: string, column: 'id_hash' | 'chave_hash', value: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM clinica_comunicacoes WHERE instituicao_id = ? AND organizacao_ref = ?
        AND tipo = 'notification' AND ${column} = ?`, [instituicaoId(), organizationId, deliveryHash(value)],
    );
    return rows[0] ? this.decode(rows[0]) : null;
  }
  getById(organizationId: string, messageId: string) { return this.find(organizationId, 'id_hash', messageId); }
  findByIdempotencyKey(organizationId: string, key: string) { return this.find(organizationId, 'chave_hash', key); }

  async list(filter: { organizationId: string; patientId?: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM clinica_comunicacoes WHERE instituicao_id = ? AND organizacao_ref = ?
        AND tipo = 'notification'${filter.patientId ? ' AND paciente_ref = ?' : ''} ORDER BY atualizado_em`,
      [instituicaoId(), filter.organizationId, ...(filter.patientId ? [filter.patientId] : [])],
    );
    return rows.map((row) => this.decode(row));
  }

  async listDue(before: string, limit: number) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM clinica_comunicacoes WHERE instituicao_id = ? AND tipo = 'notification'
        AND estado IN ('queued','failed') AND agendado_em <= ? ORDER BY agendado_em LIMIT ?`,
      [instituicaoId(), toSqlTimestamp(before), Math.max(1, Math.min(limit, 500))],
    );
    return rows.map((row) => this.decode(row));
  }

  async save(message: NotificationMessage): Promise<void> {
    const idHash = deliveryHash(message.id);
    const keyHash = deliveryHash(message.idempotencyKey);
    const encrypted = encryptDocument(message, scope(message.organizationId, idHash));
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM clinica_comunicacoes WHERE instituicao_id = ? AND organizacao_ref = ?
          AND tipo = 'notification' AND (id_hash = ? OR chave_hash = ?) FOR UPDATE`,
        [instituicaoId(), message.organizationId, idHash, keyHash],
      );
      if (!rows.length) {
        if (message.status !== 'queued') throw new Error('A mensagem deve ser enfileirada antes do envio.');
        await connection.execute(
          `INSERT INTO clinica_comunicacoes
            (instituicao_id, organizacao_ref, tipo, chave_hash, id_hash, paciente_ref, estado, agendado_em, conteudo_cifrado)
            VALUES (?, ?, 'notification', ?, ?, ?, ?, ?, ?)`,
          [instituicaoId(), message.organizationId, keyHash, idHash, message.patientId,
            message.status, toSqlTimestamp(message.scheduledFor), encrypted],
        );
      } else {
        const previous = this.decode(rows[0]);
        const immutable = (m: NotificationMessage) => JSON.stringify([m.id, m.idempotencyKey, m.patientId,
          m.recipientReference, m.channel, m.category, m.body, m.subject, m.scheduledFor, m.maxAttempts]);
        if (rows.length !== 1 || immutable(previous) !== immutable(message)) {
          throw new Error('A chave da mensagem já está vinculada a outro conteúdo.');
        }
        if (previous.status === 'queued' && message.status === 'queued'
          || previous.status === 'delivered' && message.status === 'delivered') {
          await connection.commit();
          return;
        }
        const starting = ['queued', 'failed'].includes(previous.status) && message.status === 'sending'
          && message.attemptCount === previous.attemptCount + 1;
        const finishing = previous.status === 'sending' && ['delivered', 'failed'].includes(message.status)
          && message.attemptCount === previous.attemptCount;
        const cancelling = ['queued', 'failed'].includes(previous.status) && message.status === 'cancelled';
        if (!starting && !finishing && !cancelling) throw new Error('Estado da mensagem alterado por outro envio.');
        await connection.execute(
          `UPDATE clinica_comunicacoes SET estado = ?, conteudo_cifrado = ?, atualizado_em = CURRENT_TIMESTAMP(3)
            WHERE instituicao_id = ? AND organizacao_ref = ? AND tipo = 'notification' AND id_hash = ?`,
          [message.status, encrypted, instituicaoId(), message.organizationId, idHash],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
}
