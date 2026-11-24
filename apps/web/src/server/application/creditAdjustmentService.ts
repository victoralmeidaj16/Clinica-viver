import 'server-only';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export async function registrarDecisaoCredito(context: RequestContext, id: string, body: Record<string, unknown>) {
  const { actor, idempotencyKey } = context;
  if (!actor.roles.some(r => r === 'admin' || r === 'owner')) throw new ApplicationError('FORBIDDEN', 'Somente a Gestão pode ajustar créditos.', 403);
  const evento = String(body.evento ?? '').trim();
  const motivo = String(body.justificativa ?? '').trim();
  const delta = body.ajusteCentavos;
  if (!evento || evento.length > 128 || !motivo || motivo.length > 500 || !Number.isSafeInteger(delta)
    || !idempotencyKey || idempotencyKey.length > 128) throw new ApplicationError('INVALID_INPUT', 'Informe o evento, a justificativa e o ajuste em centavos.', 400);
  const conn = await getMysqlPool().getConnection();
  const scope = [instituicaoId(), actor.organizationId];
  try {
    await conn.beginTransaction();
    const [originais] = await conn.query<RowDataPacket[]>(`SELECT * FROM financeiro_creditos_educacionais
      WHERE instituicao_id=? AND organizacao_ref=? AND id=? AND origem <> 'adjustment' FOR UPDATE`, [...scope, id]);
    const original = originais[0];
    if (!original) throw new ApplicationError('NOT_FOUND', 'Crédito não encontrado.', 404);
    const [decisoes] = await conn.query<RowDataPacket[]>(`SELECT * FROM financeiro_creditos_educacionais
      WHERE instituicao_id=? AND organizacao_ref=? AND origem='adjustment' AND
        (origem_ref=? OR (original_id=? AND evento_ref=?)) FOR UPDATE`, [...scope, idempotencyKey, id, evento]);
    if (decisoes.length) {
      const anterior = decisoes[0];
      if (anterior.original_id !== id || anterior.origem_ref !== idempotencyKey || anterior.evento_ref !== evento
        || anterior.justificativa !== motivo || Number(anterior.credito_centavos) !== delta) {
        throw new ApplicationError('CONFLICT', 'Já existe outra decisão para este evento ou chave.', 409);
      }
      await conn.commit();
      return { id: String(anterior.id) };
    }
    const [estornos] = await conn.query<RowDataPacket[]>(`SELECT r.evento FROM financeiro_eventos_revisao_credito r
      WHERE r.instituicao_id=? AND r.organizacao_ref=? AND r.evento=? AND r.cobranca_ref=?
        AND (? <> 'payment' OR r.pagamento_ref=?)`,
    [...scope,evento,original.cobranca_ref,original.origem,original.origem_ref]);
    if (!estornos.length) throw new ApplicationError('INVALID_INPUT', 'O evento informado não pertence a este crédito.', 400);
    const decisionId = randomUUID();
    await conn.execute(`INSERT INTO financeiro_creditos_educacionais
      (id,instituicao_id,organizacao_ref,origem,origem_ref,cobranca_ref,sessao_ref,paciente_ref,profissional_ref,
       competencia_em,base_centavos,credito_centavos,original_id,evento_ref,autor_ref,justificativa)
      VALUES (?,?,?,'adjustment',?,?,?,?,?,UTC_TIMESTAMP(3),0,?,?,?,?,?)`,
    [decisionId,...scope,idempotencyKey,original.cobranca_ref,original.sessao_ref,original.paciente_ref,original.profissional_ref,
      Number(delta),id,evento,actor.userId,motivo]);
    await conn.commit();
    return { id: decisionId };
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}
