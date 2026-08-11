import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { CadastroPsicologoRecord } from './persistence';
import { getMysqlPool } from '@/server/oci/runtime';
import { hashPassword } from '@/server/auth';
import { instituicaoId, rowId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';

const INVITE_TTL_HOURS = 72;

export class CadastroIncompletoError extends Error {
  constructor(readonly campos: readonly string[]) {
    super(`Complete antes de aprovar: ${campos.join(', ')}.`);
    this.name = 'CadastroIncompletoError';
  }
}

export interface ProvisionedPsychologistAccess {
  userId: string;
  professionalId: string;
  activationToken?: string;
  email: string;
  displayName: string;
  whatsapp: string;
}

interface ExistingUserRow extends RowDataPacket {
  ref_core: string;
  status: 'invited' | 'active' | 'disabled';
  senha_hash: string | null;
}

interface ExistingProfessionalRow extends RowDataPacket {
  ref_core: string;
}

function organizationId(): string {
  return process.env.ORGANIZATION_ID?.trim() || process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || 'org-viver-mais';
}

function normalizedEmail(value: string | undefined): string | null {
  const email = value?.trim().toLocaleLowerCase('pt-BR') ?? '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function validateApprovalAccess(record: CadastroPsicologoRecord): void {
  const missing: string[] = [];
  if (!record.nomeCompleto?.trim()) missing.push('nome completo');
  if (!record.crp?.trim()) missing.push('CRP');
  if (!normalizedEmail(record.email)) missing.push('e-mail válido');
  if (!normalizeBrazilPhone(record.whatsapp)) missing.push('WhatsApp válido');
  if (!record.estadoUf || !record.cidade) missing.push('estado e cidade');
  if (!record.genero || (record.genero === 'OUTRO' && !record.generoOutro?.trim())) missing.push('gênero');
  if (missing.length) throw new CadastroIncompletoError(missing);
}

function invitationHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function displayName(record: CadastroPsicologoRecord): string {
  return record.nomeSocial?.trim() || record.nomeCompleto.trim();
}

async function findOrganization(connection: PoolConnection): Promise<{ id: string; ref: string }> {
  const ref = organizationId();
  const [rows] = await connection.query<Array<RowDataPacket & { id: string }>>(
    `SELECT id FROM clinica_organizacoes WHERE instituicao_id = ? AND ref_core = ? LIMIT 1`,
    [instituicaoId(), ref]
  );
  if (!rows[0]) throw new Error('Organização da clínica não encontrada para criar o acesso.');
  return { id: rows[0].id, ref };
}

export async function provisionPsychologistAccess(
  record: CadastroPsicologoRecord
): Promise<ProvisionedPsychologistAccess> {
  validateApprovalAccess(record);
  const email = normalizedEmail(record.email)!;
  const whatsapp = normalizeBrazilPhone(record.whatsapp)!;
  const name = displayName(record);
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const organization = await findOrganization(connection);
    const [userRows] = await connection.query<ExistingUserRow[]>(
      `SELECT ref_core, status, senha_hash
         FROM clinica_usuarios
        WHERE instituicao_id = ? AND email_normalizado = ?
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), email]
    );

    const existingUser = userRows[0];
    if (existingUser?.status === 'disabled') {
      throw new Error('Já existe uma conta desativada com este e-mail. Reative-a antes da aprovação.');
    }
    const userId = existingUser?.ref_core ?? `user-${record.id}`;
    const now = new Date().toISOString();

    await connection.execute(
      `INSERT INTO clinica_usuarios
         (id, instituicao_id, ref_core, nome_exibicao, email_normalizado, status, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, 'invited', ?, ?)
       ON DUPLICATE KEY UPDATE
         nome_exibicao = VALUES(nome_exibicao), email_normalizado = VALUES(email_normalizado),
         atualizado_em = VALUES(atualizado_em)`,
      [rowId('usuario', userId), instituicaoId(), userId, name, email, toSqlTimestamp(now), toSqlTimestamp(now)]
    );

    const [professionalRows] = await connection.query<ExistingProfessionalRow[]>(
      `SELECT ref_core FROM clinica_profissionais
        WHERE instituicao_id = ? AND usuario_ref = ? LIMIT 1 FOR UPDATE`,
      [instituicaoId(), userId]
    );
    const professionalId = professionalRows[0]?.ref_core ?? `professional-${record.id}`;
    const modalidades = record.modalidadeAtendimento?.toLocaleLowerCase('pt-BR').includes('online')
      ? 'online'
      : 'presencial';

    await connection.execute(
      `INSERT INTO clinica_profissionais
         (id, instituicao_id, ref_core, organizacao_id, usuario_ref, nome, crp, vinculo,
          telefone, email, abordagem, modalidades, bio, ativo, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'psicologo', ?, ?, ?, ?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         ref_core = VALUES(ref_core), organizacao_id = VALUES(organizacao_id), nome = VALUES(nome),
         crp = VALUES(crp), telefone = VALUES(telefone), email = VALUES(email),
         abordagem = VALUES(abordagem), modalidades = VALUES(modalidades), bio = VALUES(bio),
         ativo = 1, atualizado_em = VALUES(atualizado_em)`,
      [
        rowId('profissional', professionalId), instituicaoId(), professionalId, organization.id,
        userId, name, record.crp.trim(), whatsapp, email, record.especialidade ?? null,
        modalidades, record.minibio ?? null, toSqlTimestamp(now), toSqlTimestamp(now),
      ]
    );

    for (const specialty of record.servicosHabilitados ?? []) {
      const value = specialty.trim();
      if (!value) continue;
      await connection.execute(
        `INSERT INTO clinica_profissionais_especialidades
           (id, instituicao_id, profissional_id, especialidade)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE especialidade = VALUES(especialidade)`,
        [rowId('especialidade', `${professionalId}:${value}`), instituicaoId(), rowId('profissional', professionalId), value]
      );
    }

    const membershipId = `membership-${record.id}`;
    await connection.execute(
      `INSERT INTO clinica_membros
         (id, instituicao_id, organizacao_id, ref_core, usuario_ref, papeis, status,
          profissional_id, convidado_por, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, 'professional,billing', ?, ?, 'admin-demo', ?, ?)
       ON DUPLICATE KEY UPDATE
         papeis = VALUES(papeis), status = VALUES(status), profissional_id = VALUES(profissional_id),
         atualizado_em = VALUES(atualizado_em)`,
      [
        rowId('membro', membershipId), instituicaoId(), organization.id, membershipId, userId,
        existingUser?.senha_hash ? 'active' : 'invited', rowId('profissional', professionalId),
        toSqlTimestamp(now), toSqlTimestamp(now),
      ]
    );

    let activationToken: string | undefined;
    if (!existingUser?.senha_hash) {
      activationToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString();
      await connection.execute(
        `UPDATE clinica_convites_acesso
            SET revogado_em = ?
          WHERE instituicao_id = ? AND usuario_ref = ?
            AND utilizado_em IS NULL AND revogado_em IS NULL`,
        [toSqlTimestamp(now), instituicaoId(), userId]
      );
      await connection.execute(
        `INSERT INTO clinica_convites_acesso
           (id, instituicao_id, organizacao_id, cadastro_ref, usuario_ref, token_hash, expira_em, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId('convite_acesso', `${record.id}:${invitationHash(activationToken)}`), instituicaoId(),
          organization.id, record.id, userId, invitationHash(activationToken),
          toSqlTimestamp(expiresAt), toSqlTimestamp(now),
        ]
      );
    }

    await connection.execute(
      `UPDATE clinica_cadastros_psicologos
          SET usuario_ref = ?, profissional_ref = ?, acesso_criado_em = COALESCE(acesso_criado_em, ?)
        WHERE instituicao_id = ? AND ref_core = ?`,
      [userId, professionalId, toSqlTimestamp(now), instituicaoId(), record.id]
    );
    await connection.commit();
    return { userId, professionalId, activationToken, email, displayName: name, whatsapp };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function activatePsychologistAccount(token: string, password: string) {
  if (password.length < 10 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    throw new Error('A senha deve ter pelo menos 10 caracteres, incluindo letra e número.');
  }
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Array<RowDataPacket & {
      id: string; usuario_ref: string; organizacao_ref: string; cadastro_ref: string;
    }>>(
      `SELECT c.id, c.usuario_ref, o.ref_core AS organizacao_ref, c.cadastro_ref
         FROM clinica_convites_acesso c
         JOIN clinica_organizacoes o ON o.id = c.organizacao_id
        WHERE c.instituicao_id = ? AND c.token_hash = ?
          AND c.utilizado_em IS NULL AND c.revogado_em IS NULL AND c.expira_em > CURRENT_TIMESTAMP(3)
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), invitationHash(token)]
    );
    const invite = rows[0];
    if (!invite) throw new Error('Este link é inválido, já foi utilizado ou expirou.');
    const now = new Date().toISOString();
    await connection.execute(
      `UPDATE clinica_usuarios
          SET senha_hash = ?, senha_definida_em = ?, status = 'active', atualizado_em = ?
        WHERE instituicao_id = ? AND ref_core = ?`,
      [hashPassword(password), toSqlTimestamp(now), toSqlTimestamp(now), instituicaoId(), invite.usuario_ref]
    );
    await connection.execute(
      `UPDATE clinica_membros SET status = 'active', atualizado_em = ?
        WHERE instituicao_id = ? AND usuario_ref = ?`,
      [toSqlTimestamp(now), instituicaoId(), invite.usuario_ref]
    );
    await connection.execute(
      `UPDATE clinica_convites_acesso SET utilizado_em = ? WHERE id = ?`,
      [toSqlTimestamp(now), invite.id]
    );
    await connection.commit();
    return { userId: invite.usuario_ref, organizationId: invite.organizacao_ref, role: 'psicologo' as const };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markWelcomeSent(registrationId: string): Promise<void> {
  await getMysqlPool().execute(
    `UPDATE clinica_cadastros_psicologos SET boas_vindas_enviada_em = CURRENT_TIMESTAMP(3)
      WHERE instituicao_id = ? AND ref_core = ?`,
    [instituicaoId(), registrationId]
  );
}
