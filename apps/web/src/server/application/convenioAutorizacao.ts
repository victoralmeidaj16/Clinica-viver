import 'server-only';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import type { RequestContext } from './context';
import { ApplicationError } from './http';

export async function pendenciasConvenio(org: string, convenio: string) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`SELECT a.id,p.nome,a.inicio FROM clinica_agendamentos a
    JOIN clinica_organizacoes o ON o.id=a.organizacao_id JOIN clinica_pacientes p ON p.id=a.paciente_id
    WHERE a.instituicao_id=? AND o.ref_core=? AND a.custeio_convenio_ref=? AND a.custeio_aguarda_autorizacao=1
      AND a.status IN ('agendado','confirmado') ORDER BY a.inicio`,[instituicaoId(),org,convenio]);
  return rows;
}

export async function autorizarExcedente(ctx: RequestContext, convenio: string, id: string) {
  if (!ctx.actor.roles.some(r => r === 'admin' || r === 'owner')) throw new ApplicationError('FORBIDDEN','Somente a Gestão pode autorizar o excedente.',403);
  const [result] = await getMysqlPool().execute<ResultSetHeader>(`UPDATE clinica_agendamentos a
    JOIN clinica_organizacoes o ON o.id=a.organizacao_id
    SET a.custeado_pela_empresa=1,a.custeio_aguarda_autorizacao=0,a.versao=a.versao+1
    WHERE a.instituicao_id=? AND o.ref_core=? AND a.id=? AND a.custeio_convenio_ref=? AND a.custeio_aguarda_autorizacao=1
      AND a.status IN ('agendado','confirmado') AND a.pacote_id IS NULL`,
  [instituicaoId(),ctx.actor.organizationId,id,convenio]);
  if (!result.affectedRows) throw new ApplicationError('CONFLICT','A autorização já foi resolvida ou a reserva mudou.',409);
  return { autorizado:true };
}
