import { NextResponse } from 'next/server';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type CadastroPsicologoRecord,
} from '@/server/application/persistence';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cadastros de psicólogos, para o cockpit da gestão.
 *
 * Autenticada, ao contrário do `POST` logo abaixo: a candidatura é pública
 * porque qualquer psicólogo pode se oferecer, mas a lista de quem se candidatou
 * — com CRP, telefone e e-mail — não é assunto de quem passa pelo site.
 */
export async function GET() {
  try {
    await exigirGestao();
    const snapshot = readSnapshot();
    return NextResponse.json({ success: true, data: snapshot?.cadastrosPsicologos ?? [] });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao listar credenciamentos:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar credenciamentos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const snapshot = readSnapshot() ?? emptySnapshot();

    const novoPsicologo: CadastroPsicologoRecord = {
      id: `psi-cad-${Date.now()}`,
      nomeCompleto: body.nomeCompleto,
      nomeSocial: body.nomeSocial || undefined,
      crp: body.crp,
      whatsapp: body.whatsapp,
      email: body.email,
      cidadeUf: body.cidadeUf,
      especialidade: body.especialidade,
      modalidadeAtendimento: body.modalidadeAtendimento,
      minibio: body.minibio,
      status: 'EM_ANALISE',
      criadoEm: new Date().toISOString(),

      // O que o próprio profissional declara sobre o que atende. Vinha sendo
      // descartado pela rota, o que deixava o rodízio sem nada para cruzar
      // mesmo depois da aprovação.
      turnosDisponiveis: Array.isArray(body.disponibilidadeTurnos) ? body.disponibilidadeTurnos : [],
      servicosHabilitados: Array.isArray(body.servicosHabilitados) ? body.servicosHabilitados : [],
      turmaViverMais: body.turmaViverMais || undefined,
      posGraduacaoViverMais: body.posGraduacaoViverMais || undefined,

      // Faixa de valor (acessível/particular) é decisão da clínica, não
      // declaração do candidato: fica em branco até a gestão definir na
      // aprovação. Sem ela o profissional não casa com lead nenhum — que é o
      // comportamento certo para quem ainda não foi habilitado a uma tabela.
      modalidadesAtendidas: [],
      exibirNaVitrine: true,
      pacientesAtivosCount: 0,
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
