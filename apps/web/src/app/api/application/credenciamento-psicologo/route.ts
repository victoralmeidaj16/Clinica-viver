import { NextResponse } from 'next/server';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type CadastroPsicologoRecord,
} from '@/server/application/persistence';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const snapshot = readSnapshot() ?? emptySnapshot();

    const novoPsicologo: CadastroPsicologoRecord = {
      id: `psi-cad-${Date.now()}`,
      nomeCompleto: body.nomeCompleto,
      crp: body.crp,
      whatsapp: body.whatsapp,
      email: body.email,
      cidadeUf: body.cidadeUf,
      especialidade: body.especialidade,
      modalidadeAtendimento: body.modalidadeAtendimento,
      minibio: body.minibio,
      status: 'EM_ANALISE',
      criadoEm: new Date().toISOString(),
    };

    const cadastrosAtualizados = [
      ...(snapshot.cadastrosPsicologos ?? []),
      novoPsicologo,
    ];

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      cadastrosPsicologos: cadastrosAtualizados,
    });

    return NextResponse.json({
      success: true,
      data: novoPsicologo,
    });
  } catch (error) {
    console.error('Erro ao salvar cadastro do psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar credenciamento no banco.' }, { status: 500 });
  }
}
