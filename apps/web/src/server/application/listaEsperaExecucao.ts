import 'server-only';

import {
  captureStateAsSnapshot,
  getCaptureRepository,
  type CaptureRepository,
} from '@/server/persistence/captureRepository';
import { processarListaDeEspera } from './listaEspera';
import { avisarAlocacao } from './viverMaisWhatsApp';
import { avisarAlocacaoPsicologoPorEmail } from './triagemEmail';

/**
 * Oferece as vagas que surgiram a quem está na lista automática e avisa os
 * psicólogos escolhidos. Chamado pela varredura periódica, pela abertura da
 * fila na Gestão e logo depois de uma ação que libera vaga (inativação,
 * desistência, mudança na lista).
 *
 * A prévia sem trava evita abrir transação quando não há vaga nova — o caso
 * comum. A decisão real é refeita dentro da mutação.
 */
export async function executarListaDeEspera(
  repositorio: CaptureRepository = getCaptureRepository()
): Promise<number> {
  const estado = await repositorio.read();
  if (!processarListaDeEspera(captureStateAsSnapshot(estado)).alterado) return 0;

  const resultado = await repositorio.mutate((state) => {
    const processado = processarListaDeEspera(captureStateAsSnapshot(state));
    return {
      next: {
        ...state,
        triagensPacientes: processado.snapshot.triagensPacientes ?? [],
        cadastrosPsicologos: processado.snapshot.cadastrosPsicologos ?? [],
      },
      result: processado,
    };
  });

  for (const oferta of resultado.ofertas) {
    const envios = await Promise.allSettled([
      avisarAlocacao(oferta.lead, oferta.psicologo),
      avisarAlocacaoPsicologoPorEmail(oferta.lead, oferta.psicologo, 'RODIZIO'),
    ]);
    if (envios.some((envio) => envio.status === 'rejected')) {
      console.warn(`[lista-espera] Oferta ${oferta.lead.protocolo} gravada, mas um aviso falhou.`);
    }
  }
  return resultado.ofertas.length;
}

/** Versão que nunca lança, para depois de uma ação que já foi gravada. */
export async function executarListaDeEsperaSemFalhar(): Promise<void> {
  try {
    await executarListaDeEspera();
  } catch (erro) {
    console.error('[lista-espera] Falha ao oferecer vagas da lista de espera:', erro);
  }
}
