import { NextResponse } from 'next/server';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { CadastroIncompletoError } from '@/server/application/psychologistAccess';
import { enviarConvitePsicologo } from '@/server/application/psychologistInvitation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();
    if (!isMysqlConfigured()) {
      return NextResponse.json(
        { success: false, error: 'O reenvio de convite exige a persistência MySQL.' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const cadastro = (await getCaptureRepository().read()).cadastrosPsicologos
      .find((item) => item.id === id);

    if (!cadastro) {
      return NextResponse.json({ success: false, error: 'Cadastro não encontrado.' }, { status: 404 });
    }
    if (cadastro.status !== 'APROVADO') {
      return NextResponse.json(
        { success: false, error: 'Apenas psicólogos aprovados podem receber o convite.' },
        { status: 409 }
      );
    }

    const entregas = await enviarConvitePsicologo(cadastro);
    return NextResponse.json({ success: true, data: entregas });
  } catch (error) {
    if (error instanceof CadastroIncompletoError) {
      return NextResponse.json(
        { success: false, error: error.message, campos: error.campos },
        { status: 422 }
      );
    }
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao reenviar convite do psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao reenviar o convite.' }, { status: 500 });
  }
}
