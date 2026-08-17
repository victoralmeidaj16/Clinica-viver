import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { hashPassword } from '@/server/auth';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, rowId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';

const RESET_TTL_HOURS = 2;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLocaleLowerCase('pt-BR');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  return email;
}

function validatePassword(password: string): void {
  if (password.length < 10 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    throw new Error('A senha deve ter pelo menos 10 caracteres, incluindo letra e número.');
  }
}

interface ResetUserRow extends RowDataPacket {
  userId: string;
  organizationId: string;
}

export async function createPsychologistPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<ResetUserRow[]>(
      `SELECT u.ref_core AS userId, o.id AS organizationId
         FROM clinica_usuarios u
         JOIN clinica_membros m ON m.instituicao_id = u.instituicao_id AND m.usuario_ref = u.ref_core
         JOIN clinica_organizacoes o ON o.id = m.organizacao_id
        WHERE u.instituicao_id = ? AND u.email_normalizado = ?
          AND m.profissional_id IS NOT NULL AND u.status = 'active'
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), email]
    );
    const user = rows[0];
    if (!user) throw new Error('Não foi encontrada uma conta ativa de psicólogo com este e-mail.');

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TTL_HOURS * 60 * 60 * 1000);
    await connection.execute(
      `UPDATE clinica_redefinicoes_senha SET revogado_em = ?
        WHERE instituicao_id = ? AND usuario_ref = ? AND utilizado_em IS NULL AND revogado_em IS NULL`,
      [toSqlTimestamp(now.toISOString()), instituicaoId(), user.userId]
    );
    await connection.execute(
      `INSERT INTO clinica_redefinicoes_senha
         (id, instituicao_id, organizacao_id, usuario_ref, token_hash, expira_em, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        rowId('redefinicao_senha', tokenHash(token)), instituicaoId(), user.organizationId, user.userId,
        tokenHash(token), toSqlTimestamp(expiresAt.toISOString()), toSqlTimestamp(now.toISOString()),
      ]
    );
    await connection.commit();
    return { token, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function resetPsychologistPassword(token: string, password: string) {
  if (!token) throw new Error('Link de redefinição inválido.');
  validatePassword(password);
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Array<RowDataPacket & { id: string; usuario_ref: string; organizacao_ref: string }>>(
      `SELECT r.id, r.usuario_ref, o.ref_core AS organizacao_ref
         FROM clinica_redefinicoes_senha r
         JOIN clinica_organizacoes o ON o.id = r.organizacao_id
        WHERE r.instituicao_id = ? AND r.token_hash = ?
          AND r.utilizado_em IS NULL AND r.revogado_em IS NULL AND r.expira_em > CURRENT_TIMESTAMP(3)
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), tokenHash(token)]
    );
    const reset = rows[0];
    if (!reset) throw new Error('Este link é inválido, já foi utilizado ou expirou.');
    const now = toSqlTimestamp(new Date().toISOString());
    await connection.execute(
      `UPDATE clinica_usuarios SET senha_hash = ?, senha_definida_em = ?, atualizado_em = ?
        WHERE instituicao_id = ? AND ref_core = ?`,
      [hashPassword(password), now, now, instituicaoId(), reset.usuario_ref]
    );
    await connection.execute('UPDATE clinica_redefinicoes_senha SET utilizado_em = ? WHERE id = ?', [now, reset.id]);
    await connection.commit();
    return { userId: reset.usuario_ref, organizationId: reset.organizacao_ref, role: 'psicologo' as const };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
