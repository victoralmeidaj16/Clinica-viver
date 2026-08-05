import { NextResponse } from 'next/server';
import { readSnapshot, writeSnapshot } from '@/server/application/persistence';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const snapshot = readSnapshot() || {
      version: 1,
      savedAt: new Date().toISOString(),
      appointments: [],
      sessions: [],
      records: [],
      timeline: [],
      checkIns: [],
      notifications: [],
      ledger: { transactions: [], payoutSplits: [] },
      carePlans: [],
      moodLogs: [],
      deliveredHandoffs: [],
      assessments: [],
      preferences: [],
      consents: [],
      triagensPacientes: [],
      cadastrosPsicologos: [],
    };

    const novoPsicologo = {
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
      ...((snapshot as any).cadastrosPsicologos || []),
      novoPsicologo,
    ];

    const snapshotAtualizado = {
      ...snapshot,
      savedAt: new Date().toISOString(),
      cadastrosPsicologos: cadastrosAtualizados,
    };

    await writeSnapshot(snapshotAtualizado as any);

    return NextResponse.json({
      success: true,
      data: novoPsicologo,
    });
  } catch (error) {
    console.error('Erro ao salvar cadastro do psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar credenciamento no banco.' }, { status: 500 });
  }
}
