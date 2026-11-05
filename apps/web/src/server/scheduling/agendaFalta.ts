import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import {
  patientSessionPricingFromRow,
  resolvePatientSessionAmountCents,
} from '@/server/persistence/mysql/patientSessionPricing';

export type ResultadoRegistroFalta =
  | 'recorded'
  | 'not_found'
  | 'stale'
  /** A falta só existe depois do início agendado: antes disso o paciente ainda pode chegar. */
  | 'too_early'
  | 'invalid_status'
  /** Isentar sessão já paga exigiria estorno, que não é decidido por este fluxo. */
  | 'charge_settled'
  | 'missing_amount';

/** O pool usa `dateStrings`: o banco devolve UTC sem fuso, e `new Date` leria como hora local. */
function instanteDoBanco(valor: string | Date): number {
  return Date.parse(fromSqlTimestamp(valor)!);
}

function valorDaFalta(row: RowDataPacket): number | null {
  try {
    return resolvePatientSessionAmountCents({
      pricing: patientSessionPricingFromRow({
        categoria_valor_sessao: row.categoria_valor_sessao,
        valor_sessao_personalizado_centavos: row.valor_sessao_personalizado_centavos,
      }),
      triageMode: row.modalidade_triagem,
      socialAmountCents: row.valor_social_centavos,
      standardAmountCents: row.valor_sessao_centavos,
    });
  } catch {
    return null;
  }
}

/**
 * Registra a falta e prepara a linha para a decisão de cobrança.
 *
 * A falta nunca entra na fatura da empresa nem consome a cota do convênio: se a
 * sessão for cobrada, a cobrança é individual do paciente. O movimento financeiro
 * em si acontece depois do commit, porque cobrança e provedor travam esta mesma
 * linha. Repetir o registro retoma o financeiro e permite rever a decisão, por
 * isso uma falta já gravada não confere a versão vista pelo formulário.
 */
export async function registrarFaltaDoAgendamento(
  organizationId: string,
  professionalId: string,
  appointmentId: string,
  input: { cobrar: boolean; expectedVersion?: number },
  agora: Date = new Date()
): Promise<ResultadoRegistroFalta> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id, a.ref_core, a.status, a.versao, a.modalidade, a.inicio, a.sessao_clinica_ref,
              a.valor_centavos, a.cobranca_vence_em,
              COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) AS fim,
              p.ref_core AS profissional_ref, p.valor_sessao_centavos, p.valor_social_centavos,
              o.ref_core AS organizacao_ref,
              pa.ref_core AS paciente_ref, pa.categoria_valor_sessao, pa.valor_sessao_personalizado_centavos,
              (SELECT t.modalidade FROM clinica_triagens_pacientes t
                WHERE t.instituicao_id = a.instituicao_id AND t.organizacao_ref = o.ref_core
                  AND t.paciente_ref = pa.ref_core
                ORDER BY t.atualizado_em DESC LIMIT 1) AS modalidade_triagem
         FROM clinica_agendamentos a
         JOIN clinica_profissionais p ON p.id = a.profissional_id
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
         JOIN clinica_pacientes pa ON pa.id = a.paciente_id
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
          AND (a.id = ? OR a.ref_core = ?)
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), organizationId, professionalId, appointmentId, appointmentId]
    );
    const agendamento = rows[0];
    const recusar = async (resultado: ResultadoRegistroFalta) => {
      await connection.rollback();
      return resultado;
    };
    if (!agendamento) return await recusar('not_found');

    const status = String(agendamento.status);
    const jaRegistrada = status === 'faltou';
    if (!jaRegistrada && !['agendado', 'confirmado'].includes(status)) return await recusar('invalid_status');
    if (!jaRegistrada && input.expectedVersion !== undefined
        && input.expectedVersion !== Number(agendamento.versao)) return await recusar('stale');
    if (instanteDoBanco(agendamento.inicio) > agora.getTime()) return await recusar('too_early');

    const sessionRef = String(agendamento.sessao_clinica_ref || `session-${String(agendamento.ref_core)}`);
    const [cobrancas] = await connection.query<RowDataPacket[]>(
      `SELECT c.ref_core, c.status,
              EXISTS(SELECT 1 FROM financeiro_pagamentos pg
                WHERE pg.instituicao_id = c.instituicao_id AND pg.organizacao_ref = c.organizacao_ref
                  AND pg.cobranca_ref = c.ref_core AND pg.status = 'confirmed') AS possui_pagamento
         FROM financeiro_cobrancas c
        WHERE c.instituicao_id = ? AND c.organizacao_ref = ? AND c.sessao_ref IN (?, ?)
          AND c.status <> 'cancelled'
        FOR UPDATE`,
      [instituicaoId(), agendamento.organizacao_ref, agendamento.ref_core, sessionRef]
    );
    const possuiPagamento = cobrancas.some((cobranca) => Boolean(cobranca.possui_pagamento)
      || ['paid', 'partially_paid', 'refunded'].includes(String(cobranca.status)));
    if (!input.cobrar && possuiPagamento) return await recusar('charge_settled');

    const campos: string[] = [];
    const valores: (string | number)[] = [];
    if (input.cobrar && cobrancas.length === 0) {
      if (agendamento.valor_centavos === null || agendamento.valor_centavos === undefined) {
        const valor = valorDaFalta(agendamento);
        if (valor === null) return await recusar('missing_amount');
        campos.push('valor_centavos = ?');
        valores.push(valor);
      }
      // Um vencimento vencido faria a cobrança nascer sem ter como ser paga.
      if (agendamento.cobranca_vence_em
          && instanteDoBanco(agendamento.cobranca_vence_em) <= agora.getTime()) {
        campos.push('cobranca_vence_em = NULL');
      }
    }

    if (!jaRegistrada) {
      campos.push("status = 'faltou'", 'custeado_pela_empresa = 0', 'sessao_clinica_ref = ?', 'versao = versao + 1');
      valores.push(sessionRef);
      // Sem conteúdo clínico: é o fato da ausência, contado nos indicadores mensais.
      const step = { status: 'skipped', attemptCount: 0, updatedAt: agora.toISOString() };
      const modo = agendamento.modalidade === 'online'
        ? 'video'
        : agendamento.modalidade === 'telefone' ? 'phone' : 'in_person';
      await connection.execute(
        `INSERT IGNORE INTO clinica_sessoes
           (id, instituicao_id, organizacao_ref, ref_core, paciente_ref,
            profissional_principal_ref, profissionais_atribuidos, status, modalidade,
            inicio_previsto, fim_previsto, consentimentos,
            automacao_plano, automacao_estado, cobranca_ref, versao, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'no_show', ?, ?, ?,
                 CAST('[]' AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, 1, ?, ?)`,
        [
          rowId('sessao_clinica', sessionRef), instituicaoId(), agendamento.organizacao_ref,
          sessionRef, agendamento.paciente_ref, agendamento.profissional_ref,
          JSON.stringify([agendamento.profissional_ref]), modo, agendamento.inicio, agendamento.fim,
          JSON.stringify({ transcription: false, patientHandoff: false, billing: false, receipt: false, notification: false }),
          JSON.stringify({ transcription: step, clinicalDraft: step, patientHandoff: step, billing: step, receipt: step, notification: step }),
          cobrancas[0]?.ref_core ?? null, agora, agora,
        ]
      );
    }

    if (campos.length > 0) {
      await connection.execute(
        `UPDATE clinica_agendamentos
            SET ${campos.join(', ')}, atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND id = ?`,
        [...valores, instituicaoId(), agendamento.id]
      );
    }
    await connection.commit();
    return 'recorded';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Situação da cobrança depois de registrar a falta.
 *
 * `vencida` usa o mesmo critério do link público, que recusa o pagamento quando
 * o prazo passou. Cobrança com pagamento fica de fora: não há prazo a renovar.
 */
export async function situacaoCobrancaDaFalta(
  organizationId: string,
  professionalId: string,
  appointmentId: string,
  agora: Date = new Date()
): Promise<{ ativa: boolean; vencida: boolean }> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT c.status, c.vence_em
       FROM clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
       JOIN financeiro_cobrancas c ON c.instituicao_id = a.instituicao_id
        AND c.organizacao_ref = o.ref_core
        AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
        AND (a.id = ? OR a.ref_core = ?) AND c.status <> 'cancelled'`,
    [instituicaoId(), organizationId, professionalId, appointmentId, appointmentId]
  );
  return {
    ativa: rows.length > 0,
    vencida: rows.some((cobranca) => cobranca.status === 'overdue'
      || (['draft', 'pending'].includes(String(cobranca.status))
        && instanteDoBanco(cobranca.vence_em) <= agora.getTime())),
  };
}
