import 'server-only';
import type { ResultadoEnvio } from '@/server/application/viverMaisWhatsApp';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export async function adiarNovaTentativa(id: string, agora: Date) {
  const proximaTentativa = new Date(agora.getTime() + 5 * 60_000);
  await getMysqlPool().execute(
    `UPDATE clinica_agenda_avisos SET situacao = 'aguardando_horario', enviar_em = ?
      WHERE instituicao_id = ? AND id = ? AND situacao = 'reservado'`,
    [proximaTentativa, instituicaoId(), id],
  );
}

export async function finalizarAviso(id: string, envio: ResultadoEnvio, agora = new Date()) {
  if (envio.situacao === 'falha' && envio.reenvioSeguro) {
    await adiarNovaTentativa(id, agora);
    return 'aguardando_horario';
  }
  const situacao = envio.situacao === 'falha' ? 'entrega_incerta' : envio.situacao;
  await getMysqlPool().execute(
    `UPDATE clinica_agenda_avisos SET situacao = ?
      WHERE instituicao_id = ? AND id = ? AND situacao = 'reservado'`,
    [situacao, instituicaoId(), id],
  );
  return situacao;
}
