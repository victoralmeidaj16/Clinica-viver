import { NextResponse } from 'next/server';
import { emptySnapshot, readSnapshot } from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dados mínimos e públicos de profissionais aprovados para a vitrine. */
export async function GET() {
  try {
    const state = isMysqlConfigured() ? await new MysqlCaptureRepository().read() : readSnapshot() ?? emptySnapshot();
    const data = (state.cadastrosPsicologos ?? [])
      .filter((item) => item.status === 'APROVADO' && item.exibirNaVitrine !== false)
      .map((item) => ({
        id: item.id,
        nome: item.nomeCompleto,
        nomeSocial: item.nomeSocial,
        crp: item.crp,
        estadoUf: item.estadoUf,
        cidade: item.cidade,
        fotoUrl: item.fotoUrl,
        turmaViverMais: item.turmaViverMais,
        posGraduacaoViverMais: item.posGraduacaoViverMais,
        especialidades: item.especialidade ? [item.especialidade] : [],
        servicosHabilitados: item.servicosHabilitados ?? [],
      }));
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erro ao carregar profissionais da vitrine:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar profissionais.' }, { status: 500 });
  }
}
