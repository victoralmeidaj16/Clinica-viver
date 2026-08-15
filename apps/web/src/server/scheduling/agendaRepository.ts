import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import {
  disponibilidadePadraoDoCadastro,
  FUSO_CLINICA,
  gerarSlots,
  type IntervaloOcupado,
  type JanelaDisponibilidade,
  type Slot,
} from '@thats-life/core';

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
}

export interface BloqueioAgenda {
  id: string;
  inicio: string;
  fim: string;
  motivo?: string;
}

export interface AgendamentoResumo {
  id: string;
  pacienteNome: string;
  inicio: string;
  fim: string;
  modalidade: 'presencial' | 'online' | 'telefone';
  status: string;
  origem: string;
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
    `SELECT b.id, b.inicio, b.fim, b.motivo
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
  }));
}

export async function createBlock(
  organizationId: string,
  professionalId: string,
  input: { inicio: string; fim: string; motivo?: string }
): Promise<void> {
  const pool = getMysqlPool();
  const [profRows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id FROM clinica_profissionais p
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
      WHERE p.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ? LIMIT 1`,
    [instituicaoId(), organizationId, professionalId]
  );
  const profissionalRowId = profRows[0]?.id as string | undefined;
  if (!profissionalRowId) throw new Error('Perfil profissional não encontrado.');

  await pool.execute(
    `INSERT INTO clinica_agenda_bloqueios
       (id, instituicao_id, profissional_id, inicio, fim, motivo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      instituicaoId(),
      profissionalRowId,
      new Date(input.inicio),
      new Date(input.fim),
      input.motivo?.trim() || null,
    ]
  );
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
  desde: Date
): Promise<AgendamentoResumo[]> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT a.id, a.inicio, a.fim, a.duracao_min, a.modalidade, a.status,
            a.origem_criacao, COALESCE(pa.nome_social, pa.nome) AS paciente_nome
       FROM clinica_agendamentos a
       JOIN clinica_profissionais p ON p.id = a.profissional_id
       JOIN clinica_organizacoes o ON o.id = p.organizacao_id
       JOIN clinica_pacientes pa ON pa.id = a.paciente_id
      WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
        AND a.inicio >= ?
      ORDER BY a.inicio
      LIMIT 200`,
    [instituicaoId(), organizationId, professionalId, desde]
  );
  return rows.map((row) => ({
    id: String(row.id),
    pacienteNome: String(row.paciente_nome ?? 'Paciente'),
    inicio: new Date(row.inicio).toISOString(),
    fim: new Date(
      row.fim ?? new Date(row.inicio).getTime() + Number(row.duracao_min) * 60_000
    ).toISOString(),
    modalidade: row.modalidade,
    status: String(row.status),
    origem: String(row.origem_criacao),
  }));
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
            pa.ref_core AS paciente_ref, pa.id AS paciente_id, t.nome_paciente
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
              pa.ref_core AS paciente_ref, pa.id AS paciente_id,
              COALESCE(pa.nome_social, pa.nome) AS nome_paciente
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
  return {
    patientRef: String(row.paciente_ref),
    patientRowId: String(row.paciente_id),
    nome: String(row.nome_paciente),
    organizationId: String(row.organizacao_ref),
    professionalId: String(row.profissional_ref),
    professionalRowId: String(row.profissional_id),
    professionalName: String(row.profissional_nome),
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
  | { ok: true; agendamentoId: string; inicio: string; fim: string; modalidade: string }
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

    const referencia = `agenda-link-${randomUUID()}`;
    const agendamentoId = rowId('agendamento', referencia);
    const [orgRows] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM clinica_organizacoes WHERE ref_core = ? LIMIT 1',
      [paciente.organizationId]
    );
    await connection.execute(
      `INSERT INTO clinica_agendamentos
         (id, instituicao_id, ref_core, organizacao_id, paciente_id, profissional_id,
          inicio, fim, timezone, duracao_min, modalidade, status, origem_criacao,
          origem_ref, versao, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendado', 'portal', ?, 1,
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
      ]
    );
    await connection.commit();
    return {
      ok: true,
      agendamentoId,
      inicio: slot.inicio,
      fim: slot.fim,
      modalidade: slot.modalidade,
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
