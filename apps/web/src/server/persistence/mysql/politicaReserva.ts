import 'server-only';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { instituicaoId } from './mappers';
import { custeioEfetivoSql, custeioDoAgendamentoSql } from './custeioSql';
import { ApplicationError } from '@/server/application/http';

/** Serializa reservas do mesmo paciente, inclusive com profissionais diferentes. */
export async function travarPacienteParaReserva(connection: PoolConnection, pacienteId: string) {
  await connection.query('SELECT id FROM clinica_pacientes WHERE instituicao_id=? AND id=? FOR UPDATE',
    [instituicaoId(),pacienteId]);
}

/** Reserva a vaga antes de liberar a trava do paciente. Contratos antigos conservam a projeção por data. */
export async function reservarCotaContratual(connection: PoolConnection, id: string) {
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT c.ref_core AS convenio, c.politica,
      ${custeioEfetivoSql({ paciente:'p', convenio:'c', agendamento:'a', referencia:'a.inicio' })} AS disponivel
    FROM clinica_agendamentos a JOIN clinica_pacientes p ON p.id=a.paciente_id
    JOIN clinica_organizacoes o ON o.id=a.organizacao_id AND o.id=p.organizacao_id
    JOIN clinica_convenios c ON c.instituicao_id=a.instituicao_id AND c.organizacao_ref=o.ref_core AND c.ref_core=p.convenio_ref
    WHERE a.instituicao_id=? AND a.id=? AND c.politica IS NOT NULL
      AND COALESCE(p.custeado_pela_empresa,c.empresa_paga_sessoes)=1 FOR UPDATE`,[instituicaoId(), id]);
  const row = rows[0];
  if (!row?.politica) return false;
  const p = typeof row.politica === 'string' ? JSON.parse(row.politica) : row.politica;
  const coberto = !!Number(row.disponivel);
  if (!coberto && p.excedente === 'bloquear') throw new ApplicationError('CONVENIO_QUOTA', 'A cota do convênio para esta reserva está esgotada.', 409);
  const pendente = !coberto && p.excedente === 'autorizar';
  await connection.execute(`UPDATE clinica_agendamentos SET custeado_pela_empresa=?, custeio_convenio_ref=?,
    custeio_aguarda_autorizacao=? WHERE instituicao_id=? AND id=?`,
  [coberto, coberto || pendente ? row.convenio : null, pendente, instituicaoId(),id]);
  return pendente;
}

/** Para reservas anteriores à definição da política, resolve o pagador antes do cancelamento. */
export async function fixarCotaAntesDeCancelar(connection: PoolConnection, id: string) {
  const [[row]] = await connection.query<RowDataPacket[]>(`SELECT c.ref_core AS convenio,
    ${custeioDoAgendamentoSql({ agendamento:'a', paciente:'p', convenio:'c' })} AS coberto
    FROM clinica_agendamentos a JOIN clinica_pacientes p ON p.id=a.paciente_id
    JOIN clinica_organizacoes o ON o.id=a.organizacao_id
    JOIN clinica_convenios c ON c.instituicao_id=a.instituicao_id AND c.organizacao_ref=o.ref_core AND c.ref_core=p.convenio_ref
    WHERE a.id=? AND a.instituicao_id=? AND a.custeado_pela_empresa IS NULL AND a.pacote_id IS NULL
      AND JSON_EXTRACT(c.politica,'$.consumirCancelamento')=TRUE FOR UPDATE`, [id,instituicaoId()]);
  if (row?.coberto) await connection.execute(`UPDATE clinica_agendamentos SET custeado_pela_empresa=1,
    custeio_convenio_ref=? WHERE id=? AND instituicao_id=?`, [row.convenio,id,instituicaoId()]);
}
