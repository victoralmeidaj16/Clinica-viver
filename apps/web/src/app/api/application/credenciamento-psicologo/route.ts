import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { CadastroDuplicadoError } from '@/server/application/psychologistUniqueness';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import {
  type CadastroPsicologoRecord,
} from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { isBrazilUf } from '@/lib/brazilLocations';
import { municipioPertenceAoEstado } from '@/server/application/brazilLocalities';
import { validateGender } from '@/lib/gender';
import {
  derivarModalidadesAtendidas,
  derivarServicosHabilitados,
} from '@/server/application/psychologistRegistration';
import { CATALOGO_CURSOS_PADRAO, opcoesAtendimentoDaPos } from '@/components/forms/opcoesPsicologo';
import { normalizarCodigoTurma } from '@/lib/turmasCiclo';
import { obterCatalogoCursos } from '@/server/application/catalogoCursos';
import { turmasAbertasPorCurso } from '@/server/application/turmasGestao';
import { avisarCadastroRecebidoPorEmail } from '@/server/application/psychologistRegistrationEmail';
import { registrarAceiteTermoAdesao } from '@/server/application/termoAdesaoAceite';
import type { ComprovanteGerado } from '@/server/application/termoAdesaoComprovante';
import { montarComprovanteTermoAdesao } from '@/server/application/termoAdesaoComprovantePdf';
import { validarAcessibilidade } from '@/lib/psychologistAccessibility';
import { posicoesDoRodizio } from '@/server/application/gestaoRodizio';

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
/**
 * Gera o PDF do aceite antes de gravar o cadastro, para que o SHA-256 do
 * arquivo que vai por e-mail fique na própria prova. Uma falha aqui não impede
 * o credenciamento: a prova continua gravada e o PDF pode ser regerado.
 */
async function prepararComprovante(cadastro: CadastroPsicologoRecord): Promise<ComprovanteGerado | null> {
  try {
    return await montarComprovanteTermoAdesao(cadastro);
  } catch (error) {
    console.error('Não foi possível gerar o comprovante do Termo de Adesão:', error);
    return null;
  }
}

export async function GET() {
  try {
    await exigirGestao();
    const { cadastrosPsicologos: cadastros } = await getCaptureRepository().read();
    const posicoes = posicoesDoRodizio(cadastros);
    const data = (await comEstadoDeAcesso(cadastros)).map((cadastro) => ({
      ...cadastro, rodizio: posicoes.get(cadastro.id),
    }));
    return NextResponse.json({ success: true, data });
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
    const fotoUrl = typeof body.fotoUrl === 'string' ? body.fotoUrl.trim() : '';
    const acessibilidade = validarAcessibilidade(body.acessibilidade);

    if (!fotoUrl) return NextResponse.json({ success: false, error: 'Envie uma foto de perfil para concluir o cadastro.' }, { status: 400 });
    if (!acessibilidade.ok) return NextResponse.json({ success: false, error: acessibilidade.error }, { status: 400 });

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
    if (body.aceitouTermos !== true) {
      return NextResponse.json({ success: false, error: 'Leia e aceite o Termo de Adesão e Condições de Uso para enviar o cadastro.' }, { status: 400 });
    }
    if (!municipioPertenceAoEstado(estadoUf, cidade)) {
      return NextResponse.json({ success: false, error: 'Selecione uma cidade oficial da UF informada.' }, { status: 400 });
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

    // Curso e turma do catálogo da Gestão (1.01 e 3.2). Sem o catálogo ou
    // as turmas no banco, valem o padrão e a lista anterior.
    const catalogo = await obterCatalogoCursos().catch(() => [...CATALOGO_CURSOS_PADRAO]);
    const turmasAbertas = await turmasAbertasPorCurso(catalogo).catch(() => ({} as Record<string, string[]>));
    const posPrincipal = typeof body.posGraduacaoViverMais === 'string' ? body.posGraduacaoViverMais.trim() : '';
    const segundaPos = typeof body.segundaPosGraduacao === 'string' ? body.segundaPosGraduacao.trim() : '';
    const cursoAtivo = (nome: string) => catalogo.some((curso) => curso.nome === nome && curso.ativo);
    if (posPrincipal && !cursoAtivo(posPrincipal)) {
      return NextResponse.json({ success: false, error: 'Selecione uma pós-graduação da lista da Viver Mais.' }, { status: 400 });
    }
    if (segundaPos && (!cursoAtivo(segundaPos) || segundaPos === posPrincipal)) {
      return NextResponse.json({ success: false, error: 'Selecione uma segunda pós-graduação diferente da principal.' }, { status: 400 });
    }
    const turmaPrincipal = body.turmaViverMais ? normalizarCodigoTurma(body.turmaViverMais) : undefined;
    const turmaSegunda = segundaPos && body.segundaTurmaViverMais ? normalizarCodigoTurma(body.segundaTurmaViverMais) : undefined;
    const turmaAberta = (curso: string, turma: string | undefined) =>
      !turma || !turmasAbertas[curso] || turmasAbertas[curso].includes(turma);
    if ((body.turmaViverMais && !turmaPrincipal) || !turmaAberta(posPrincipal, turmaPrincipal)
      || (body.segundaTurmaViverMais && segundaPos && !turmaSegunda) || !turmaAberta(segundaPos, turmaSegunda)) {
      return NextResponse.json({ success: false, error: 'Selecione uma turma aberta do curso escolhido.' }, { status: 400 });
    }
    const opcoesAtendimento = opcoesAtendimentoDaPos(posPrincipal || undefined, segundaPos || undefined, catalogo);
    const servicosPrestados = Array.isArray(body.servicosPrestados)
      ? body.servicosPrestados.filter((servico: unknown): servico is string =>
          typeof servico === 'string' && (!opcoesAtendimento || opcoesAtendimento.servicos.includes(servico))
        )
      : [];
    const publicoAlvo: unknown[] = Array.isArray(body.publicoAlvo) ? body.publicoAlvo : [];
    const temposSolicitados: unknown[] = Array.isArray(body.temposAtendimento) ? body.temposAtendimento : [];
    const temposAtendimento = temposSolicitados.filter((tempo): tempo is number =>
      typeof tempo === 'number' && Boolean(opcoesAtendimento?.tempos.includes(tempo)));
    if (opcoesAtendimento?.tempos.length && (!temposAtendimento.length || temposAtendimento.length !== temposSolicitados.length)) {
      return NextResponse.json({ success: false, error: 'Selecione ao menos um tempo de atendimento permitido para sua pós-graduação.' }, { status: 400 });
    }
    if (opcoesAtendimento && servicosPrestados.length === 0) {
      return NextResponse.json({ success: false, error: 'Selecione ao menos um serviço de atendimento.' }, { status: 400 });
    }
    if (opcoesAtendimento && (publicoAlvo.length === 0 || publicoAlvo.some((publico) =>
      typeof publico !== 'string' || !opcoesAtendimento.publico.includes(publico)))) {
      return NextResponse.json({ success: false, error: 'Selecione apenas os públicos permitidos para a pós-graduação.' }, { status: 400 });
    }

    // A prova do aceite é apurada aqui, não no navegador: data e hora do
    // servidor, IP, navegador e hash do texto da versão exibida.
    const aceite = registrarAceiteTermoAdesao(request, body.versaoTermos);

    const novoPsicologo: CadastroPsicologoRecord = {
      id: `psi-cad-${randomUUID()}`,
      nomeCompleto: body.nomeCompleto,
      nomeSocial: body.nomeSocial || undefined,
      crp: body.crp,
      whatsapp,
      email,
      fotoUrl,
      acessibilidade: acessibilidade.data,
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
      temposAtendimento: temposAtendimento.length ? [...new Set(temposAtendimento)] : undefined,
      publicoAlvo: publicoAlvo as string[],
      publicoAlvoOutro: body.publicoAlvoOutro || undefined,
      especificarNecessidades: Boolean(body.especificarNecessidades),
      necessidadesAtendidas: Array.isArray(body.necessidadesAtendidas) ? body.necessidadesAtendidas : [],
      necessidadesOutro: body.necessidadesOutro || undefined,
      servicosHabilitados: servicosPrestados.length > 0
        ? derivarServicosHabilitados(servicosPrestados)
        : (Array.isArray(body.servicosHabilitados) ? body.servicosHabilitados : []),
      turmaViverMais: turmaPrincipal,
      posGraduacaoViverMais: posPrincipal || undefined,
      segundaPosGraduacao: segundaPos || undefined,
      ...(turmaSegunda ? { segundaTurmaViverMais: turmaSegunda } : {}),
      aceitouTermos: true,
      aceitouTermosEm: aceite.aceitoEm,
      versaoTermos: aceite.versao,
      aceiteTermoAdesao: aceite,

      modalidadesAtendidas,
      exibirNaVitrine: true,
      limitePacientesAtivos: 5,
      pacientesAtivosCount: 0,
    };

    const comprovante = await prepararComprovante(novoPsicologo);
    if (comprovante) {
      novoPsicologo.aceiteTermoAdesao = {
        ...aceite,
        comprovante: {
          arquivo: comprovante.arquivo,
          sha256: comprovante.sha256,
          codigoVerificacao: comprovante.codigoVerificacao,
        },
      };
    }

    await getCaptureRepository().mutate((state) => ({
      next: {
        ...state,
        cadastrosPsicologos: [...state.cadastrosPsicologos, novoPsicologo],
      },
      result: novoPsicologo,
    }));

    const emailDelivery = await avisarCadastroRecebidoPorEmail(novoPsicologo);

    return NextResponse.json({
      success: true,
      data: novoPsicologo,
      email: emailDelivery.situacao,
      comprovanteTermo: 'aguardando_aprovacao',
    });
  } catch (error) {
    if (error instanceof CadastroDuplicadoError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    console.error('Erro ao salvar cadastro do psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar credenciamento no banco.' }, { status: 500 });
  }
}
