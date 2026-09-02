import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import {
  disponibilidadePadraoDoCadastro,
  FUSO_CLINICA,
  gerarSlots,
  type IntervaloOcupado,
  type JanelaDisponibilidade,
  type Slot,
} from '@thats-life/core';
import { podeConfirmarRealizacao } from '@/lib/appointmentWorkflow';
import { descricaoFiscalDaSessao } from '@/lib/sessionReference';

/**
 * Agenda: janelas recorrentes, bloqueios e marcação pública.
 *
 * Segue o desenho do link de pagamento — SQL direto, sem passar pelo agregado
 * de `@thats-life/core`. O agregado exige ator de equipe autorizado e chave de
 * idempotência por comando, e quem marca aqui é o paciente pelo link, que não
 * tem sessão nem papel. O que não abre mão é da unicidade de horário, e essa
 * mora no índice `clinica_agendamentos_slot_uq`, não nesta camada.
 */

export interface AgendaProfile {
  token: string;
  organizationId: string;
  professionalId: string;
  professionalName: string;
}

export interface PacienteIdentificado {
  patientRef: string;
  patientRowId: string;
  nome: string;
  organizationId: string;
  professionalId: string;
  professionalRowId: string;
  professionalName: string;
  sessionAmountCents: number;
}

export interface BloqueioAgenda {
  id: string;
  inicio: string;
  fim: string;
  motivo?: string;
  /** `dia` é férias/folga e tira do rodízio; `horario` é um buraco na agenda. */
  tipo: 'dia' | 'horario';
}

export interface AgendamentoResumo {
  id: string;
  pacienteNome: string;
  inicio: string;
  fim: string;
  modalidade: 'presencial' | 'online' | 'telefone';
  status: string;
  origem: string;
  criadoEm: string;
  realizadoEm?: string;
  linkPagamento: string;
  pagamentoStatus?: string;
  vencimentoCobrancaEm?: string;
  custeadoPelaEmpresa: boolean;
  convenioNome?: string;
  podeConfirmarRealizacao: boolean;
}

interface ProfileRow extends RowDataPacket {
  token_link_agenda: string;
  organizacao_ref: string;
  organizacao_id: string;
  profissional_ref: string;
  profissional_id: string;
  nome: string;
}

const PROFILE_SELECT = `
  SELECT p.token_link_agenda, o.ref_core AS organizacao_ref, o.id AS organizacao_id,
         p.ref_core AS profissional_ref, p.id AS profissional_id, p.nome
    FROM clinica_profissionais p
    JOIN clinica_organizacoes o ON o.id = p.organizacao_id
   WHERE p.instituicao_id = ? AND p.ativo = 1`;

function perfil(row: ProfileRow): AgendaProfile {
  return {
    token: row.token_link_agenda,
    organizationId: row.organizacao_ref,
    professionalId: row.profissional_ref,
    professionalName: row.nome,
  };
}

export async function getPublicAgendaProfile(token: string): Promise<AgendaProfile | null> {
  const [rows] = await getMysqlPool().query<ProfileRow[]>(
    `${PROFILE_SELECT} AND p.token_link_agenda = ? LIMIT 1`,
    [instituicaoId(), token]
  );
  return rows[0] ? perfil(rows[0]) : null;
}

/**
 * Token do profissional logado, criado na primeira leitura.
 *
 * A migração preenche os cadastros existentes; este caminho cobre o
 * profissional credenciado depois dela, que abriria a aba Agenda sem link.
 */
export async function getProfessionalAgendaProfile(
  organizationId: string,
  professionalId: string
): Promise<AgendaProfile | null> {
  const pool = getMysqlPool();
  const consulta = () =>
    pool.query<ProfileRow[]>(`${PROFILE_SELECT} AND o.ref_core = ? AND p.ref_core = ? LIMIT 1`, [
      instituicaoId(),
      organizationId,
      professionalId,
    ]);

  let [rows] = await consulta();
  if (!rows[0]) return null;
  if (!rows[0].token_link_agenda) {
    await pool.execute(
      `UPDATE clinica_profissionais SET token_link_agenda = ?
        WHERE instituicao_id = ? AND ref_core = ? AND token_link_agenda IS NULL`,
      [randomUUID().replaceAll('-', ''), instituicaoId(), professionalId]
    );
    [rows] = await consulta();
  }
  return rows[0] ? perfil(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Janelas de disponibilidade
// ---------------------------------------------------------------------------

export interface JanelaEditavel {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  duracaoMin: number;
  modalidade: 'presencial' | 'online';
}

interface PreferenciasAgendaRow extends RowDataPacket {
  turnos_disponiveis: unknown;
  modalidade_atendimento: string | null;
}

function listaJson(valor: unknown): string[] {
  let dados = valor;
  if (typeof valor === 'string') {
    try {
      dados = JSON.parse(valor) as unknown;
    } catch {
      dados = [];
    }
  }
  return Array.isArray(dados)
    ? dados.filter((item): item is string => typeof item === 'string')
    : [];
}

async function disponibilidadePadrao(professionalId: string): Promise<JanelaEditavel[]> {
  const [rows] = await getMysqlPool().query<PreferenciasAgendaRow[]>(
    `SELECT turnos_disponiveis, modalidade_atendimento
       FROM clinica_cadastros_psicologos
      WHERE instituicao_id = ? AND profissional_ref = ?
      ORDER BY atualizado_em DESC
      LIMIT 1`,
    [instituicaoId(), professionalId]
  );
  return disponibilidadePadraoDoCadastro({
    turnos: listaJson(rows[0]?.turnos_disponiveis),
    modalidadeAtendimento: rows[0]?.modalidade_atendimento ?? undefined,
  });
}

export async function listAvailability(
  organizationId: string,
  professionalId: string
): Promise<JanelaEditavel[]> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT d.dia_semana, d.hora_inicio, d.hora_fim, d.duracao_min, d.modalidade
       FROM clinica_disponibilidades d
       JOIN clinica_profissionais p ON p.id = d.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
      WHERE d.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
      ORDER BY d.dia_semana, d.hora_inicio`,
    [instituicaoId(), organizationId, professionalId]
  );
  if (rows.length === 0) {
    return disponibilidadePadrao(professionalId);
  }
  return rows.map((row) => ({
    diaSemana: Number(row.dia_semana),
    horaInicio: String(row.hora_inicio).slice(0, 5),
    horaFim: String(row.hora_fim).slice(0, 5),
    duracaoMin: Number(row.duracao_min),
    modalidade: row.modalidade === 'online' ? 'online' : 'presencial',
  }));
}

/**
 * Substitui o quadro semanal inteiro.
 *
 * Enviar a grade completa em vez de um diff é o que faz a tela e o banco não
 * divergirem: o profissional arrasta linhas para dentro e para fora do quadro,
 * e reconstruir a diferença no cliente daria a ele a chance de errar.
 * Agendamentos já marcados não são tocados — o horário combinado com um
 * paciente não desaparece porque a janela recorrente mudou.
 */
export async function replaceAvailability(
  organizationId: string,
  professionalId: string,
  janelas: readonly JanelaEditavel[]
): Promise<void> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [profRows] = await connection.query<RowDataPacket[]>(
      `SELECT p.id FROM clinica_profissionais p
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        WHERE p.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ? LIMIT 1`,
      [instituicaoId(), organizationId, professionalId]
    );
    const profissionalRowId = profRows[0]?.id as string | undefined;
    if (!profissionalRowId) throw new Error('Perfil profissional não encontrado.');

    await connection.execute(
      'DELETE FROM clinica_disponibilidades WHERE instituicao_id = ? AND profissional_id = ?',
      [instituicaoId(), profissionalRowId]
    );
    for (const janela of janelas) {
      await connection.execute(
        `INSERT INTO clinica_disponibilidades
           (id, instituicao_id, profissional_id, dia_semana, hora_inicio, hora_fim,
            duracao_min, modalidade)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          instituicaoId(),
          profissionalRowId,
          janela.diaSemana,
          `${janela.horaInicio}:00`,
          `${janela.horaFim}:00`,
          janela.duracaoMin,
          janela.modalidade,
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ---------------------------------------------------------------------------
// Bloqueios
// ---------------------------------------------------------------------------

export async function listBlocks(
  organizationId: string,
  professionalId: string
): Promise<BloqueioAgenda[]> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT b.id, b.inicio, b.fim, b.motivo, b.tipo
       FROM clinica_agenda_bloqueios b
       JOIN clinica_profissionais p ON p.id = b.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
      WHERE b.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
        AND b.fim >= UTC_TIMESTAMP(3)
      ORDER BY b.inicio`,
    [instituicaoId(), organizationId, professionalId]
  );
  return rows.map((row) => ({
    id: String(row.id),
    inicio: new Date(row.inicio).toISOString(),
    fim: new Date(row.fim).toISOString(),
    motivo: row.motivo ? String(row.motivo) : undefined,
    tipo: row.tipo === 'dia' ? 'dia' : 'horario',
  }));
}

export async function createBlock(
  organizationId: string,
  professionalId: string,
  input: { inicio: string; fim: string; motivo?: string; tipo?: 'dia' | 'horario' }
): Promise<'created' | 'appointment_conflict' | 'block_conflict'> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [profRows] = await connection.query<RowDataPacket[]>(
      `SELECT p.id FROM clinica_profissionais p
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        WHERE p.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), organizationId, professionalId]
    );
    const profissionalRowId = profRows[0]?.id as string | undefined;
    if (!profissionalRowId) throw new Error('Perfil profissional não encontrado.');

    const parametros = [
      instituicaoId(), profissionalRowId, new Date(input.fim), new Date(input.inicio),
    ];
    const [agendamentos] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM clinica_agendamentos
        WHERE instituicao_id = ? AND profissional_id = ? AND status <> 'cancelado'
          AND inicio < ? AND COALESCE(fim, DATE_ADD(inicio, INTERVAL duracao_min MINUTE)) > ?
        LIMIT 1 FOR UPDATE`,
      parametros
    );
    if (agendamentos.length > 0) {
      await connection.rollback();
      return 'appointment_conflict';
    }

    const [bloqueios] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM clinica_agenda_bloqueios
        WHERE instituicao_id = ? AND profissional_id = ? AND inicio < ? AND fim > ?
        LIMIT 1 FOR UPDATE`,
      parametros
    );
    if (bloqueios.length > 0) {
      await connection.rollback();
      return 'block_conflict';
    }

    await connection.execute(
      `INSERT INTO clinica_agenda_bloqueios
         (id, instituicao_id, profissional_id, inicio, fim, motivo, tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), instituicaoId(), profissionalRowId, new Date(input.inicio),
        new Date(input.fim), input.motivo?.trim() || null, input.tipo ?? 'horario']
    );
    await connection.commit();
    return 'created';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteBlock(
  organizationId: string,
  professionalId: string,
  blockId: string
): Promise<void> {
  // O `JOIN` na cláusula é o que impede um psicólogo de apagar o bloqueio de
  // outro passando um id que não é dele.
  await getMysqlPool().execute(
    `DELETE b FROM clinica_agenda_bloqueios b
       JOIN clinica_profissionais p ON p.id = b.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
      WHERE b.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ? AND b.id = ?`,
    [instituicaoId(), organizationId, professionalId, blockId]
  );
}

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------

export async function listAppointments(
  organizationId: string,
  professionalId: string,
  desde: Date,
  agora: Date = new Date()
): Promise<AgendamentoResumo[]> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id, a.inicio, a.fim, a.duracao_min, a.modalidade, a.status,
            a.origem_criacao, a.criado_em, a.realizado_em, a.token_pagamento_sessao,
            COALESCE(pa.nome_social, pa.nome) AS paciente_nome,
            conv.nome AS convenio_nome,
            CASE WHEN pa.convenio_ref IS NULL THEN 0
                 ELSE COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) END
              AS custeado_pela_empresa,
            (SELECT c.status FROM financeiro_cobrancas c
              WHERE c.instituicao_id = a.instituicao_id
                AND c.organizacao_ref = o.ref_core
                AND c.sessao_ref IN (a.ref_core, a.sessao_clinica_ref)
              ORDER BY c.criado_em DESC LIMIT 1) AS pagamento_status
            ,(SELECT c.vence_em FROM financeiro_cobrancas c
              WHERE c.instituicao_id = a.instituicao_id
                AND c.organizacao_ref = o.ref_core
                AND c.sessao_ref IN (a.ref_core, a.sessao_clinica_ref)
              ORDER BY c.criado_em DESC LIMIT 1) AS vencimento_cobranca_em
       FROM clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
       LEFT JOIN clinica_convenios conv
         ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
        AND conv.ref_core = pa.convenio_ref
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
        AND (a.inicio >= ? OR a.status IN ('agendado', 'confirmado'))
      ORDER BY a.inicio
      LIMIT 200`,
    [instituicaoId(), organizationId, professionalId, desde]
  );
  return rows.map((row) => {
    const fim = new Date(
      row.fim ?? new Date(row.inicio).getTime() + Number(row.duracao_min) * 60_000
    );
    const status = String(row.status);
    return {
      id: String(row.id),
      pacienteNome: String(row.paciente_nome ?? 'Paciente'),
      inicio: new Date(row.inicio).toISOString(),
      fim: fim.toISOString(),
      modalidade: row.modalidade,
      status,
      origem: String(row.origem_criacao),
      criadoEm: new Date(row.criado_em).toISOString(),
      realizadoEm: row.realizado_em ? new Date(row.realizado_em).toISOString() : undefined,
      linkPagamento: `/pagar/sessao/${String(row.token_pagamento_sessao)}`,
      pagamentoStatus: row.pagamento_status ? String(row.pagamento_status) : undefined,
      vencimentoCobrancaEm: row.vencimento_cobranca_em ? new Date(row.vencimento_cobranca_em).toISOString() : undefined,
      custeadoPelaEmpresa: Boolean(row.custeado_pela_empresa),
      convenioNome: row.convenio_nome ? String(row.convenio_nome) : undefined,
      podeConfirmarRealizacao: podeConfirmarRealizacao(status, fim, agora),
    };
  });
}

export type ResultadoConfirmacaoRealizacao =
  | 'completed'
  | 'too_early'
  | 'not_found'
  | 'invalid_status';

/** Confirma o atendimento somente depois do fim previsto e dentro do perfil dono da agenda. */
export async function completeAppointment(
  organizationId: string,
  professionalId: string,
  appointmentId: string,
  agora: Date = new Date()
): Promise<ResultadoConfirmacaoRealizacao> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.ref_core, a.sessao_clinica_ref, a.status, a.inicio, a.modalidade,
              a.valor_centavos, p.valor_sessao_centavos,
              o.ref_core AS organizacao_ref, pa.ref_core AS paciente_ref,
              p.ref_core AS profissional_ref,
              conv.nome AS convenio_nome,
              CASE WHEN pa.convenio_ref IS NULL THEN 0
                   ELSE COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) END
                AS custeado_pela_empresa,
              COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) AS fim,
              (SELECT c.ref_core FROM financeiro_cobrancas c
                WHERE c.instituicao_id = a.instituicao_id
                  AND c.organizacao_ref = o.ref_core AND c.sessao_ref = a.ref_core
                ORDER BY c.criado_em DESC LIMIT 1) AS cobranca_ref
         FROM clinica_agendamentos a
         JOIN clinica_profissionais p ON p.id = a.profissional_id
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
         JOIN clinica_pacientes pa ON pa.id = a.paciente_id
         LEFT JOIN clinica_convenios conv
           ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
          AND conv.ref_core = pa.convenio_ref
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ? AND a.id = ?
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), organizationId, professionalId, appointmentId]
    );
    const appointment = rows[0];
    if (!appointment) {
      await connection.rollback();
      return 'not_found';
    }
    if (!['agendado', 'confirmado'].includes(String(appointment.status))) {
      await connection.rollback();
      return 'invalid_status';
    }
    if (new Date(appointment.fim).getTime() > agora.getTime()) {
      await connection.rollback();
      return 'too_early';
    }

    // A confirmação operacional também materializa a sessão clínica usada
    // pelos indicadores e pela competência fiscal. Não há conteúdo clínico:
    // é apenas o fato de atendimento, sua janela e seus vínculos.
    const sessionRef = String(
      appointment.sessao_clinica_ref || `session-${String(appointment.ref_core)}`
    );
    const step = { status: 'skipped', attemptCount: 0, updatedAt: agora.toISOString() };
    const automation = {
      transcription: step,
      clinicalDraft: step,
      patientHandoff: step,
      billing: step,
      receipt: step,
      notification: step,
    };
    const mode = appointment.modalidade === 'online'
      ? 'video'
      : appointment.modalidade === 'telefone' ? 'phone' : 'in_person';
    await connection.execute(
      `INSERT IGNORE INTO clinica_sessoes
         (id, instituicao_id, organizacao_ref, ref_core, paciente_ref,
          profissional_principal_ref, profissionais_atribuidos, status, modalidade,
          inicio_previsto, fim_previsto, inicio_real, fim_real, consentimentos,
          automacao_plano, automacao_estado, cobranca_ref, versao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'completed', ?, ?, ?, ?, ?,
               CAST('[]' AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, 1, ?, ?)`,
      [
        rowId('sessao_clinica', sessionRef), instituicaoId(), appointment.organizacao_ref,
        sessionRef, appointment.paciente_ref, appointment.profissional_ref,
        JSON.stringify([appointment.profissional_ref]), mode, appointment.inicio,
        appointment.fim, appointment.inicio, appointment.fim,
        JSON.stringify({ transcription: false, patientHandoff: false, billing: false,
          receipt: false, notification: false }),
        JSON.stringify(automation), appointment.cobranca_ref ?? null, agora, agora,
      ]
    );
    await connection.execute(
      `UPDATE clinica_agendamentos
          SET status = 'realizado', realizado_em = ?, sessao_clinica_ref = ?,
              versao = versao + 1, atualizado_em = ?
        WHERE instituicao_id = ? AND id = ?`,
      [agora, sessionRef, agora, instituicaoId(), appointmentId]
    );
    if (Boolean(appointment.custeado_pela_empresa) && !appointment.cobranca_ref) {
      const amountCents = Number(appointment.valor_centavos ?? appointment.valor_sessao_centavos);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new Error('O valor da sessão custeada não está configurado no perfil profissional.');
      }
      const chargeRef = `charge-company-session-${randomUUID()}`;
      await connection.execute(
        `INSERT INTO financeiro_cobrancas
          (id, instituicao_id, organizacao_ref, ref_core, sessao_ref, paciente_ref,
           profissional_ref, emitida_em, vence_em, valor_centavos, status,
           descricao, fatura_convenio_ref, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?)`,
        [rowId('cobranca', chargeRef), instituicaoId(), appointment.organizacao_ref,
          chargeRef, sessionRef, appointment.paciente_ref, appointment.profissional_ref,
          agora, agora, amountCents, descricaoFiscalDaSessao(new Date(appointment.inicio).toISOString()),
          agora, agora]
      );
      await connection.execute(
        `UPDATE clinica_sessoes SET cobranca_ref = ?, atualizado_em = ?
          WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ? AND cobranca_ref IS NULL`,
        [chargeRef, agora, instituicaoId(), appointment.organizacao_ref, sessionRef]
      );
    }
    await connection.commit();
    return 'completed';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelAppointment(
  organizationId: string,
  professionalId: string,
  appointmentId: string,
  motivo: string
): Promise<boolean> {
  const [result] = await getMysqlPool().execute(
    `UPDATE clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        SET a.status = 'cancelado', a.cancelado_motivo = ?,
            a.atualizado_em = CURRENT_TIMESTAMP(3)
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
        AND a.id = ? AND a.status <> 'cancelado'`,
    [motivo, instituicaoId(), organizationId, professionalId, appointmentId]
  );
  return (result as { affectedRows: number }).affectedRows > 0;
}

export async function rescheduleAppointmentProfessional(
  organizationId: string,
  professionalId: string,
  appointmentId: string,
  startsAtIso: string,
  endsAtIso: string
): Promise<'ok' | 'not_found' | 'conflict'> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id, a.ref_core, a.profissional_id
         FROM clinica_agendamentos a
         JOIN clinica_profissionais p ON p.id = a.profissional_id
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
          AND (a.id = ? OR a.ref_core = ?) AND a.status IN ('agendado', 'confirmado')
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), organizationId, professionalId, appointmentId, appointmentId]
    );
    const agendamento = rows[0];
    if (!agendamento) {
      await connection.rollback();
      return 'not_found';
    }

    const novoInicio = new Date(startsAtIso);
    const novoFim = new Date(endsAtIso);

    const [conflitos] = await connection.query<RowDataPacket[]>(
      `SELECT a.id FROM clinica_agendamentos a
        WHERE a.instituicao_id = ? AND a.profissional_id = ? AND a.status <> 'cancelado'
          AND a.id <> ?
          AND a.inicio < ? AND COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) > ?
        FOR UPDATE`,
      [instituicaoId(), agendamento.profissional_id, agendamento.id, novoFim, novoInicio]
    );
    if (conflitos.length > 0) {
      await connection.rollback();
      return 'conflict';
    }

    const [bloqueios] = await connection.query<RowDataPacket[]>(
      `SELECT b.id FROM clinica_agenda_bloqueios b
        WHERE b.instituicao_id = ? AND b.profissional_id = ?
          AND b.inicio < ? AND b.fim > ?
        FOR UPDATE`,
      [instituicaoId(), agendamento.profissional_id, novoFim, novoInicio]
    );
    if (bloqueios.length > 0) {
      await connection.rollback();
      return 'conflict';
    }

    await connection.execute(
      `UPDATE clinica_agendamentos
          SET inicio = ?, fim = ?, status = 'agendado', versao = versao + 1, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND id = ?`,
      [novoInicio, novoFim, instituicaoId(), agendamento.id]
    );

    await connection.execute(
      `UPDATE financeiro_cobrancas
          SET vencimento_em = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND sessao_ref IN (?, ?) AND status IN ('pending', 'overdue')`,
      [novoInicio, instituicaoId(), agendamento.id, agendamento.ref_core]
    );

    await connection.commit();
    return 'ok';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export interface UpdateAppointmentInput {
  startsAt?: string;
  endsAt?: string;
  modalidade?: 'online' | 'presencial' | 'telefone';
  status?: 'agendado' | 'confirmado' | 'realizado' | 'cancelado';
}

export async function updateAppointmentDetails(
  organizationId: string,
  professionalId: string,
  appointmentId: string,
  input: UpdateAppointmentInput
): Promise<'ok' | 'not_found' | 'conflict'> {
  if (!isMysqlConfigured()) {
    return 'ok';
  }
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id, a.ref_core, a.profissional_id, a.status, a.inicio, a.fim, a.duracao_min, a.modalidade
         FROM clinica_agendamentos a
         JOIN clinica_profissionais p ON p.id = a.profissional_id
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
          AND (a.id = ? OR a.ref_core = ?)
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), organizationId, professionalId, appointmentId, appointmentId]
    );
    const agendamento = rows[0];
    if (!agendamento) {
      await connection.rollback();
      return 'not_found';
    }

    let novoInicio = agendamento.inicio ? new Date(agendamento.inicio) : null;
    let novoFim = agendamento.fim ? new Date(agendamento.fim) : null;
    let novoDuracao = agendamento.duracao_min ? Number(agendamento.duracao_min) : 50;

    if (input.startsAt) {
      novoInicio = new Date(input.startsAt);
      if (input.endsAt) {
        novoFim = new Date(input.endsAt);
        novoDuracao = Math.round((novoFim.getTime() - novoInicio.getTime()) / 60_000);
      } else {
        novoFim = new Date(novoInicio.getTime() + novoDuracao * 60_000);
      }

      // Conflitos de agendamento (apenas se horário estiver ativo)
      const [conflitos] = await connection.query<RowDataPacket[]>(
        `SELECT a.id FROM clinica_agendamentos a
          WHERE a.instituicao_id = ? AND a.profissional_id = ? AND a.status <> 'cancelado'
            AND a.id <> ?
            AND a.inicio < ? AND COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) > ?
          FOR UPDATE`,
        [instituicaoId(), agendamento.profissional_id, agendamento.id, novoFim, novoInicio]
      );
      if (conflitos.length > 0) {
        await connection.rollback();
        return 'conflict';
      }

      // Conflitos de bloqueio
      const [bloqueios] = await connection.query<RowDataPacket[]>(
        `SELECT b.id FROM clinica_agenda_bloqueios b
          WHERE b.instituicao_id = ? AND b.profissional_id = ?
            AND b.inicio < ? AND b.fim > ?
          FOR UPDATE`,
        [instituicaoId(), agendamento.profissional_id, novoFim, novoInicio]
      );
      if (bloqueios.length > 0) {
        await connection.rollback();
        return 'conflict';
      }
    }

    const updates: string[] = ['versao = versao + 1', 'atualizado_em = CURRENT_TIMESTAMP(3)'];
    const values: any[] = [];

    if (input.startsAt && novoInicio && novoFim) {
      updates.push('inicio = ?', 'fim = ?', 'duracao_min = ?');
      values.push(novoInicio, novoFim, novoDuracao);
    }

    if (input.modalidade) {
      updates.push('modalidade = ?');
      values.push(input.modalidade);
    }

    if (input.status) {
      updates.push('status = ?');
      values.push(input.status);
      if (input.status === 'realizado') {
        updates.push('realizado_em = COALESCE(realizado_em, CURRENT_TIMESTAMP(3))');
      } else if (input.status === 'agendado') {
        updates.push('realizado_em = NULL');
      }
    }

    values.push(instituicaoId(), agendamento.id);

    await connection.execute(
      `UPDATE clinica_agendamentos SET ${updates.join(', ')} WHERE instituicao_id = ? AND id = ?`,
      values
    );

    if (input.startsAt && novoInicio) {
      await connection.execute(
        `UPDATE financeiro_cobrancas
            SET vencimento_em = ?, atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE instituicao_id = ? AND sessao_ref IN (?, ?) AND status IN ('pending', 'overdue')`,
        [novoInicio, instituicaoId(), agendamento.id, agendamento.ref_core]
      );
    }

    await connection.commit();
    return 'ok';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ---------------------------------------------------------------------------
// Contatos da sessão — o que os avisos de WhatsApp precisam saber
// ---------------------------------------------------------------------------

export interface ContatosDaSessao {
  agendamentoId: string;
  inicio: string;
  fim: string;
  modalidade: 'presencial' | 'online' | 'telefone';
  status: string;
  pacienteNome: string;
  pacienteTelefone: string | null;
  profissionalNome: string;
  profissionalTelefone: string | null;
}

const CONTATOS_SELECT = `
  SELECT a.id, a.inicio, a.status, a.modalidade, a.duracao_min,
         COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) AS fim,
         COALESCE(pa.nome_social, pa.nome) AS paciente_nome, pa.telefone AS paciente_telefone,
         p.nome AS profissional_nome, p.telefone AS profissional_telefone
    FROM clinica_agendamentos a
    JOIN clinica_pacientes pa ON pa.id = a.paciente_id
    JOIN clinica_profissionais p ON p.id = a.profissional_id`;

function contatos(row: RowDataPacket): ContatosDaSessao {
  return {
    agendamentoId: String(row.id),
    inicio: new Date(row.inicio).toISOString(),
    fim: new Date(row.fim).toISOString(),
    modalidade: row.modalidade,
    status: String(row.status),
    pacienteNome: String(row.paciente_nome ?? 'Paciente'),
    pacienteTelefone: row.paciente_telefone ? String(row.paciente_telefone) : null,
    profissionalNome: String(row.profissional_nome ?? 'Profissional'),
    profissionalTelefone: row.profissional_telefone ? String(row.profissional_telefone) : null,
  };
}

export async function getContatosDaSessao(agendamentoId: string): Promise<ContatosDaSessao | null> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `${CONTATOS_SELECT} WHERE a.instituicao_id = ? AND a.id = ? LIMIT 1`,
    [instituicaoId(), agendamentoId]
  );
  return rows[0] ? contatos(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Fluxo público: identificação por CPF, horários livres e marcação
// ---------------------------------------------------------------------------

/**
 * Cruza o CPF digitado com os pacientes vinculados ao dono do link.
 *
 * É o mesmo cruzamento do checkout de pagamento: a triagem guarda o CPF, e o
 * vínculo com o profissional é o que autoriza. Um CPF válido que não é
 * paciente deste psicólogo não recebe agenda nenhuma.
 */
export async function identifyPatient(
  token: string,
  cpf: string
): Promise<PacienteIdentificado | null> {
  const cleanCpf = cpf.replace(/\D/g, '');
  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.ref_core AS organizacao_ref, p.ref_core AS profissional_ref,
            p.id AS profissional_id, p.nome AS profissional_nome,
            p.valor_social_centavos, p.valor_sessao_centavos,
            pa.ref_core AS paciente_ref, pa.id AS paciente_id,
            COALESCE(NULLIF(TRIM(pa.nome_social), ''), pa.nome) AS nome_paciente,
            t.modalidade AS modalidade_triagem
       FROM clinica_profissionais p
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
       JOIN clinica_triagens_pacientes t
         ON t.instituicao_id = p.instituicao_id AND t.organizacao_ref = o.ref_core
        AND t.paciente_ref IS NOT NULL
       JOIN clinica_pacientes pa
         ON pa.instituicao_id = t.instituicao_id AND pa.ref_core = t.paciente_ref
      WHERE p.instituicao_id = ? AND p.token_link_agenda = ? AND p.ativo = 1
        AND REPLACE(REPLACE(REPLACE(t.cpf, '.', ''), '-', ''), ' ', '') = ?
        AND (pa.profissional_id = p.id OR EXISTS (
          SELECT 1 FROM clinica_pacientes_profissionais pp
           WHERE pp.paciente_id = pa.id AND pp.profissional_id = p.id
        ))
      ORDER BY t.atualizado_em DESC
      LIMIT 1`,
    [instituicaoId(), token, cleanCpf || cpf]
  );
  // Segundo caminho, para o paciente que já é do psicólogo mas cujo CPF está
  // no cadastro e não na triagem — promovido antes da triagem guardar CPF, ou
  // cadastrado direto pela recepção. Continua exigindo que o CPF bata **e**
  // que o vínculo com o dono do link exista: é a mesma autorização por outra
  // porta, não uma porta sem autorização.
  let row = rows[0];
  if (!row) {
    const [porCadastro] = await pool.query<RowDataPacket[]>(
      `SELECT o.ref_core AS organizacao_ref, p.ref_core AS profissional_ref,
              p.id AS profissional_id, p.nome AS profissional_nome,
              p.valor_social_centavos, p.valor_sessao_centavos,
              pa.ref_core AS paciente_ref, pa.id AS paciente_id,
              COALESCE(NULLIF(TRIM(pa.nome_social), ''), pa.nome) AS nome_paciente,
              (SELECT t.modalidade FROM clinica_triagens_pacientes t
                WHERE t.instituicao_id = p.instituicao_id
                  AND t.organizacao_ref = o.ref_core AND t.paciente_ref = pa.ref_core
                ORDER BY t.atualizado_em DESC LIMIT 1) AS modalidade_triagem
         FROM clinica_profissionais p
         JOIN clinica_organizacoes o ON o.id = p.organizacao_id
         JOIN clinica_pacientes pa ON pa.instituicao_id = p.instituicao_id
        WHERE p.instituicao_id = ? AND p.token_link_agenda = ? AND p.ativo = 1
          AND REPLACE(REPLACE(REPLACE(pa.documento, '.', ''), '-', ''), ' ', '') = ?
          AND (pa.profissional_id = p.id OR EXISTS (
            SELECT 1 FROM clinica_pacientes_profissionais pp
             WHERE pp.paciente_id = pa.id AND pp.profissional_id = p.id
          ))
        LIMIT 1`,
      [instituicaoId(), token, cleanCpf || cpf]
    );
    row = porCadastro[0];
  }

  if (!row) return null;
  const social = String(row.modalidade_triagem ?? '').toLocaleUpperCase('pt-BR').includes('SOCIAL');
  return {
    patientRef: String(row.paciente_ref),
    patientRowId: String(row.paciente_id),
    nome: String(row.nome_paciente),
    organizationId: String(row.organizacao_ref),
    professionalId: String(row.profissional_ref),
    professionalRowId: String(row.profissional_id),
    professionalName: String(row.profissional_nome),
    sessionAmountCents: Number(
      social ? row.valor_social_centavos : row.valor_sessao_centavos
    ),
  };
}

async function ocupacao(
  profissionalRowId: string,
  de: Date,
  ate: Date
): Promise<IntervaloOcupado[]> {
  const pool = getMysqlPool();
  const [agendados] = await pool.query<RowDataPacket[]>(
    `SELECT a.inicio,
            COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) AS fim
       FROM clinica_agendamentos a
      WHERE a.instituicao_id = ? AND a.profissional_id = ? AND a.status <> 'cancelado'
        AND a.inicio < ? AND COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) > ?`,
    [instituicaoId(), profissionalRowId, ate, de]
  );
  const [bloqueios] = await pool.query<RowDataPacket[]>(
    `SELECT b.inicio, b.fim
       FROM clinica_agenda_bloqueios b
      WHERE b.instituicao_id = ? AND b.profissional_id = ?
        AND b.inicio < ? AND b.fim > ?`,
    [instituicaoId(), profissionalRowId, ate, de]
  );
  return [...agendados, ...bloqueios].map((row) => ({
    inicio: new Date(row.inicio).getTime(),
    fim: new Date(row.fim).getTime(),
  }));
}

async function janelas(
  profissionalRowId: string,
  professionalId: string
): Promise<JanelaDisponibilidade[]> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT dia_semana, hora_inicio, hora_fim, duracao_min, modalidade,
            vigencia_inicio, vigencia_fim
       FROM clinica_disponibilidades
      WHERE instituicao_id = ? AND profissional_id = ?`,
    [instituicaoId(), profissionalRowId]
  );
  if (rows.length === 0) {
    return disponibilidadePadrao(professionalId);
  }
  return rows.map((row) => ({
    diaSemana: Number(row.dia_semana),
    horaInicio: String(row.hora_inicio).slice(0, 5),
    horaFim: String(row.hora_fim).slice(0, 5),
    duracaoMin: Number(row.duracao_min),
    modalidade: row.modalidade === 'online' ? 'online' : 'presencial',
    vigenciaInicio: row.vigencia_inicio ? String(row.vigencia_inicio).slice(0, 10) : undefined,
    vigenciaFim: row.vigencia_fim ? String(row.vigencia_fim).slice(0, 10) : undefined,
  }));
}

/** Horários que o paciente pode escolher, já descontados agenda e bloqueios. */
export async function listAvailableSlots(
  paciente: PacienteIdentificado,
  de: Date,
  ate: Date,
  agora: Date = new Date()
): Promise<Slot[]> {
  const [grade, ocupados] = await Promise.all([
    janelas(paciente.professionalRowId, paciente.professionalId),
    ocupacao(paciente.professionalRowId, de, ate),
  ]);
  return gerarSlots(grade, ocupados, de, ate, agora);
}

export type ResultadoAgendamento =
  | { ok: true; agendamentoId: string; inicio: string; fim: string; modalidade: string; linkPagamento: string }
  | { ok: false; motivo: 'INDISPONIVEL' | 'DUPLICADO' };

/**
 * Marca a sessão no horário escolhido.
 *
 * A conferência do slot roda dentro da transação e a decisão final é do índice
 * `clinica_agendamentos_slot_uq`: dois pacientes que abrirem o link no mesmo
 * segundo passam pela mesma leitura de disponibilidade, e só um sobrevive ao
 * INSERT. O erro de chave duplicada volta como horário indisponível, não como
 * falha do servidor.
 */
export async function bookAppointment(
  paciente: PacienteIdentificado,
  inicioIso: string,
  agora: Date = new Date()
): Promise<ResultadoAgendamento> {
  const inicio = new Date(inicioIso);
  const janelaFim = new Date(inicio.getTime() + 24 * 60 * 60_000);
  const slots = await listAvailableSlots(paciente, inicio, janelaFim, agora);
  const slot = slots.find((item) => item.inicio === inicio.toISOString());
  if (!slot) return { ok: false, motivo: 'INDISPONIVEL' };

  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    // Trava a linha do profissional como mutex de agenda, no mesmo espírito do
    // repositório do agregado: sem um registro estável para segurar, duas
    // transações leriam a mesma agenda vazia.
    await connection.query(
      'SELECT id FROM clinica_profissionais WHERE instituicao_id = ? AND id = ? FOR UPDATE',
      [instituicaoId(), paciente.professionalRowId]
    );

    const [conflitos] = await connection.query<RowDataPacket[]>(
      `SELECT a.id FROM clinica_agendamentos a
        WHERE a.instituicao_id = ? AND a.profissional_id = ? AND a.status <> 'cancelado'
          AND a.inicio < ? AND COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) > ?
        FOR UPDATE`,
      [
        instituicaoId(),
        paciente.professionalRowId,
        new Date(slot.fim),
        new Date(slot.inicio),
      ]
    );
    if (conflitos.length > 0) {
      await connection.rollback();
      return { ok: false, motivo: 'INDISPONIVEL' };
    }

    // A leitura inicial dos slots acontece antes da transação. Revalidar os
    // bloqueios sob o mesmo mutex do profissional fecha a corrida entre um
    // paciente agendando e o psicólogo bloqueando um compromisso externo.
    const [bloqueios] = await connection.query<RowDataPacket[]>(
      `SELECT b.id FROM clinica_agenda_bloqueios b
        WHERE b.instituicao_id = ? AND b.profissional_id = ?
          AND b.inicio < ? AND b.fim > ?
        FOR UPDATE`,
      [instituicaoId(), paciente.professionalRowId, new Date(slot.fim), new Date(slot.inicio)]
    );
    if (bloqueios.length > 0) {
      await connection.rollback();
      return { ok: false, motivo: 'INDISPONIVEL' };
    }

    const referencia = `agenda-link-${randomUUID()}`;
    const agendamentoId = rowId('agendamento', referencia);
    const tokenPagamento = randomUUID().replaceAll('-', '');
    const [orgRows] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM clinica_organizacoes WHERE ref_core = ? LIMIT 1',
      [paciente.organizationId]
    );
    await connection.execute(
      `INSERT INTO clinica_agendamentos
         (id, instituicao_id, ref_core, organizacao_id, paciente_id, profissional_id,
          inicio, fim, timezone, duracao_min, modalidade, status, origem_criacao,
          origem_ref, token_pagamento_sessao, valor_centavos, versao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendado', 'portal', ?, ?, ?, 1,
               CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [
        agendamentoId,
        instituicaoId(),
        referencia,
        orgRows[0]?.id ?? null,
        paciente.patientRowId,
        paciente.professionalRowId,
        new Date(slot.inicio),
        new Date(slot.fim),
        FUSO_CLINICA,
        Math.round((Date.parse(slot.fim) - Date.parse(slot.inicio)) / 60_000),
        slot.modalidade,
        referencia,
        tokenPagamento,
        paciente.sessionAmountCents,
      ]
    );
    await connection.commit();
    return {
      ok: true,
      agendamentoId,
      inicio: slot.inicio,
      fim: slot.fim,
      modalidade: slot.modalidade,
      linkPagamento: `/pagar/sessao/${tokenPagamento}`,
    };
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { ok: false, motivo: 'DUPLICADO' };
    }
    throw error;
  } finally {
    connection.release();
  }
}

export interface ActivePatientAppointment {
  id: string;
  inicio: string;
  fim: string;
  modalidade: string;
  status: string;
  linkPagamento?: string;
  podeReagendar: boolean;
  horasAteInicio: number;
}

export async function getActiveUpcomingAppointment(
  paciente: PacienteIdentificado,
  agora: Date = new Date()
): Promise<ActivePatientAppointment | null> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id, a.ref_core, a.inicio,
            COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) AS fim,
            a.modalidade, a.status, a.token_pagamento_sessao
       FROM clinica_agendamentos a
      WHERE a.instituicao_id = ? AND a.profissional_id = ? AND a.paciente_id = ?
        AND a.status IN ('agendado', 'confirmado')
        AND a.inicio >= ?
      ORDER BY a.inicio ASC
      LIMIT 1`,
    [instituicaoId(), paciente.professionalRowId, paciente.patientRowId, agora]
  );
  const row = rows[0];
  if (!row) return null;

  const inicioMs = new Date(row.inicio).getTime();
  const agoraMs = agora.getTime();
  const horasAteInicio = Math.max(0, (inicioMs - agoraMs) / (1000 * 60 * 60));
  const podeReagendar = horasAteInicio >= 2;

  return {
    id: String(row.id),
    inicio: new Date(row.inicio).toISOString(),
    fim: new Date(row.fim).toISOString(),
    modalidade: String(row.modalidade ?? 'online'),
    status: String(row.status),
    linkPagamento: row.token_pagamento_sessao ? `/pagar/sessao/${row.token_pagamento_sessao}` : undefined,
    podeReagendar,
    horasAteInicio: Number(horasAteInicio.toFixed(1)),
  };
}

export type ResultadoReagendamento =
  | { ok: true; agendamentoId: string; inicio: string; fim: string; modalidade: string; linkPagamento: string }
  | { ok: false; motivo: 'INDISPONIVEL' | 'DUPLICADO' | 'PRAZO_EXPIRADO' | 'NAO_ENCONTRADO' };

export async function rescheduleAppointmentPublic(
  paciente: PacienteIdentificado,
  appointmentId: string,
  novoInicioIso: string,
  agora: Date = new Date()
): Promise<ResultadoReagendamento> {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT a.id, a.ref_core, a.inicio, a.token_pagamento_sessao, a.duracao_min, a.modalidade
         FROM clinica_agendamentos a
        WHERE a.instituicao_id = ? AND a.profissional_id = ? AND a.paciente_id = ?
          AND (a.id = ? OR a.ref_core = ?) AND a.status IN ('agendado', 'confirmado')
        LIMIT 1 FOR UPDATE`,
      [instituicaoId(), paciente.professionalRowId, paciente.patientRowId, appointmentId, appointmentId]
    );
    const agendamento = rows[0];
    if (!agendamento) {
      await connection.rollback();
      return { ok: false, motivo: 'NAO_ENCONTRADO' };
    }

    const horasAteInicio = (new Date(agendamento.inicio).getTime() - agora.getTime()) / (1000 * 60 * 60);
    if (horasAteInicio < 2) {
      await connection.rollback();
      return { ok: false, motivo: 'PRAZO_EXPIRADO' };
    }

    const novoInicio = new Date(novoInicioIso);
    const duracaoMin = Number(agendamento.duracao_min || 50);
    const novoFim = new Date(novoInicio.getTime() + duracaoMin * 60_000);

    const [conflitos] = await connection.query<RowDataPacket[]>(
      `SELECT a.id FROM clinica_agendamentos a
        WHERE a.instituicao_id = ? AND a.profissional_id = ? AND a.status <> 'cancelado'
          AND a.id <> ?
          AND a.inicio < ? AND COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) > ?
        FOR UPDATE`,
      [
        instituicaoId(),
        paciente.professionalRowId,
        agendamento.id,
        novoFim,
        novoInicio,
      ]
    );
    if (conflitos.length > 0) {
      await connection.rollback();
      return { ok: false, motivo: 'INDISPONIVEL' };
    }

    const [bloqueios] = await connection.query<RowDataPacket[]>(
      `SELECT b.id FROM clinica_agenda_bloqueios b
        WHERE b.instituicao_id = ? AND b.profissional_id = ?
          AND b.inicio < ? AND b.fim > ?
        FOR UPDATE`,
      [instituicaoId(), paciente.professionalRowId, novoFim, novoInicio]
    );
    if (bloqueios.length > 0) {
      await connection.rollback();
      return { ok: false, motivo: 'INDISPONIVEL' };
    }

    await connection.execute(
      `UPDATE clinica_agendamentos
          SET inicio = ?, fim = ?, status = 'agendado', versao = versao + 1, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND id = ?`,
      [novoInicio, novoFim, instituicaoId(), agendamento.id]
    );

    await connection.execute(
      `UPDATE financeiro_cobrancas
          SET vencimento_em = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND sessao_ref IN (?, ?) AND status IN ('pending', 'overdue')`,
      [novoInicio, instituicaoId(), agendamento.id, agendamento.ref_core]
    );

    await connection.commit();

    const tokenPagamento = agendamento.token_pagamento_sessao || randomUUID().replaceAll('-', '');
    return {
      ok: true,
      agendamentoId: String(agendamento.id),
      inicio: novoInicio.toISOString(),
      fim: novoFim.toISOString(),
      modalidade: String(agendamento.modalidade ?? 'online'),
      linkPagamento: `/pagar/sessao/${tokenPagamento}`,
    };
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { ok: false, motivo: 'DUPLICADO' };
    }
    throw error;
  } finally {
    connection.release();
  }
}
