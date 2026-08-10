import { NextResponse } from 'next/server';
import {
  readSnapshot,
  writeSnapshot,
  type CadastroPsicologoRecord,
  type StatusCadastroPsicologo,
} from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { isBrazilUf } from '@/lib/brazilLocations';
import { municipioPertenceAoEstado } from '@/server/application/ibgeLocations';
import { validateGender } from '@/lib/gender';
import {
  CadastroIncompletoError,
  markWelcomeSent,
  provisionPsychologistAccess,
  validateApprovalAccess,
} from '@/server/application/psychologistAccess';
import { avisarBoasVindasPsicologo } from '@/server/application/viverMaisWhatsApp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_VALIDOS: readonly StatusCadastroPsicologo[] = ['EM_ANALISE', 'APROVADO', 'RECUSADO'];

function listaDeTexto(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  return valor.filter((item): item is string => typeof item === 'string');
}

function aplicarMudancas(
  existente: CadastroPsicologoRecord,
  corpo: Record<string, unknown>
): CadastroPsicologoRecord {
  const exibirNaVitrine =
    typeof corpo.exibirNaVitrine === 'boolean' ? corpo.exibirNaVitrine : existente.exibirNaVitrine;
  const estadoUf = corpo.estadoUf !== undefined
    ? String(corpo.estadoUf).trim().toUpperCase() || undefined
    : existente.estadoUf;
  const cidade = corpo.cidade !== undefined
    ? String(corpo.cidade).trim() || undefined
    : existente.cidade;
  const genero = corpo.genero !== undefined ? String(corpo.genero) : existente.genero;

  return {
    ...existente,
    status: (corpo.status as StatusCadastroPsicologo) ?? existente.status,
    nomeCompleto:
      typeof corpo.nomeCompleto === 'string' && corpo.nomeCompleto.trim()
        ? corpo.nomeCompleto.trim()
        : existente.nomeCompleto,
    crp: typeof corpo.crp === 'string' && corpo.crp.trim() ? corpo.crp.trim() : existente.crp,
    whatsapp: typeof corpo.whatsapp === 'string' ? corpo.whatsapp : existente.whatsapp,
    email: corpo.email !== undefined ? (corpo.email as string) || undefined : existente.email,
    estadoUf,
    cidade,
    genero,
    generoOutro: genero === 'OUTRO'
      ? (corpo.generoOutro !== undefined ? String(corpo.generoOutro).trim() || undefined : existente.generoOutro)
      : undefined,
    cidadeUf: cidade && estadoUf ? `${cidade}/${estadoUf}` : existente.cidadeUf,
    especialidade:
      corpo.especialidade !== undefined ? (corpo.especialidade as string) || undefined : existente.especialidade,
    modalidadeAtendimento:
      corpo.modalidadeAtendimento !== undefined
        ? (corpo.modalidadeAtendimento as string) || undefined
        : existente.modalidadeAtendimento,
    minibio: corpo.minibio !== undefined ? (corpo.minibio as string) || undefined : existente.minibio,
    exibirNaVitrine,
    motivoDesativacao: exibirNaVitrine
      ? undefined
      : (corpo.motivoDesativacao as string | undefined) ??
        existente.motivoDesativacao ??
        'Desativação manual pela gestão',
    nomeSocial:
      corpo.nomeSocial !== undefined
        ? (corpo.nomeSocial as string) || undefined
        : existente.nomeSocial,
    turnosDisponiveis: listaDeTexto(corpo.turnosDisponiveis) ?? existente.turnosDisponiveis,
    modalidadesAtendidas:
      listaDeTexto(corpo.modalidadesAtendidas) ??
      (existente.modalidadesAtendidas && existente.modalidadesAtendidas.length > 0
        ? existente.modalidadesAtendidas
        : ['SOCIAL', 'PARTICULAR']),
    servicosHabilitados: listaDeTexto(corpo.servicosHabilitados) ?? existente.servicosHabilitados,
    limitePacientesAtivos:
      typeof corpo.limitePacientesAtivos === 'number'
        ? corpo.limitePacientesAtivos
        : existente.limitePacientesAtivos,
    turmaViverMais:
      corpo.turmaViverMais !== undefined
        ? (corpo.turmaViverMais as string) || undefined
        : existente.turmaViverMais,
    posGraduacaoViverMais:
      corpo.posGraduacaoViverMais !== undefined
        ? (corpo.posGraduacaoViverMais as string) || undefined
        : existente.posGraduacaoViverMais,
    segundaPosGraduacao:
      corpo.segundaPosGraduacao !== undefined
        ? (corpo.segundaPosGraduacao as string) || undefined
        : existente.segundaPosGraduacao,
  };
}

/**
 * Decisões da gestão sobre um cadastro: aprovar, recusar e ligar/desligar do
 * rodízio.
 *
 * O toggle vive aqui, e não numa rota própria, porque é a mesma coisa que a
 * aprovação sob outro nome: as duas respondem "esta pessoa recebe pacientes
 * agora?". Separá-las criaria dois lugares para desligar alguém e a
 * possibilidade de discordarem.
 *
 * Só os campos presentes no corpo são alterados — o `PATCH` é parcial de
 * verdade, para que desligar o perfil não apague, de passagem, os turnos e
 * serviços que a gestão levou tempo cadastrando.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();

    const { id } = await params;
    const corpo = await request.json();

    if (corpo.status !== undefined && !STATUS_VALIDOS.includes(corpo.status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }
    if (corpo.whatsapp !== undefined) {
      const whatsapp = normalizeBrazilPhone(corpo.whatsapp);
      if (!whatsapp) {
        return NextResponse.json({ success: false, error: 'Informe um telefone brasileiro válido com DDD.' }, { status: 400 });
      }
      corpo.whatsapp = whatsapp;
    }
    if (corpo.estadoUf !== undefined && !isBrazilUf(corpo.estadoUf)) {
      return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 });
    }
    if (corpo.cidade !== undefined && !String(corpo.cidade).trim()) {
      return NextResponse.json({ success: false, error: 'Cidade inválida.' }, { status: 400 });
    }
    if (corpo.genero !== undefined || corpo.generoOutro !== undefined) {
      const genero = validateGender(corpo.genero, corpo.generoOutro);
      if (!genero) {
        return NextResponse.json({ success: false, error: 'Selecione o gênero e informe a descrição quando escolher Outro.' }, { status: 400 });
      }
      corpo.genero = genero.gender;
      corpo.generoOutro = genero.other;
    }
    if (corpo.estadoUf !== undefined || corpo.cidade !== undefined) {
      const estadoUf = String(corpo.estadoUf ?? '').trim().toUpperCase();
      const cidade = String(corpo.cidade ?? '').trim();
      if (!isBrazilUf(estadoUf) || !cidade) {
        return NextResponse.json({ success: false, error: 'Informe estado e cidade juntos.' }, { status: 400 });
      }
      try {
        if (!(await municipioPertenceAoEstado(estadoUf, cidade))) {
          return NextResponse.json({ success: false, error: 'Selecione uma cidade oficial da UF informada.' }, { status: 400 });
        }
      } catch (error) {
        console.error('Erro ao validar município no IBGE:', error);
        return NextResponse.json({ success: false, error: 'Não foi possível validar a cidade agora. Tente novamente.' }, { status: 503 });
      }
    }
    if (
      corpo.limitePacientesAtivos !== undefined &&
      (!Number.isInteger(corpo.limitePacientesAtivos) || Number(corpo.limitePacientesAtivos) < 1 || Number(corpo.limitePacientesAtivos) > 5)
    ) {
      return NextResponse.json({ success: false, error: 'O limite deve ser um número inteiro entre 1 e 5.' }, { status: 400 });
    }

    if (isMysqlConfigured()) {
      const atualizado = await new MysqlCaptureRepository().mutate((state) => {
        const existente = state.cadastrosPsicologos.find((psi) => psi.id === id);
        if (!existente) return { next: state, result: null };
        const next = aplicarMudancas(existente, corpo);
        if (next.status === 'APROVADO') validateApprovalAccess(next);
        return {
          next: {
            ...state,
            cadastrosPsicologos: state.cadastrosPsicologos.map((psi) =>
              psi.id === id ? next : psi
            ),
          },
          result: next,
        };
      });

      if (!atualizado) {
        return NextResponse.json({ success: false, error: 'Cadastro não encontrado.' }, { status: 404 });
      }
      let acesso: { criado: boolean; boasVindas: string } | undefined;
      if (atualizado.status === 'APROVADO' && (!atualizado.usuarioRef || !atualizado.boasVindasEnviadaEm)) {
        const provisioned = await provisionPsychologistAccess(atualizado);
        let boasVindas = 'conta_existente';
        if (provisioned.activationToken) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://clinica-viver-web.vercel.app';
          const activationUrl = `${appUrl}/ativar-conta?token=${encodeURIComponent(provisioned.activationToken)}`;
          const delivery = await avisarBoasVindasPsicologo(atualizado, activationUrl);
          boasVindas = delivery.situacao;
          if (delivery.situacao === 'enviada') await markWelcomeSent(atualizado.id);
        }
        acesso = { criado: true, boasVindas };
      }
      return NextResponse.json({ success: true, data: atualizado, acesso });
    }

    const snapshot = readSnapshot();
    const existente = snapshot?.cadastrosPsicologos?.find((psi) => psi.id === id);

    if (!snapshot || !existente) {
      return NextResponse.json({ success: false, error: 'Cadastro não encontrado.' }, { status: 404 });
    }

    const atualizado = aplicarMudancas(existente, corpo);

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      cadastrosPsicologos: (snapshot.cadastrosPsicologos ?? []).map((psi) =>
        psi.id === id ? atualizado : psi
      ),
    });

    return NextResponse.json({ success: true, data: atualizado });
  } catch (error) {
    if (error instanceof CadastroIncompletoError) {
      return NextResponse.json({ success: false, error: error.message, campos: error.campos }, { status: 422 });
    }
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao atualizar cadastro de psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar o cadastro.' }, { status: 500 });
  }
}
