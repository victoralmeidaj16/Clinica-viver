import 'server-only';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export async function consumirPacote(connection: PoolConnection, org: string, paciente: string, profissional: string, agendamento: string) {
  const [[reserva]] = await connection.query<RowDataPacket[]>(`SELECT a.pacote_id FROM clinica_agendamentos a
    JOIN clinica_organizacoes o ON o.id=a.organizacao_id JOIN clinica_pacientes p ON p.id=a.paciente_id
    JOIN clinica_profissionais pr ON pr.id=a.profissional_id WHERE a.instituicao_id=? AND o.ref_core=? AND p.ref_core=?
      AND pr.ref_core=? AND a.id=? AND a.status IN ('agendado','confirmado') FOR UPDATE`,[instituicaoId(),org,paciente,profissional,agendamento]);
  if (!reserva) throw new Error('Reserva indisponível para este vínculo.');
  if (reserva.pacote_id) return;
  const [rows] = await connection.query<RowDataPacket[]>(`SELECT id FROM financeiro_pacotes
    WHERE instituicao_id=? AND organizacao_ref=? AND paciente_ref=? AND profissional_ref=?
      AND pago_em IS NOT NULL AND utilizadas < quantidade ORDER BY pago_em,id LIMIT 1 FOR UPDATE`,
  [instituicaoId(), org, paciente, profissional]);
  if (!rows.length) {
    const error = new Error('O saldo de sessões pagas é insuficiente para esta reserva.');
    error.name = 'SaldoPacoteInsuficiente';
    throw error;
  }
  await connection.execute('UPDATE financeiro_pacotes SET utilizadas=utilizadas+1 WHERE id=?', [rows[0].id]);
  await connection.execute(`UPDATE clinica_agendamentos SET pacote_id=?,custeado_pela_empresa=0,
    custeio_convenio_ref=NULL, token_pagamento_sessao=NULL WHERE instituicao_id=? AND id=?`,
  [rows[0].id, instituicaoId(), agendamento]);
}
