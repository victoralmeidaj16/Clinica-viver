import 'server-only';

import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type {
  IdentityRepository,
  IdentityUser,
  Organization,
  OrganizationMembership,
  PatientProfile,
  PatientReassignment,
  PatientResponsibleLink,
  ProfessionalProfile,
  ResponsibleParty,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import {
  fromSqlTimestamp,
  instituicaoId,
  rowId,
  toIdentityUser,
  toMembership,
  toOrganization,
  toPacienteStatus,
  toPatientProfile,
  toPatientResponsibleLink,
  toProfessionalProfile,
  toResponsibleParty,
  toSqlDate,
  toSqlTimestamp,
  type MembroRow,
  type OrganizacaoRow,
  type PacienteResponsavelRow,
  type PacienteRow,
  type ProfissionalRow,
  type ResponsavelRow,
  type UsuarioRow,
} from './mappers';

/**
 * `IdentityRepository` sobre o MySQL da OCI.
 *
 * Toda consulta é filtrada por `instituicao_id` e, quando o método recebe uma
 * organização, também por ela. O isolamento de tenant não fica a cargo de quem
 * chama: um id solto nunca alcança linha de outra clínica.
 */

const ORGANIZACAO_SELECT = `
  SELECT ref_core, tipo, nome_exibicao, razao_social, timezone, status, criado_em, atualizado_em
    FROM clinica_organizacoes
   WHERE instituicao_id = ?`;

const MEMBRO_SELECT = `
  SELECT m.ref_core, o.ref_core AS organizacao_ref, m.usuario_ref, m.papeis, m.status,
         p.ref_core AS profissional_ref, m.convidado_por, m.criado_em, m.atualizado_em
    FROM clinica_membros m
    JOIN clinica_organizacoes o ON o.id = m.organizacao_id
    LEFT JOIN clinica_profissionais p ON p.id = m.profissional_id
   WHERE m.instituicao_id = ? AND o.ref_core = ?`;

const PROFISSIONAL_SELECT = `
  SELECT p.ref_core, o.ref_core AS organizacao_ref, p.usuario_ref, p.nome, p.crp, p.ativo,
         GROUP_CONCAT(e.especialidade ORDER BY e.especialidade) AS especialidades,
         p.criado_em, p.atualizado_em
    FROM clinica_profissionais p
    JOIN clinica_organizacoes o ON o.id = p.organizacao_id
    LEFT JOIN clinica_profissionais_especialidades e ON e.profissional_id = p.id
   WHERE p.instituicao_id = ? AND o.ref_core = ?`;

const PACIENTE_SELECT = `
  SELECT pa.ref_core, o.ref_core AS organizacao_ref, pa.usuario_ref, pa.referencia_externa,
         pa.nome, pa.nome_social, pa.data_nascimento, pa.status,
         pr.ref_core AS profissional_ref,
         (SELECT GROUP_CONCAT(p2.ref_core)
            FROM clinica_pacientes_profissionais pp
            JOIN clinica_profissionais p2 ON p2.id = pp.profissional_id
           WHERE pp.paciente_id = pa.id) AS atribuidos,
         pa.criado_em, pa.atualizado_em
    FROM clinica_pacientes pa
    JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
    LEFT JOIN clinica_profissionais pr ON pr.id = pa.profissional_id
   WHERE pa.instituicao_id = ? AND o.ref_core = ?`;

const RESPONSAVEL_SELECT = `
  SELECT r.ref_core, o.ref_core AS organizacao_ref, r.usuario_ref, r.nome_exibicao, r.relacao,
         r.status, r.criado_em, r.atualizado_em
    FROM clinica_responsaveis r
    JOIN clinica_organizacoes o ON o.id = r.organizacao_id
   WHERE r.instituicao_id = ? AND o.ref_core = ?`;

interface ReatribuicaoRow extends RowDataPacket {
  id: string;
  paciente_ref: string;
  profissional_anterior_ref: string | null;
  profissional_novo_ref: string;
  motivo: string;
  ator_usuario_ref: string;
  ocorrido_em: string;
}

export interface PatientContact {
  phone?: string;
  email?: string;
}

/**
 * O que a camada de aplicação pode pedir além do porta do core, quando o
 * adaptador em uso souber responder. Em modo demonstração ninguém implementa
 * isso e as chamadas simplesmente não acontecem.
 */
export interface PatientContactCapable {
  listPatientContacts(organizationId: string): Promise<Record<string, PatientContact>>;
  savePatientContact(patientId: string, contact: PatientContact): Promise<void>;
}

export class MysqlIdentityRepository implements IdentityRepository, PatientContactCapable {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  private async rows<T>(sql: string, params: unknown[]): Promise<T[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
    return rows as T[];
  }

  private async first<T>(sql: string, params: unknown[]): Promise<T | null> {
    const rows = await this.rows<T>(sql, params);
    return rows[0] ?? null;
  }

  // -------------------------------------------------------------------------
  // Organização e usuário
  // -------------------------------------------------------------------------

  async getOrganization(id: string): Promise<Organization | null> {
    const row = await this.first<OrganizacaoRow>(`${ORGANIZACAO_SELECT} AND ref_core = ?`, [
      instituicaoId(),
      id,
    ]);
    return row ? toOrganization(row) : null;
  }

  async saveOrganization(organization: Organization): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_organizacoes
         (id, instituicao_id, ref_core, tipo, nome_exibicao, razao_social, timezone, status, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tipo = VALUES(tipo), nome_exibicao = VALUES(nome_exibicao), razao_social = VALUES(razao_social),
         timezone = VALUES(timezone), status = VALUES(status), atualizado_em = VALUES(atualizado_em)`,
      [
        rowId('organizacao', organization.id),
        instituicaoId(),
        organization.id,
        organization.type,
        organization.displayName,
        organization.legalName ?? null,
        organization.timezone,
        organization.status,
        toSqlTimestamp(organization.createdAt),
        toSqlTimestamp(organization.updatedAt),
      ]
    );
  }

  async getUser(id: string): Promise<IdentityUser | null> {
    const row = await this.first<UsuarioRow>(
      `SELECT ref_core, nome_exibicao, email_normalizado, status, criado_em, atualizado_em
         FROM clinica_usuarios WHERE instituicao_id = ? AND ref_core = ?`,
      [instituicaoId(), id]
    );
    return row ? toIdentityUser(row) : null;
  }

  async saveUser(user: IdentityUser): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_usuarios
         (id, instituicao_id, ref_core, nome_exibicao, email_normalizado, status, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nome_exibicao = VALUES(nome_exibicao), email_normalizado = VALUES(email_normalizado),
         status = VALUES(status), atualizado_em = VALUES(atualizado_em)`,
      [
        rowId('usuario', user.id),
        instituicaoId(),
        user.id,
        user.displayName,
        user.normalizedEmail ?? null,
        user.status,
        toSqlTimestamp(user.createdAt),
        toSqlTimestamp(user.updatedAt),
      ]
    );
  }

  // -------------------------------------------------------------------------
  // Vínculo organizacional
  // -------------------------------------------------------------------------

  async getMembership(organizationId: string, membershipId: string): Promise<OrganizationMembership | null> {
    const row = await this.first<MembroRow>(`${MEMBRO_SELECT} AND m.ref_core = ?`, [
      instituicaoId(),
      organizationId,
      membershipId,
    ]);
    return row ? toMembership(row) : null;
  }

  async findMembershipByUser(organizationId: string, userId: string): Promise<OrganizationMembership | null> {
    const row = await this.first<MembroRow>(`${MEMBRO_SELECT} AND m.usuario_ref = ?`, [
      instituicaoId(),
      organizationId,
      userId,
    ]);
    return row ? toMembership(row) : null;
  }

  async listMemberships(organizationId: string): Promise<readonly OrganizationMembership[]> {
    const rows = await this.rows<MembroRow>(`${MEMBRO_SELECT} ORDER BY m.criado_em`, [
      instituicaoId(),
      organizationId,
    ]);
    return rows.map(toMembership);
  }

  async saveMembership(membership: OrganizationMembership): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_membros
         (id, instituicao_id, organizacao_id, ref_core, usuario_ref, papeis, status, profissional_id,
          convidado_por, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         papeis = VALUES(papeis), status = VALUES(status), profissional_id = VALUES(profissional_id),
         convidado_por = VALUES(convidado_por), atualizado_em = VALUES(atualizado_em)`,
      [
        rowId('membro', membership.id),
        instituicaoId(),
        rowId('organizacao', membership.organizationId),
        membership.id,
        membership.userId,
        membership.roles.join(','),
        membership.status,
        membership.professionalProfileId ? rowId('profissional', membership.professionalProfileId) : null,
        membership.invitedBy ?? null,
        toSqlTimestamp(membership.createdAt),
        toSqlTimestamp(membership.updatedAt),
      ]
    );
  }

  // -------------------------------------------------------------------------
  // Profissional
  // -------------------------------------------------------------------------

  async getProfessional(organizationId: string, professionalId: string): Promise<ProfessionalProfile | null> {
    const row = await this.first<ProfissionalRow>(
      `${PROFISSIONAL_SELECT} AND p.ref_core = ? GROUP BY p.id`,
      [instituicaoId(), organizationId, professionalId]
    );
    return row ? toProfessionalProfile(row) : null;
  }

  async saveProfessional(profile: ProfessionalProfile): Promise<void> {
    const id = rowId('profissional', profile.id);
    await this.transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO clinica_profissionais
           (id, instituicao_id, ref_core, organizacao_id, usuario_ref, nome, crp, vinculo, ativo,
            criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'psicologo', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nome = VALUES(nome), crp = VALUES(crp), ativo = VALUES(ativo),
           atualizado_em = VALUES(atualizado_em)`,
        [
          id,
          instituicaoId(),
          profile.id,
          rowId('organizacao', profile.organizationId),
          profile.userId,
          profile.displayName,
          profile.councilRegistration || null,
          profile.status === 'active' ? 1 : 0,
          toSqlTimestamp(profile.createdAt),
          toSqlTimestamp(profile.updatedAt),
        ]
      );

      // Especialidade é linha, não campo de texto: a indicação filtra por
      // igualdade. Substituir o conjunto inteiro é mais simples do que
      // reconciliar, e o volume é de unidades por profissional.
      await connection.execute('DELETE FROM clinica_profissionais_especialidades WHERE profissional_id = ?', [id]);
      for (const especialidade of profile.specialties) {
        await connection.execute(
          `INSERT INTO clinica_profissionais_especialidades (id, instituicao_id, profissional_id, especialidade)
           VALUES (?, ?, ?, ?)`,
          [rowId('especialidade', `${profile.id}:${especialidade}`), instituicaoId(), id, especialidade]
        );
      }
    });
  }

  // -------------------------------------------------------------------------
  // Paciente
  // -------------------------------------------------------------------------

  async getPatient(organizationId: string, patientId: string): Promise<PatientProfile | null> {
    const row = await this.first<PacienteRow>(`${PACIENTE_SELECT} AND pa.ref_core = ?`, [
      instituicaoId(),
      organizationId,
      patientId,
    ]);
    return row ? toPatientProfile(row) : null;
  }

  async findPatientByUser(organizationId: string, userId: string): Promise<PatientProfile | null> {
    const row = await this.first<PacienteRow>(`${PACIENTE_SELECT} AND pa.usuario_ref = ?`, [
      instituicaoId(),
      organizationId,
      userId,
    ]);
    return row ? toPatientProfile(row) : null;
  }

  async listPatients(organizationId: string): Promise<readonly PatientProfile[]> {
    const rows = await this.rows<PacienteRow>(`${PACIENTE_SELECT} ORDER BY pa.nome`, [
      instituicaoId(),
      organizationId,
    ]);
    return rows.map(toPatientProfile);
  }

  async savePatient(patient: PatientProfile): Promise<void> {
    const id = rowId('paciente', patient.id);
    await this.transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO clinica_pacientes
           (id, instituicao_id, ref_core, organizacao_id, usuario_ref, referencia_externa, nome,
            data_nascimento, status, profissional_id, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           usuario_ref = VALUES(usuario_ref), referencia_externa = VALUES(referencia_externa),
           nome = VALUES(nome), data_nascimento = VALUES(data_nascimento), status = VALUES(status),
           profissional_id = VALUES(profissional_id), atualizado_em = VALUES(atualizado_em)`,
        [
          id,
          instituicaoId(),
          patient.id,
          rowId('organizacao', patient.organizationId),
          patient.userId ?? null,
          patient.externalReference ?? null,
          patient.displayName,
          toSqlDate(patient.birthDate),
          toPacienteStatus(patient.status),
          patient.primaryProfessionalId ? rowId('profissional', patient.primaryProfessionalId) : null,
          toSqlTimestamp(patient.createdAt),
          toSqlTimestamp(patient.updatedAt),
        ]
      );

      await connection.execute('DELETE FROM clinica_pacientes_profissionais WHERE paciente_id = ?', [id]);
      for (const professionalId of patient.assignedProfessionalIds) {
        await connection.execute(
          `INSERT INTO clinica_pacientes_profissionais (id, instituicao_id, paciente_id, profissional_id)
           VALUES (?, ?, ?, ?)`,
          [
            rowId('paciente_profissional', `${patient.id}:${professionalId}`),
            instituicaoId(),
            id,
            rowId('profissional', professionalId),
          ]
        );
      }
    });
  }

  async reassignPatient(input: {
    organizationId: string;
    patientId: string;
    professionalId: string;
    actorUserId: string;
    reason: string;
    changedAt: string;
  }): Promise<PatientProfile | null> {
    const patient = await this.getPatient(input.organizationId, input.patientId);
    if (!patient) return null;
    if (patient.primaryProfessionalId === input.professionalId) return patient;

    const patientId = rowId('paciente', input.patientId);
    const professionalId = rowId('profissional', input.professionalId);
    const auditLine = `[${input.changedAt}] Reatribuído por ${input.actorUserId}: ` +
      `${patient.primaryProfessionalId ?? 'sem responsável'} -> ${input.professionalId}. Motivo: ${input.reason}`;

    await this.transaction(async (connection) => {
      await connection.execute(
        `UPDATE clinica_pacientes
            SET profissional_id = ?,
                observacao_administrativa = RIGHT(CONCAT_WS('\n', NULLIF(observacao_administrativa, ''), ?), 1000),
                atualizado_em = ?
          WHERE instituicao_id = ? AND organizacao_id = ? AND ref_core = ?`,
        [
          professionalId,
          auditLine,
          toSqlTimestamp(input.changedAt),
          instituicaoId(),
          rowId('organizacao', input.organizationId),
          input.patientId,
        ]
      );
      await connection.execute('DELETE FROM clinica_pacientes_profissionais WHERE paciente_id = ?', [patientId]);
      await connection.execute(
        `INSERT INTO clinica_pacientes_profissionais (id, instituicao_id, paciente_id, profissional_id)
         VALUES (?, ?, ?, ?)`,
        [
          rowId('paciente_profissional', `${input.patientId}:${input.professionalId}`),
          instituicaoId(),
          patientId,
          professionalId,
        ]
      );

      // Auditoria consultável, na mesma transação da troca: se o vínculo mudou,
      // o registro de quem mudou e por quê existe. A linha em
      // `observacao_administrativa` acima continua sendo escrita porque é o que
      // instalações antigas têm — mas ela trunca em 1000 caracteres e ninguém
      // lê de volta, então não serve como fonte.
      await connection.execute(
        `INSERT INTO clinica_pacientes_reatribuicoes
           (id, instituicao_id, organizacao_ref, paciente_ref, profissional_anterior_ref,
            profissional_novo_ref, motivo, ator_usuario_ref, ocorrido_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId('reatribuicao', `${input.patientId}:${input.professionalId}:${input.changedAt}`),
          instituicaoId(),
          input.organizationId,
          input.patientId,
          patient.primaryProfessionalId ?? null,
          input.professionalId,
          input.reason,
          input.actorUserId,
          toSqlTimestamp(input.changedAt),
        ]
      );
    });

    return {
      ...patient,
      primaryProfessionalId: input.professionalId,
      assignedProfessionalIds: [input.professionalId],
      updatedAt: input.changedAt,
    };
  }

  async listPatientReassignments(
    organizationId: string,
    patientId: string
  ): Promise<readonly PatientReassignment[]> {
    const [rows] = await this.pool.query<ReatribuicaoRow[]>(
      `SELECT id, paciente_ref, profissional_anterior_ref, profissional_novo_ref,
              motivo, ator_usuario_ref, ocorrido_em
         FROM clinica_pacientes_reatribuicoes
        WHERE instituicao_id = ? AND organizacao_ref = ? AND paciente_ref = ?
        ORDER BY ocorrido_em DESC`,
      [instituicaoId(), organizationId, patientId]
    );
    return rows.map((row) => ({
      id: row.id,
      organizationId,
      patientId: row.paciente_ref,
      previousProfessionalId: row.profissional_anterior_ref ?? undefined,
      professionalId: row.profissional_novo_ref,
      reason: row.motivo,
      actorUserId: row.ator_usuario_ref,
      occurredAt: fromSqlTimestamp(row.ocorrido_em) ?? row.ocorrido_em,
    }));
  }

  /**
   * Contato do paciente.
   *
   * Fora do `IdentityRepository` de propósito: telefone e e-mail são dado
   * operacional da clínica — é por eles que o lembrete sai e que o robô
   * encontra a pessoa —, não parte da identidade que o core modela. Ampliar o
   * agregado só para carregá-los colocaria contato de paciente em todo lugar
   * por onde `PatientProfile` passa, incluindo evento de domínio.
   */
  async listPatientContacts(organizationId: string): Promise<Record<string, PatientContact>> {
    const rows = await this.rows<{ ref_core: string; telefone: string | null; email: string | null }>(
      `SELECT pa.ref_core, pa.telefone, pa.email
         FROM clinica_pacientes pa
         JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
        WHERE pa.instituicao_id = ? AND o.ref_core = ?`,
      [instituicaoId(), organizationId]
    );
    return Object.fromEntries(
      rows.map((row) => [row.ref_core, { phone: row.telefone ?? undefined, email: row.email ?? undefined }])
    );
  }

  async savePatientContact(patientId: string, contact: PatientContact): Promise<void> {
    await this.pool.execute(
      'UPDATE clinica_pacientes SET telefone = ?, email = ? WHERE instituicao_id = ? AND ref_core = ?',
      [contact.phone ?? null, contact.email ?? null, instituicaoId(), patientId]
    );
  }

  // -------------------------------------------------------------------------
  // Responsável
  // -------------------------------------------------------------------------

  async getResponsibleParty(organizationId: string, responsiblePartyId: string): Promise<ResponsibleParty | null> {
    const row = await this.first<ResponsavelRow>(`${RESPONSAVEL_SELECT} AND r.ref_core = ?`, [
      instituicaoId(),
      organizationId,
      responsiblePartyId,
    ]);
    return row ? toResponsibleParty(row) : null;
  }

  async findResponsiblePartyByUser(organizationId: string, userId: string): Promise<ResponsibleParty | null> {
    const row = await this.first<ResponsavelRow>(`${RESPONSAVEL_SELECT} AND r.usuario_ref = ?`, [
      instituicaoId(),
      organizationId,
      userId,
    ]);
    return row ? toResponsibleParty(row) : null;
  }

  async saveResponsibleParty(party: ResponsibleParty): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_responsaveis
         (id, instituicao_id, organizacao_id, ref_core, usuario_ref, nome_exibicao, relacao, status,
          criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         usuario_ref = VALUES(usuario_ref), nome_exibicao = VALUES(nome_exibicao), relacao = VALUES(relacao),
         status = VALUES(status), atualizado_em = VALUES(atualizado_em)`,
      [
        rowId('responsavel', party.id),
        instituicaoId(),
        rowId('organizacao', party.organizationId),
        party.id,
        party.userId ?? null,
        party.displayName,
        party.relationshipLabel,
        party.status,
        toSqlTimestamp(party.createdAt),
        toSqlTimestamp(party.updatedAt),
      ]
    );
  }

  async listPatientResponsibleLinks(
    organizationId: string,
    patientId: string
  ): Promise<readonly PatientResponsibleLink[]> {
    const rows = await this.rows<PacienteResponsavelRow>(
      `SELECT l.ref_core, o.ref_core AS organizacao_ref, pa.ref_core AS paciente_ref,
              r.ref_core AS responsavel_ref, l.autoridade, l.pode_gerir_agenda, l.pode_ver_financeiro,
              l.pode_acessar_conteudo_clinico, l.pode_gerir_tarefas, l.pode_gerir_avaliacoes,
              l.vigente_de, l.vigente_ate, l.criado_em
         FROM clinica_pacientes_responsaveis l
         JOIN clinica_pacientes pa ON pa.id = l.paciente_id
         JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
         JOIN clinica_responsaveis r ON r.id = l.responsavel_id
        WHERE l.instituicao_id = ? AND o.ref_core = ? AND pa.ref_core = ?
        ORDER BY l.criado_em`,
      [instituicaoId(), organizationId, patientId]
    );
    return rows.map(toPatientResponsibleLink);
  }

  async savePatientResponsibleLink(link: PatientResponsibleLink): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_pacientes_responsaveis
         (id, instituicao_id, ref_core, paciente_id, responsavel_id, autoridade, pode_gerir_agenda,
          pode_ver_financeiro, pode_acessar_conteudo_clinico, pode_gerir_tarefas, pode_gerir_avaliacoes,
          vigente_de, vigente_ate, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         autoridade = VALUES(autoridade), pode_gerir_agenda = VALUES(pode_gerir_agenda),
         pode_ver_financeiro = VALUES(pode_ver_financeiro),
         pode_acessar_conteudo_clinico = VALUES(pode_acessar_conteudo_clinico),
         pode_gerir_tarefas = VALUES(pode_gerir_tarefas), pode_gerir_avaliacoes = VALUES(pode_gerir_avaliacoes),
         vigente_de = VALUES(vigente_de), vigente_ate = VALUES(vigente_ate)`,
      [
        rowId('paciente_responsavel', link.id),
        instituicaoId(),
        link.id,
        rowId('paciente', link.patientId),
        rowId('responsavel', link.responsiblePartyId),
        link.authority,
        link.canManageAppointments ? 1 : 0,
        link.canViewBilling ? 1 : 0,
        link.canAccessSharedClinicalContent ? 1 : 0,
        link.canManageTasks ? 1 : 0,
        link.canManageAssessments ? 1 : 0,
        toSqlTimestamp(link.activeFrom),
        link.activeUntil ? toSqlTimestamp(link.activeUntil) : null,
        toSqlTimestamp(link.createdAt),
      ]
    );
  }

  private async transaction<T>(run: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await run(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
