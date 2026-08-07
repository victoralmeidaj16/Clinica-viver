import { NextResponse } from 'next/server';
import {
  readSnapshot,
  writeSnapshot,
  type CadastroPsicologoRecord,
  type StatusCadastroPsicologo,
} from '@/server/application/persistence';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_VALIDOS: readonly StatusCadastroPsicologo[] = ['EM_ANALISE', 'APROVADO', 'RECUSADO'];

function listaDeTexto(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  return valor.filter((item): item is string => typeof item === 'string');
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

    const snapshot = readSnapshot();
    const existente = snapshot?.cadastrosPsicologos?.find((psi) => psi.id === id);

    if (!snapshot || !existente) {
      return NextResponse.json({ success: false, error: 'Cadastro não encontrado.' }, { status: 404 });
    }

    if (corpo.status !== undefined && !STATUS_VALIDOS.includes(corpo.status)) {
      return NextResponse.json({ success: false, error: 'Status inválido.' }, { status: 400 });
    }

    const exibirNaVitrine =
      typeof corpo.exibirNaVitrine === 'boolean' ? corpo.exibirNaVitrine : existente.exibirNaVitrine;

    const atualizado: CadastroPsicologoRecord = {
      ...existente,
      status: (corpo.status as StatusCadastroPsicologo) ?? existente.status,
      exibirNaVitrine,
      // O motivo acompanha a desativação e some com ela: motivo antigo grudado
      // num perfil reativado é ruído que a gestão lê como fato.
      motivoDesativacao: exibirNaVitrine
        ? undefined
        : (corpo.motivoDesativacao as string | undefined) ??
          existente.motivoDesativacao ??
          'Desativação manual pela gestão',
      nomeSocial: corpo.nomeSocial !== undefined ? corpo.nomeSocial || undefined : existente.nomeSocial,
      turnosDisponiveis: listaDeTexto(corpo.turnosDisponiveis) ?? existente.turnosDisponiveis,
      modalidadesAtendidas: listaDeTexto(corpo.modalidadesAtendidas) ?? existente.modalidadesAtendidas,
      servicosHabilitados: listaDeTexto(corpo.servicosHabilitados) ?? existente.servicosHabilitados,
      limitePacientesAtivos:
        typeof corpo.limitePacientesAtivos === 'number'
          ? corpo.limitePacientesAtivos
          : existente.limitePacientesAtivos,
      turmaViverMais:
        corpo.turmaViverMais !== undefined ? corpo.turmaViverMais || undefined : existente.turmaViverMais,
      posGraduacaoViverMais:
        corpo.posGraduacaoViverMais !== undefined
          ? corpo.posGraduacaoViverMais || undefined
          : existente.posGraduacaoViverMais,
    };

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      cadastrosPsicologos: (snapshot.cadastrosPsicologos ?? []).map((psi) =>
        psi.id === id ? atualizado : psi
      ),
    });

    return NextResponse.json({ success: true, data: atualizado });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao atualizar cadastro de psicólogo:', error);
    return NextResponse.json({ success: false, error: 'Falha ao atualizar o cadastro.' }, { status: 500 });
  }
}
