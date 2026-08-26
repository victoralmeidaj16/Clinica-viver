import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
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
import { avisarCadastroRecebidoPorEmail } from '@/server/application/psychologistRegistrationEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function comEstadoOperacionalUnificado(cadastro: CadastroPsicologoRecord): CadastroPsicologoRecord {
  // Cadastros antigos podiam estar ocultos sem pausa. Na gestão, eles passam a
  // aparecer como pausados para que o único botão disponível consiga retomá-los.
  const pausadoNoRodizio = Boolean(
    cadastro.pausadoNoRodizio || cadastro.exibirNaVitrine === false
  );
  return {
    ...cadastro,
    pausadoNoRodizio,
    exibirNaVitrine: !pausadoNoRodizio,
  };
}

/**
 * Acrescenta a cada cadastro se a pessoa já definiu senha.
 *
 * O credenciamento tem três marcos — convite enviado, acesso provisionado e
 * conta ativada — e só os dois primeiros estão no próprio registro
 * (`boasVindasEnviadaEm`, `acessoCriadoEm`). O terceiro vive em
 * `clinica_usuarios.senha_definida_em`, porque quem define senha é o usuário,
 * não o cadastro. Sem esta junção a gestão veria "convite enviado" para sempre,
 * inclusive depois da pessoa já estar usando o sistema.
 *
 * Em modo demonstração o dado não existe: `contaAtivada` fica indefinido, e a
 * tela mostra o marco como desconhecido em vez de afirmar que não aconteceu.
 */
async function comEstadoDeAcesso(
  cadastros: readonly CadastroPsicologoRecord[]
): Promise<Array<CadastroPsicologoRecord & { contaAtivada?: boolean }>> {
  const referencias = cadastros
    .map((psi) => psi.usuarioRef)
    .filter((ref): ref is string => Boolean(ref));

  if (!isMysqlConfigured() || referencias.length === 0) {
    return cadastros.map(comEstadoOperacionalUnificado);
  }

  try {
    const [linhas] = await getMysqlPool().query<
      Array<RowDataPacket & { ref_core: string; senha_definida_em: string | null }>
    >(
      `SELECT ref_core, senha_definida_em
         FROM clinica_usuarios
        WHERE instituicao_id = ? AND ref_core IN (?)`,
      [instituicaoId(), referencias]
    );
    const ativados = new Set(
      linhas.filter((linha) => linha.senha_definida_em).map((linha) => linha.ref_core)
    );
    return cadastros.map((psi) => ({
      ...comEstadoOperacionalUnificado(psi),
      contaAtivada: psi.usuarioRef ? ativados.has(psi.usuarioRef) : false,
    }));
  } catch (error) {
    // O semáforo é informativo: listar a equipe é mais importante do que saber
    // quem já entrou.
    console.error('Não foi possível apurar contas ativadas:', error);
    return cadastros.map(comEstadoOperacionalUnificado);
  }
}

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
    const cadastros = isMysqlConfigured()
      ? (await new MysqlCaptureRepository().read()).cadastrosPsicologos
      : readSnapshot()?.cadastrosPsicologos ?? [];

    return NextResponse.json({ success: true, data: await comEstadoDeAcesso(cadastros) });
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
    const logradouro = String(body.logradouro ?? '').trim();
    const bairro = String(body.bairro ?? '').trim();
    const email = String(body.email ?? '').trim().toLocaleLowerCase('pt-BR');
    const genero = validateGender(body.genero, body.generoOutro);

    if (!whatsapp) {
      return NextResponse.json({ success: false, error: 'Informe um telefone brasileiro válido com DDD.' }, { status: 400 });
    }
    if (!isBrazilUf(estadoUf) || !cidade) {
      return NextResponse.json({ success: false, error: 'Selecione o estado e a cidade.' }, { status: 400 });
    }
    if (!logradouro || !bairro) {
      return NextResponse.json({ success: false, error: 'Informe rua/logradouro e bairro.' }, { status: 400 });
    }
    if (!genero) {
      return NextResponse.json({ success: false, error: 'Selecione o gênero e informe a descrição quando escolher Outro.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Informe um e-mail profissional válido.' }, { status: 400 });
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
      email,
      fotoUrl: body.fotoUrl || undefined,
      estadoUf,
      cidade,
      logradouro,
      bairro,
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

    } else {
      const snapshot = readSnapshot() ?? emptySnapshot();
      await writeSnapshot({
        ...snapshot,
        savedAt: new Date().toISOString(),
        cadastrosPsicologos: [
          ...(snapshot.cadastrosPsicologos ?? []),
          novoPsicologo,
        ],
      });
    }

    const emailDelivery = await avisarCadastroRecebidoPorEmail(novoPsicologo);

    return NextResponse.json({
      success: true,
      data: novoPsicologo,
      email: emailDelivery.situacao,
    });
  } catch (error) {
    console.error('Erro ao salvar cadastro do psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar credenciamento no banco.' }, { status: 500 });
  }
}
