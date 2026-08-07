import { NextResponse } from 'next/server';
import { emptySnapshot, readSnapshot, writeSnapshot } from '@/server/application/persistence';
import { varrerSla } from '@/server/application/viverMaisRodizio';
import { avisarTransbordo } from '@/server/application/viverMaisWhatsApp';
import { exigirVarreduraAutorizada, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Varredura do SLA de 24h.
 *
 * Um único caminho serve aos três chamadores — o agendador, a gestão abrindo o
 * cockpit e o botão "forçar transbordo" —, porque um transbordo manual que
 * seguisse regra diferente da automática seria uma segunda regra para manter
 * em pé, e a primeira a divergir.
 *
 * `leadId` no corpo restringe a varredura a um lead; sem ele, varre a fila
 * inteira. Em ambos os casos é idempotente: chamar de novo não move nada.
 *
 * O agendador vive fora daqui. A aplicação roda na VM, então a forma de
 * pendurar o relógio é um timer no próprio host chamando esta rota com o
 * cabeçalho `x-sla-token`. Enquanto isso não existir, a varredura do `GET` da
 * fila mantém o SLA em dia sempre que alguém abre o cockpit.
 */
export async function POST(request: Request) {
  try {
    await exigirVarreduraAutorizada(request);

    const corpo = await request.json().catch(() => ({}));
    const leadId = typeof corpo?.leadId === 'string' ? corpo.leadId : undefined;

    const snapshot = readSnapshot() ?? emptySnapshot();
    const { snapshot: varrido, transbordos, alterado } = varrerSla(snapshot, leadId);

    if (alterado) {
      await writeSnapshot({ ...varrido, savedAt: new Date().toISOString() });
    }
    for (const transbordo of transbordos) {
      void avisarTransbordo(transbordo.lead, transbordo.psicologoNovo);
    }

    return NextResponse.json({
      success: true,
      transbordosExecutados: transbordos.length,
      leads: transbordos.map((item) => ({
        protocolo: item.lead.protocolo,
        psicologoAnteriorId: item.psicologoAnteriorId,
        psicologoNovoId: item.psicologoNovo.id,
      })),
    });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro na varredura de SLA:', error);
    return NextResponse.json({ success: false, error: 'Falha ao executar a varredura.' }, { status: 500 });
  }
}
