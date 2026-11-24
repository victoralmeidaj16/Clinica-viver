import 'server-only';

import {
  desmarcarEnvioReenviado,
  marcarEnvioReenviado,
  obterEnvioParaReenvio,
  SITUACOES_NAO_ENTREGUES,
} from '@/server/communication/avisosEnviosRepository';
import type { AutorDaSessao } from './autorGestao';
import { ApplicationError } from './http';
import { enviarTexto, type FinalidadeMensagem, type ResultadoEnvio } from './viverMaisWhatsApp';

/**
 * Reenvio de um aviso não entregue pela Gestão (especificação final, 12.04).
 *
 * Reenvia só a mensagem — o mesmo texto, para o mesmo número — e não toca na
 * solicitação, no agendamento ou na cobrança que deram origem a ela: nada de
 * pedido ou sessão duplicados. A original fica marcada como reenviada e o
 * reenvio vira uma linha própria do registro, com autor.
 *
 * Quando o provedor não confirmou nem recusou (tempo esgotado), a mensagem
 * pode ter chegado. O reenvio então exige a confirmação explícita de que a
 * Gestão conferiu com o destinatário.
 */
export async function reenviarAviso(
  id: string,
  autor: AutorDaSessao,
  opcoes: { confirmarResultadoIncerto?: boolean } = {}
): Promise<ResultadoEnvio> {
  const envio = await obterEnvioParaReenvio(id);
  if (!envio) throw new ApplicationError('NOT_FOUND', 'Envio não encontrado.', 404);
  const { registro, conteudo } = envio;
  if (registro.canal !== 'whatsapp') {
    throw new ApplicationError('INVALID_INPUT', 'Só avisos de WhatsApp são reenviados por aqui.', 400);
  }
  if (!SITUACOES_NAO_ENTREGUES.includes(registro.situacao)) {
    throw new ApplicationError('CONFLICT', 'Este aviso foi entregue ao provedor; não há o que reenviar.', 409);
  }
  if (registro.reenviadoEm) {
    throw new ApplicationError('CONFLICT', 'Este aviso já foi reenviado.', 409);
  }
  if (!conteudo) {
    throw new ApplicationError('INVALID_INPUT',
      'O texto deste aviso não fica guardado (por segurança ou por falta da chave de cifra). Use o fluxo próprio do aviso.', 400);
  }
  if (registro.situacao === 'falha' && registro.reenvioSeguro === false && !opcoes.confirmarResultadoIncerto) {
    throw new ApplicationError('RESULTADO_INCERTO',
      'O provedor não confirmou nem recusou esta mensagem: ela pode ter chegado. Confira com o destinatário antes de reenviar.', 409);
  }
  if (!(await marcarEnvioReenviado(id))) {
    throw new ApplicationError('CONFLICT', 'Este aviso acabou de ser reenviado por outra pessoa.', 409);
  }
  try {
    return await enviarTexto(conteudo.destino, conteudo.texto, registro.finalidade as FinalidadeMensagem,
      `reenvio:${id}`, false, { referencia: registro.referencia, reenvio: { de: id, autor } });
  } catch (erro) {
    await desmarcarEnvioReenviado(id);
    throw erro;
  }
}
