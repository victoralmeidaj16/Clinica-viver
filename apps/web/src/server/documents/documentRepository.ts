import 'server-only';
import type { RowDataPacket } from 'mysql2';
import type { IssuedPsychologicalDocument } from '@thats-life/core';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import { ApplicationError } from '@/server/application/http';
import { decryptDocument, encryptDocument } from './documentEncryption';

export interface DocumentScope { organizationId: string; patientId: string; professionalId: string }
export interface DocumentRepository {
  list(scope: DocumentScope): Promise<IssuedPsychologicalDocument[]>;
  get(scope: DocumentScope, id: string): Promise<IssuedPsychologicalDocument | null>;
  save(scope: DocumentScope, document: IssuedPsychologicalDocument): Promise<IssuedPsychologicalDocument>;
}

function aad(scope: DocumentScope, id: string): string {
  return JSON.stringify([instituicaoId(), scope.organizationId, scope.patientId, scope.professionalId, id]);
}

export class MysqlDocumentRepository implements DocumentRepository {
  private pool() {
    if (!isMysqlConfigured()) throw new ApplicationError('PERSISTENCE_REQUIRED', 'A emissão e o histórico de documentos exigem conexão com o banco de dados.', 503);
    return getMysqlPool();
  }

  private async read(scope: DocumentScope, id?: string): Promise<IssuedPsychologicalDocument[]> {
    const [rows] = await this.pool().query<RowDataPacket[]>(
      `SELECT id, conteudo_cifrado FROM clinica_documentos_psicologicos
       WHERE instituicao_id = ? AND organizacao_ref = ? AND paciente_ref = ? AND profissional_ref = ?
       ${id ? 'AND id = ?' : ''} ORDER BY emitido_em DESC`,
      [instituicaoId(), scope.organizationId, scope.patientId, scope.professionalId, ...(id ? [id] : [])],
    );
    return rows.map((row) => decryptDocument<IssuedPsychologicalDocument>(row.conteudo_cifrado, aad(scope, row.id)));
  }

  list(scope: DocumentScope) { return this.read(scope); }
  async get(scope: DocumentScope, id: string) { return (await this.read(scope, id))[0] ?? null; }

  async save(scope: DocumentScope, document: IssuedPsychologicalDocument) {
    const encrypted = encryptDocument(document, aad(scope, document.id));
    // Repetir a mesma emissão nunca altera a cópia já arquivada.
    await this.pool().execute(
      `INSERT INTO clinica_documentos_psicologicos
       (id, instituicao_id, organizacao_ref, paciente_ref, profissional_ref, conteudo_cifrado, emitido_em)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
      [document.id, instituicaoId(), scope.organizationId, scope.patientId, scope.professionalId, encrypted, toSqlTimestamp(document.issuedAt)],
    );
    const saved = await this.get(scope, document.id);
    if (!saved) throw new Error('Não foi possível recuperar o documento emitido.');
    return saved;
  }
}
