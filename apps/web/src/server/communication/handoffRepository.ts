import 'server-only';
import type { PatientHandoff } from '@thats-life/core';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { encryptDocument, decryptDocument } from '@/server/documents/documentEncryption';
import { deliveryHash } from './whatsappDeliveryRepository';

const memory = new Map<string, PatientHandoff>();
const scope = (org: string, session: string) => JSON.stringify([instituicaoId(), org, 'handoff', session]);
const content = (h: PatientHandoff) => JSON.stringify([h.patientId, h.sessionId, h.summary,
  h.tasks.map((t) => [t.id, t.title]), h.nextSessionLabel, h.professionalName]);
function merge(previous: PatientHandoff | null, next: PatientHandoff) {
  if (!previous) {
    if (next.status !== 'approved') throw new Error('Persista o resumo aprovado antes de entregá-lo.');
    return next;
  }
  if (content(previous) !== content(next)) throw new Error('O resumo desta sessão já foi registrado com outro conteúdo.');
  return previous.status === 'delivered' ? previous : next;
}

export async function getHandoff(org: string, session: string): Promise<PatientHandoff | null> {
  const key = scope(org, session);
  if (!isMysqlConfigured()) return memory.has(key) ? structuredClone(memory.get(key)!) : null;
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT conteudo_cifrado FROM clinica_comunicacoes WHERE instituicao_id = ? AND organizacao_ref = ?
      AND tipo = 'handoff' AND id_hash = ?`, [instituicaoId(), org, deliveryHash(session)],
  );
  return rows[0] ? decryptDocument<PatientHandoff>(rows[0].conteudo_cifrado, key) : null;
}

export async function saveHandoff(org: string, handoff: PatientHandoff): Promise<PatientHandoff> {
  const key = scope(org, handoff.sessionId);
  if (!isMysqlConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Persistência da entrega não configurada.');
    const value = merge(memory.get(key) ?? null, handoff);
    memory.set(key, structuredClone(value));
    return structuredClone(value);
  }
  const connection = await getMysqlPool().getConnection();
  const idHash = deliveryHash(handoff.sessionId);
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT conteudo_cifrado FROM clinica_comunicacoes WHERE instituicao_id = ? AND organizacao_ref = ?
        AND tipo = 'handoff' AND id_hash = ? FOR UPDATE`, [instituicaoId(), org, idHash],
    );
    const previous = rows[0] ? decryptDocument<PatientHandoff>(rows[0].conteudo_cifrado, key) : null;
    const value = merge(previous, handoff);
    const encrypted = encryptDocument(value, key);
    if (previous) {
      await connection.execute(
        `UPDATE clinica_comunicacoes SET estado = ?, conteudo_cifrado = ?, atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND organizacao_ref = ? AND tipo = 'handoff' AND id_hash = ?`,
        [value.status, encrypted, instituicaoId(), org, idHash],
      );
    } else {
      await connection.execute(
        `INSERT INTO clinica_comunicacoes
          (instituicao_id, organizacao_ref, tipo, chave_hash, id_hash, paciente_ref, estado, conteudo_cifrado)
          VALUES (?, ?, 'handoff', ?, ?, ?, ?, ?)`,
        [instituicaoId(), org, idHash, idHash, value.patientId, value.status, encrypted],
      );
    }
    await connection.commit();
    return value;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
