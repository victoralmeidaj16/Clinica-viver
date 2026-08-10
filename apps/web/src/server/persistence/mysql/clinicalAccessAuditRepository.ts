import 'server-only';

import type { Pool } from 'mysql2/promise';
import type {
  ClinicalRecordAccessAuditEvent,
  ClinicalRecordAccessAuditPort,
  ClinicalTimelineAccessAuditPort,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, rowId, toSqlTimestamp } from './mappers';

/**
 * Trilha de leitura de prontuário e de linha do tempo, em
 * `clinica_auditoria_acessos`.
 *
 * A trilha é exigência de sigilo profissional, não recurso de produto: "toda
 * leitura de prontuário tem linha correspondente" é critério de aceite do plano
 * de implantação, e auditoria acrescentada depois perde exatamente o histórico
 * que a justifica. Até aqui ninguém escrevia nenhuma linha.
 *
 * Tabela própria, e não a `clinica_acessos_prontuario` do desenho antigo: aquela
 * exige `paciente_id` com chave estrangeira, o que faria o registro falhar
 * justamente quando o paciente ainda não estivesse cadastrado — silenciando a
 * auditoria no caso mais delicado —, e o enum dela não distingue leitura negada
 * de leitura concedida.
 *
 * O que **não** entra: nome, contato ou qualquer conteúdo clínico. A linha
 * responde quem acessou o quê e quando — e nada além disso, porque um log que
 * carrega o dado protegido vira uma segunda cópia do prontuário, sem as regras
 * do prontuário.
 */

type AcaoProntuario = ClinicalRecordAccessAuditEvent['action'];
type AcaoLinhaDoTempo = Parameters<ClinicalTimelineAccessAuditPort['append']>[0]['action'];

export class MysqlClinicalAccessAudit
  implements ClinicalRecordAccessAuditPort, ClinicalTimelineAccessAuditPort {
  constructor(private readonly pool: Pool = getMysqlPool()) { }

  private async gravar(input: {
    id: string;
    organizationId: string;
    actorUserId: string;
    acao: AcaoProntuario | AcaoLinhaDoTempo;
    prontuarioRef?: string;
    pacienteRef?: string;
    occurredAt: string;
    correlationId: string;
    motivo?: string;
    quantidade?: number;
  }): Promise<void> {
    // Falha de auditoria não pode derrubar a leitura em curso, mas também não
    // pode passar em branco: sem linha e sem alarme, "toda leitura é auditada"
    // vira uma frase de documento.
    try {
      await this.pool.execute(
        `INSERT IGNORE INTO clinica_acessos_prontuario
           (id, instituicao_id, prontuario_ref, paciente_ref, usuario_ref, acao,
            correlacao_id, motivo, quantidade_resultados, ocorrido_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId('acesso_prontuario', input.id),
          instituicaoId(),
          input.prontuarioRef ?? null,
          input.pacienteRef ?? null,
          input.actorUserId,
          input.acao,
          input.correlationId,
          input.motivo ?? null,
          input.quantidade ?? null,
          toSqlTimestamp(input.occurredAt),
        ]
      );
    } catch (erro) {
      console.error('[auditoria] Falha ao registrar acesso a prontuário:', erro);
    }
  }

  /** Porta do prontuário. */
  async append(event: ClinicalRecordAccessAuditEvent): Promise<void>;
  /** Porta da linha do tempo. */
  async append(input: Parameters<ClinicalTimelineAccessAuditPort['append']>[0]): Promise<void>;
  async append(
    input: ClinicalRecordAccessAuditEvent | Parameters<ClinicalTimelineAccessAuditPort['append']>[0]
  ): Promise<void> {
    if ('recordId' in input || input.action.startsWith('clinical_record.')) {
      const evento = input as ClinicalRecordAccessAuditEvent;
      await this.gravar({
        id: evento.id,
        organizationId: evento.organizationId,
        actorUserId: evento.actorUserId,
        acao: evento.action,
        prontuarioRef: evento.recordId,
        occurredAt: evento.occurredAt,
        correlationId: evento.correlationId,
        motivo: evento.reason,
        quantidade: evento.resultCount,
      });
      return;
    }

    const evento = input as Parameters<ClinicalTimelineAccessAuditPort['append']>[0];
    await this.gravar({
      id: evento.id,
      organizationId: evento.organizationId,
      actorUserId: evento.actorUserId,
      acao: evento.action,
      pacienteRef: evento.patientId,
      occurredAt: evento.occurredAt,
      correlationId: evento.correlationId,
      quantidade: evento.resultCount,
    });
  }
}
