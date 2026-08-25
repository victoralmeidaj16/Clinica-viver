import 'server-only';

import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  CertificateRecord,
  CertificateStatus,
  CertificateTemplate,
  blankCertificateTemplate,
  generateCertificateCode,
  getMockCertificate,
  initialCertificates,
} from '@thats-life/core';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';

interface CertificadoRow extends RowDataPacket {
  id: string;
  codigo: string;
  aluno_id: string | null;
  aluno_nome: string;
  aluno_cpf: string | null;
  aluno_email: string | null;
  curso_id: string | null;
  curso_titulo: string;
  carga_horaria: string;
  data_emissao: string;
  data_inicio: string | null;
  data_conclusao: string | null;
  assinante_info: string;
  url_validacao: string;
  status: CertificateStatus;
  motivo_revogacao: string | null;
  revogado_em: string | null;
  revogado_por: string | null;
  frente_imagem_url: string | null;
  verso_imagem_url: string | null;
  carimbo_x: number | null;
  carimbo_y: number | null;
  carimbo_font_size: number | null;
  carimbo_align: 'left' | 'center' | 'right' | null;
  criado_por: string | null;
  criado_em: string;
}

interface TemplateRow extends RowDataPacket {
  id: string;
  curso_id: string | null;
  nome: string;
  background_url: string | null;
  background_type: 'image' | 'pdf';
  second_background_url: string | null;
  second_background_type: 'image' | 'pdf';
  verification_url: string;
  hours_override: number | null;
  issue_date_override: string | null;
  width_px: number;
  height_px: number;
  fields_json: unknown;
  atualizado_em: string;
}

function toCertificateRecord(row: CertificadoRow): CertificateRecord {
  return {
    id: row.id,
    code: row.codigo,
    studentId: row.aluno_id ?? undefined,
    studentName: row.aluno_nome,
    studentCpf: row.aluno_cpf ?? undefined,
    studentEmail: row.aluno_email ?? undefined,
    courseId: row.curso_id ?? undefined,
    courseTitle: row.curso_titulo,
    durationHours: row.carga_horaria,
    issueDate: row.data_emissao,
    startDate: row.data_inicio ? String(row.data_inicio).slice(0, 10) : undefined,
    completionDate: row.data_conclusao ? String(row.data_conclusao).slice(0, 10) : undefined,
    signerInfo: row.assinante_info,
    validationUrl: row.url_validacao,
    status: row.status,
    revocationReason: row.motivo_revogacao ?? undefined,
    revokedAt: row.revogado_em ? String(row.revogado_em) : undefined,
    revokedBy: row.revogado_por ?? undefined,
    frontImageUrl: row.frente_imagem_url ?? undefined,
    backImageUrl: row.verso_imagem_url ?? undefined,
    stampX: row.carimbo_x != null ? Number(row.carimbo_x) : undefined,
    stampY: row.carimbo_y != null ? Number(row.carimbo_y) : undefined,
    stampFontSize: row.carimbo_font_size != null ? Number(row.carimbo_font_size) : undefined,
    stampAlign: row.carimbo_align ?? undefined,
    createdBy: row.criado_por ?? undefined,
    createdAt: String(row.criado_em),
  };
}

// Armazenamento em memória contingencial para quando o banco estiver indisponível
const memoryCertificates: Map<string, CertificateRecord> = new Map(
  initialCertificates.map((c) => [c.code.toLowerCase(), { ...c }])
);
const memoryTemplates: Map<string, CertificateTemplate> = new Map();

export class CertificadosRepository {
  private get pool(): Pool | null {
    try {
      return isMysqlConfigured() ? getMysqlPool() : null;
    } catch {
      return null;
    }
  }

  async porCodigo(codigo: string): Promise<CertificateRecord | null> {
    const trimmed = codigo.trim();
    if (!trimmed) return null;

    if (this.pool) {
      try {
        const [rows] = await this.pool.query<CertificadoRow[]>(
          `SELECT * FROM clinica_certificados WHERE LOWER(codigo) = LOWER(?) OR LOWER(id) = LOWER(?) LIMIT 1`,
          [trimmed, trimmed]
        );
        if (rows[0]) return toCertificateRecord(rows[0]);
      } catch (err) {
        console.warn('Erro ao consultar certificado no MySQL, usando fallback:', err);
      }
    }

    return memoryCertificates.get(trimmed.toLowerCase()) ?? getMockCertificate(trimmed);
  }

  async listar(filtro?: { busca?: string; status?: CertificateStatus }): Promise<CertificateRecord[]> {
    if (this.pool) {
      try {
        let sql = `SELECT * FROM clinica_certificados WHERE 1=1`;
        const params: unknown[] = [];

        if (filtro?.status && filtro.status !== 'all' as unknown) {
          sql += ` AND status = ?`;
          params.push(filtro.status);
        }

        if (filtro?.busca) {
          sql += ` AND (LOWER(aluno_nome) LIKE LOWER(?) OR LOWER(codigo) LIKE LOWER(?) OR LOWER(curso_titulo) LIKE LOWER(?))`;
          const term = `%${filtro.busca}%`;
          params.push(term, term, term);
        }

        sql += ` ORDER BY criado_em DESC`;
        const [rows] = await this.pool.query<CertificadoRow[]>(sql, params);
        if (rows.length > 0) return rows.map(toCertificateRecord);
      } catch (err) {
        console.warn('Erro ao listar certificados no MySQL, usando fallback:', err);
      }
    }

    const all = Array.from(memoryCertificates.values());
    return all.filter((c) => {
      const matchStatus = !filtro?.status || filtro.status === 'all' as unknown || c.status === filtro.status;
      const matchBusca =
        !filtro?.busca ||
        c.studentName.toLowerCase().includes(filtro.busca.toLowerCase()) ||
        c.code.toLowerCase().includes(filtro.busca.toLowerCase()) ||
        c.courseTitle.toLowerCase().includes(filtro.busca.toLowerCase());
      return matchStatus && matchBusca;
    });
  }

  async emitir(dados: {
    studentName: string;
    studentCpf?: string;
    studentEmail?: string;
    courseTitle: string;
    durationHours: string;
    issueDate: string;
    startDate?: string;
    completionDate?: string;
    frontImageUrl?: string;
    backImageUrl?: string;
    stampX?: number;
    stampY?: number;
    stampFontSize?: number;
    stampAlign?: 'left' | 'center' | 'right';
    signerInfo?: string;
    validationUrl?: string;
    createdBy?: string;
  }): Promise<CertificateRecord> {
    const code = generateCertificateCode();
    const id = code;
    const createdAt = new Date().toISOString();

    const record: CertificateRecord = {
      id,
      code,
      studentName: dados.studentName.trim(),
      studentCpf: dados.studentCpf?.trim(),
      studentEmail: dados.studentEmail?.trim(),
      courseTitle: dados.courseTitle.trim(),
      durationHours: dados.durationHours.trim(),
      issueDate: dados.issueDate.trim(),
      startDate: dados.startDate,
      completionDate: dados.completionDate,
      frontImageUrl: dados.frontImageUrl,
      backImageUrl: dados.backImageUrl,
      stampX: dados.stampX,
      stampY: dados.stampY,
      stampFontSize: dados.stampFontSize || 11,
      stampAlign: dados.stampAlign || 'center',
      signerInfo: dados.signerInfo || 'VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153',
      validationUrl: dados.validationUrl || 'www.vivermaispsicologia.com.br',
      status: 'valid',
      createdAt,
      createdBy: dados.createdBy ?? 'admin@viver.com',
    };

    if (this.pool) {
      try {
        await this.pool.query<ResultSetHeader>(
          `INSERT INTO clinica_certificados 
            (id, codigo, aluno_nome, aluno_cpf, aluno_email, curso_titulo, carga_horaria, data_emissao, data_inicio, data_conclusao, status, frente_imagem_url, verso_imagem_url, carimbo_x, carimbo_y, carimbo_font_size, carimbo_align, criado_por, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valid', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.code,
            record.studentName,
            record.studentCpf ?? null,
            record.studentEmail ?? null,
            record.courseTitle,
            record.durationHours,
            record.issueDate,
            record.startDate ?? null,
            record.completionDate ?? null,
            record.frontImageUrl ?? null,
            record.backImageUrl ?? null,
            record.stampX ?? null,
            record.stampY ?? null,
            record.stampFontSize ?? 11,
            record.stampAlign ?? 'center',
            record.createdBy ?? null,
            createdAt.slice(0, 19).replace('T', ' '),
          ]
        );
      } catch (err) {
        console.warn('Erro ao inserir certificado no MySQL, gravado em memória:', err);
      }
    }

    memoryCertificates.set(record.code.toLowerCase(), record);
    return record;
  }

  async atualizarStatus(
    codigo: string,
    novoStatus: CertificateStatus,
    motivo?: string,
    revogadoPor?: string
  ): Promise<boolean> {
    const trimmed = codigo.trim();
    const revokedAt = novoStatus !== 'valid' ? new Date().toISOString() : undefined;

    if (this.pool) {
      try {
        const [res] = await this.pool.query<ResultSetHeader>(
          `UPDATE clinica_certificados 
              SET status = ?, 
                  motivo_revogacao = ?, 
                  revogado_em = ?, 
                  revogado_por = ? 
            WHERE LOWER(codigo) = LOWER(?)`,
          [
            novoStatus,
            motivo ?? null,
            revokedAt ? revokedAt.slice(0, 19).replace('T', ' ') : null,
            revogadoPor ?? null,
            trimmed,
          ]
        );
        if (res.affectedRows > 0) {
          const cached = memoryCertificates.get(trimmed.toLowerCase());
          if (cached) {
            cached.status = novoStatus;
            cached.revocationReason = motivo;
            cached.revokedAt = revokedAt;
            cached.revokedBy = revogadoPor;
          }
          return true;
        }
      } catch (err) {
        console.warn('Erro ao atualizar status no MySQL, atualizando em memória:', err);
      }
    }

    const cached = memoryCertificates.get(trimmed.toLowerCase());
    if (cached) {
      cached.status = novoStatus;
      cached.revocationReason = motivo;
      cached.revokedAt = revokedAt;
      cached.revokedBy = revogadoPor;
      return true;
    }

    return false;
  }

  async obterTemplate(id: string): Promise<CertificateTemplate> {
    const targetId = id || 'default';

    if (this.pool) {
      try {
        const [rows] = await this.pool.query<TemplateRow[]>(
          `SELECT * FROM clinica_certificados_templates WHERE id = ? OR curso_id = ? LIMIT 1`,
          [targetId, targetId]
        );
        if (rows[0]) {
          const r = rows[0];
          let fields = [];
          try {
            fields = typeof r.fields_json === 'string' ? JSON.parse(r.fields_json) : r.fields_json;
          } catch {
            fields = [];
          }
          return {
            id: r.id,
            courseId: r.curso_id,
            name: r.nome,
            backgroundUrl: r.background_url ?? '',
            backgroundType: r.background_type,
            secondBackgroundUrl: r.second_background_url ?? undefined,
            secondBackgroundType: r.second_background_type,
            verificationUrl: r.verification_url,
            hoursOverride: r.hours_override != null ? Number(r.hours_override) : undefined,
            issueDateOverride: r.issue_date_override ?? undefined,
            widthPx: r.width_px,
            heightPx: r.height_px,
            fields: Array.isArray(fields) ? fields : [],
            updatedAt: String(r.atualizado_em),
          };
        }
      } catch (err) {
        console.warn('Erro ao obter template no MySQL, usando fallback:', err);
      }
    }

    const cached = memoryTemplates.get(targetId);
    if (cached) return cached;

    return blankCertificateTemplate(targetId === 'default' ? null : targetId, 'Modelo de Certificado');
  }

  async salvarTemplate(template: CertificateTemplate): Promise<CertificateTemplate> {
    const updatedAt = new Date().toISOString();
    const updated = { ...template, updatedAt };

    if (this.pool) {
      try {
        await this.pool.query<ResultSetHeader>(
          `INSERT INTO clinica_certificados_templates
            (id, curso_id, nome, background_url, background_type, second_background_url, second_background_type, verification_url, hours_override, issue_date_override, width_px, height_px, fields_json, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)
           ON DUPLICATE KEY UPDATE
             nome = VALUES(nome),
             background_url = VALUES(background_url),
             background_type = VALUES(background_type),
             second_background_url = VALUES(second_background_url),
             second_background_type = VALUES(second_background_type),
             verification_url = VALUES(verification_url),
             hours_override = VALUES(hours_override),
             issue_date_override = VALUES(issue_date_override),
             width_px = VALUES(width_px),
             height_px = VALUES(height_px),
             fields_json = VALUES(fields_json),
             atualizado_em = VALUES(atualizado_em)`,
          [
            updated.id,
            updated.courseId ?? null,
            updated.name,
            updated.backgroundUrl || null,
            updated.backgroundType || 'image',
            updated.secondBackgroundUrl || null,
            updated.secondBackgroundType || 'image',
            updated.verificationUrl || 'https://www.vivermaispsicologia.com.br',
            updated.hoursOverride ?? null,
            updated.issueDateOverride ?? null,
            updated.widthPx || 1123,
            updated.heightPx || 794,
            JSON.stringify(updated.fields),
            updatedAt.slice(0, 19).replace('T', ' '),
          ]
        );
      } catch (err) {
        console.warn('Erro ao salvar template no MySQL, salvo em memória:', err);
      }
    }

    memoryTemplates.set(updated.id, updated);
    return updated;
  }
}

export const certificadosRepo = new CertificadosRepository();
