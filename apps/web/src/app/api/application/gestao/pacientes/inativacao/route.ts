import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { inativarPelaGestao, reativarPelaGestao } from '@/server/application/patientInactivation';
import { falhaGestao } from '@/server/application/respostaGestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inativação e reativação do vínculo pela Gestão (6.05 e 13.01).
 *
 * `acao`: `INATIVAR` (com `motivo`) ou `REATIVAR` (com `justificativa` e
 * `excederLimite` quando o psicólogo estiver lotado).
 */
export async function POST(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const referencia = {
      patientId: String(body.patientId ?? '').trim() || undefined,
      leadId: String(body.leadId ?? '').trim() || undefined,
    };
    if (body.acao === 'INATIVAR') {
      const lead = await inativarPelaGestao(sessao.organizationId, autor, referencia, body.motivo);
      return NextResponse.json({ success: true, data: lead });
    }
    if (body.acao === 'REATIVAR') {
      const lead = await reativarPelaGestao(sessao.organizationId, autor, referencia, {
        justificativa: typeof body.justificativa === 'string' ? body.justificativa : undefined,
        excederLimite: body.excederLimite === true,
      });
      return NextResponse.json({ success: true, data: lead });
    }
    return NextResponse.json({ success: false, error: 'Ação desconhecida.' }, { status: 400 });
  } catch (error) {
    return falhaGestao(error, 'Erro ao inativar/reativar vínculo', 'Falha ao atualizar o vínculo.');
  }
}
