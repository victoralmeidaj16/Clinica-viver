import 'server-only';

import { lerAvisosTurma } from '@/lib/turmasCiclo';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { CHAVE_AVISOS_TURMAS } from '@/server/persistence/turmasEncerradas';
import { lerConfiguracaoGestao, organizacaoPadrao } from './configuracaoGestao';
import { enviarTexto } from './viverMaisWhatsApp';
import { nomeDeExibicao } from './viverMaisRodizio';

/**
 * Avisos da contagem de saída por WhatsApp (especificação final, 1.03).
 *
 * Só envia com `enviarWhatsApp` ligado pela Gestão na configuração dos avisos —
 * o sino sempre mostra. Cada psicólogo recebe uma mensagem por marco ("dias
 * antes"); a chave de envio inclui o marco, e o registro de entregas do
 * WhatsApp impede repetir o mesmo aviso e guarda o resultado de cada envio.
 */
export async function enviarAvisosDeSaidaPorWhatsApp(): Promise<number> {
  const avisos = lerAvisosTurma((await lerConfiguracaoGestao<unknown>(organizacaoPadrao(), CHAVE_AVISOS_TURMAS)).valor);
  if (!avisos.enviarWhatsApp) return 0;
  const { cadastrosPsicologos } = await getCaptureRepository().read();
  let enviados = 0;
  for (const cadastro of cadastrosPsicologos) {
    const aviso = cadastro.status === 'APROVADO' ? cadastro.avisoSaidaTurma : undefined;
    if (!aviso || !cadastro.whatsapp) continue;
    const resultado = await enviarTexto(
      cadastro.whatsapp,
      `Olá, ${nomeDeExibicao(cadastro)}! 💜\n\n${aviso.textoPsicologo}\n\nEquipe Viver Mais Psicologia`,
      'aviso_saida_turma',
      `turma-saida:${cadastro.id}:${aviso.posGraduacao}:${aviso.turma}:${aviso.encerradaEm}:${aviso.marco}`
    );
    if (resultado.situacao === 'enviada') enviados += 1;
  }
  return enviados;
}
