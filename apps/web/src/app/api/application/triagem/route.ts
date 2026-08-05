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

    const novaTriagem = {
      id: `triagem-${Date.now()}`,
      protocolo: body.protocolo || `VM-${Math.floor(100000 + Math.random() * 900000)}`,
      nomePaciente: body.nome,
      telefone: body.whatsapp,
      idade: body.idade,
      email: body.email,
      cpf: body.cpf,
      cep: body.cep,
      possuiConvenio: body.possuiConvenio,
      convenioSelecionado: body.convenioSelecionado || 'Nenhum',
      origem: body.origem || 'Facebook',
      turno: body.turno || 'VESPERTINO',
      servico: body.servico,
      modalidade: body.modalidade,
      status: 'PENDENTE_ATRIBUICAO',
      criadoEm: new Date().toISOString(),
    };

    const triagensAtualizadas = [
      ...((snapshot as any).triagensPacientes || []),
      novaTriagem,
    ];

    const snapshotAtualizado = {
      ...snapshot,
      savedAt: new Date().toISOString(),
      triagensPacientes: triagensAtualizadas,
    };

    await writeSnapshot(snapshotAtualizado as any);

    return NextResponse.json({
      success: true,
      protocolo: novaTriagem.protocolo,
      data: novaTriagem,
    });
  } catch (error) {
    console.error('Erro ao salvar triagem de paciente:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar no banco.' }, { status: 500 });
  }
}
