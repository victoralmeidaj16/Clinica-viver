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
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
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
import { opcoesAtendimentoDaPos } from '@/components/forms/opcoesPsicologo';
import { avisarCadastroRecebidoPorEmail } from '@/server/application/psychologistRegistrationEmail';
import { registrarAceiteTermoAdesao } from '@/server/application/termoAdesaoAceite';
import type { ComprovanteGerado } from '@/server/application/termoAdesaoComprovante';
import { montarComprovanteTermoAdesao } from '@/server/application/termoAdesaoComprovantePdf';
import { enviarComprovanteTermoAdesao } from '@/server/application/termoAdesaoComprovanteEmail';

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

/** Envia a via do termo ao profissional e à clínica e anota o resultado na prova. */
async function entregarComprovante(cadastro: CadastroPsicologoRecord, comprovante: ComprovanteGerado | null) {
  if (!comprovante) return 'nao_gerado' as const;
  const envio = await enviarComprovanteTermoAdesao(cadastro, comprovante);
  if (isMysqlConfigured()) {
    try {
      await new MysqlCaptureRepository().registrarEnvioComprovanteTermo(cadastro.id, envio);
    } catch (error) {
      console.error('Não foi possível registrar o envio do comprovante do termo:', error);
    }
  }
  return envio.situacao;
}

export async function GET() {
  try {
    await exigirGestao();
    const { cadastrosPsicologos: cadastros } = await getCaptureRepository().read();

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

    const opcoesAtendimento = opcoesAtendimentoDaPos(
      typeof body.posGraduacaoViverMais === 'string' ? body.posGraduacaoViverMais : undefined,
      typeof body.segundaPosGraduacao === 'string' ? body.segundaPosGraduacao : undefined
    );
    const servicosPrestados = Array.isArray(body.servicosPrestados)
      ? body.servicosPrestados.filter((servico: unknown): servico is string =>
          typeof servico === 'string' && (!opcoesAtendimento || opcoesAtendimento.servicos.includes(servico))
        )
      : [];
    const temposAtendimento = Array.isArray(body.temposAtendimento)
      ? body.temposAtendimento.filter((tempo: unknown): tempo is number => tempo === 50 || tempo === 90)
      : [];
    const publicoAlvo: unknown[] = Array.isArray(body.publicoAlvo) ? body.publicoAlvo : [];
    if (opcoesAtendimento && (servicosPrestados.length === 0 || temposAtendimento.length === 0)) {
      return NextResponse.json({ success: false, error: 'Selecione uma modalidade e um tempo de atendimento.' }, { status: 400 });
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
      temposAtendimento: temposAtendimento.length > 0 ? temposAtendimento : undefined,
      publicoAlvo: publicoAlvo as string[],
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

    const [emailDelivery, comprovanteTermo] = await Promise.all([
      avisarCadastroRecebidoPorEmail(novoPsicologo),
      entregarComprovante(novoPsicologo, comprovante),
    ]);

    return NextResponse.json({
      success: true,
      data: novoPsicologo,
      email: emailDelivery.situacao,
      comprovanteTermo,
    });
  } catch (error) {
    if (error instanceof CadastroDuplicadoError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    console.error('Erro ao salvar cadastro do psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar credenciamento no banco.' }, { status: 500 });
  }
}
