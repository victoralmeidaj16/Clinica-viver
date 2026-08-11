import { NextResponse } from 'next/server';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type CadastroPsicologoRecord,
} from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { isBrazilUf } from '@/lib/brazilLocations';
import { municipioPertenceAoEstado } from '@/server/application/ibgeLocations';
import { validateGender } from '@/lib/gender';
import {
  derivarModalidadesAtendidas,
  derivarServicosHabilitados,
} from '@/server/application/psychologistRegistration';

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
    if (isMysqlConfigured()) {
      const state = await new MysqlCaptureRepository().read();
      return NextResponse.json({ success: true, data: state.cadastrosPsicologos });
    }
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
    const whatsapp = normalizeBrazilPhone(body.whatsapp);
    const estadoUf = String(body.estadoUf ?? '').trim().toUpperCase();
    const cidade = String(body.cidade ?? '').trim();
    const genero = validateGender(body.genero, body.generoOutro);

    if (!whatsapp) {
      return NextResponse.json({ success: false, error: 'Informe um telefone brasileiro válido com DDD.' }, { status: 400 });
    }
    if (!isBrazilUf(estadoUf) || !cidade) {
      return NextResponse.json({ success: false, error: 'Selecione o estado e a cidade.' }, { status: 400 });
    }
    if (!genero) {
      return NextResponse.json({ success: false, error: 'Selecione o gênero e informe a descrição quando escolher Outro.' }, { status: 400 });
    }
    try {
      if (!(await municipioPertenceAoEstado(estadoUf, cidade))) {
        return NextResponse.json({ success: false, error: 'Selecione uma cidade oficial da UF informada.' }, { status: 400 });
      }
    } catch (error) {
      console.error('Erro ao validar município no IBGE:', error);
      return NextResponse.json({ success: false, error: 'Não foi possível validar a cidade agora. Tente novamente.' }, { status: 503 });
    }

    const atendimentoPreferencia = (body.atendimentoPreferencia as 'PARTICULAR' | 'SOCIAL' | 'AMBOS') || 'AMBOS';
    const modalidadesAtendidas = derivarModalidadesAtendidas(atendimentoPreferencia);

    // Turno é critério eliminatório do rodízio: sem nenhum, o cadastro nasce
    // aprovável e nunca elegível — o pior dos dois mundos, porque nada indica
    // que está errado.
    const turnosDisponiveis = Array.isArray(body.disponibilidadeTurnos)
      ? body.disponibilidadeTurnos.filter((t: unknown): t is string => typeof t === 'string')
      : [];
    if (turnosDisponiveis.length === 0) {
      return NextResponse.json({ success: false, error: 'Selecione ao menos um turno de atendimento.' }, { status: 400 });
    }

    const servicosPrestados = Array.isArray(body.servicosPrestados) ? body.servicosPrestados : [];

    const novoPsicologo: CadastroPsicologoRecord = {
      id: `psi-cad-${Date.now()}`,
      nomeCompleto: body.nomeCompleto,
      nomeSocial: body.nomeSocial || undefined,
      crp: body.crp,
      whatsapp,
      email: body.email,
      fotoUrl: body.fotoUrl || undefined,
      estadoUf,
      cidade,
      genero: genero.gender,
      generoOutro: genero.other,
      cidadeUf: `${cidade}/${estadoUf}`,
      especialidade: body.especialidade || undefined,
      modalidadeAtendimento: body.modalidadeAtendimento,
      atendimentoPreferencia,
      minibio: body.minibio || undefined,
      status: 'EM_ANALISE',
      criadoEm: new Date().toISOString(),

      // O que o próprio profissional declara sobre o que atende.
      turnosDisponiveis,
      servicosPrestados,
      publicoAlvo: Array.isArray(body.publicoAlvo) ? body.publicoAlvo : [],
      publicoAlvoOutro: body.publicoAlvoOutro || undefined,
      especificarNecessidades: Boolean(body.especificarNecessidades),
      necessidadesAtendidas: Array.isArray(body.necessidadesAtendidas) ? body.necessidadesAtendidas : [],
      necessidadesOutro: body.necessidadesOutro || undefined,
      servicosHabilitados: servicosPrestados.length > 0
        ? derivarServicosHabilitados(servicosPrestados)
        : (Array.isArray(body.servicosHabilitados) ? body.servicosHabilitados : []),
      turmaViverMais: body.turmaViverMais || undefined,
      posGraduacaoViverMais: body.posGraduacaoViverMais || undefined,
      segundaPosGraduacao: body.segundaPosGraduacao || undefined,

      modalidadesAtendidas,
      exibirNaVitrine: true,
      limitePacientesAtivos: 5,
      pacientesAtivosCount: 0,
    };

    if (isMysqlConfigured()) {
      await new MysqlCaptureRepository().mutate((state) => ({
        next: {
          ...state,
          cadastrosPsicologos: [...state.cadastrosPsicologos, novoPsicologo],
        },
        result: novoPsicologo,
      }));

      return NextResponse.json({ success: true, data: novoPsicologo });
    }

    const snapshot = readSnapshot() ?? emptySnapshot();

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
