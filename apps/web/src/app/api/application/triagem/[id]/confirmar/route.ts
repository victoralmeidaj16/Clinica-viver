import { NextResponse } from 'next/server';
import { emptySnapshot, readSnapshot, writeSnapshot, type CadastroPsicologoRecord, type PersistedSnapshot, type TriagemPacienteRecord } from '@/server/application/persistence';
import { isMysqlConfigured } from '@/server/oci/runtime';
import { captureStateAsSnapshot, captureStateFromSnapshot, MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
import { validarTokenConfirmacao } from '@/server/viverMaisConfirmToken';
import { alocarLead, recalcularPacientesAtivos } from '@/server/application/viverMaisRodizio';
import { avisarTransbordo } from '@/server/application/viverMaisWhatsApp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConfirmacaoResult =
  | { kind: 'not_found' }
  | { kind: 'conflict' }
  | { kind: 'capacity_reallocated'; lead: TriagemPacienteRecord; psicologo: CadastroPsicologoRecord }
  | { kind: 'capacity_pending'; lead: TriagemPacienteRecord; psicologo?: undefined }
  | { kind: 'already_confirmed'; data: { nomePaciente: string; telefone: string; confirmadoEm: string } }
  | { kind: 'confirmed'; data: { nomePaciente: string; telefone: string; confirmadoEm: string } };

function confirmarContato(
  snapshot: PersistedSnapshot,
  id: string,
  psicologoId: string
): { next: PersistedSnapshot; result: ConfirmacaoResult } {
  const atual = recalcularPacientesAtivos(snapshot);
  const lead = atual.triagensPacientes?.find((item) => item.id === id);
  if (!lead) return { next: atual, result: { kind: 'not_found' } };
  if (lead.psicologoAlocadoId !== psicologoId) return { next: atual, result: { kind: 'conflict' } };

  if (lead.confirmadoEm) {
    return {
      next: atual,
      result: { kind: 'already_confirmed', data: { nomePaciente: lead.nomePaciente, telefone: lead.telefone, confirmadoEm: lead.confirmadoEm } },
    };
  }

  const psicologo = atual.cadastrosPsicologos?.find((item) => item.id === psicologoId);
  if (psicologo && (psicologo.pacientesAtivosCount ?? 0) >= (psicologo.limitePacientesAtivos ?? 5)) {
    const paraRealocar: TriagemPacienteRecord = {
      ...lead,
      status: 'PENDENTE_ATRIBUICAO',
      psicologoAlocadoId: undefined,
      psicologoNome: undefined,
      alocadoEm: undefined,
      confirmadoEm: undefined,
      slaExpirado: false,
    };
    const base = {
      ...atual,
      triagensPacientes: (atual.triagensPacientes ?? []).map((item) => item.id === id ? paraRealocar : item),
    };
    const realocado = alocarLead(base, paraRealocar);
    return realocado.psicologo
      ? {
          next: realocado.snapshot,
          result: { kind: 'capacity_reallocated', lead: realocado.lead, psicologo: realocado.psicologo },
        }
      : {
          next: realocado.snapshot,
          result: { kind: 'capacity_pending', lead: realocado.lead },
        };
  }

  const confirmadoEm = new Date().toISOString();
  const confirmado: TriagemPacienteRecord = { ...lead, status: 'CONTATO_CONFIRMADO', confirmadoEm };
  const next = recalcularPacientesAtivos({
    ...atual,
    triagensPacientes: (atual.triagensPacientes ?? []).map((item) => item.id === id ? confirmado : item),
  });
  return {
    next,
    result: { kind: 'confirmed', data: { nomePaciente: confirmado.nomePaciente, telefone: confirmado.telefone, confirmadoEm } },
  };
}

/**
 * Confirmação de primeiro contato pelo psicólogo.
 *
 * Rota pública por necessidade — quem clica veio do WhatsApp, sem sessão — e
 * autorizada pelo token assinado do link. O par lead + psicólogo está dentro da
 * assinatura, então o link de uma alocação não confirma outra, e o link de
 * quem perdeu o lead no transbordo não serve mais.
 *
 * Idempotente: reconfirmar devolve sucesso e preserva a hora original. Quem
 * clica duas vezes no WhatsApp não deve ver erro, e a primeira confirmação é a
 * que vale para o SLA.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const psicologoId = url.searchParams.get('psi');
    const token = url.searchParams.get('t');

    if (!psicologoId || !validarTokenConfirmacao(id, psicologoId, token)) {
      return NextResponse.json(
        { success: false, error: 'Link de confirmação inválido ou expirado.' },
        { status: 403 }
      );
    }

    if (isMysqlConfigured()) {
      const resultado = await new MysqlCaptureRepository().mutate<ConfirmacaoResult>((state) => {
        const handled = confirmarContato(captureStateAsSnapshot(state), id, psicologoId);
        return { next: captureStateFromSnapshot(handled.next), result: handled.result };
      });

      if (resultado.kind === 'not_found') {
        return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
      }
      if (resultado.kind === 'conflict') {
        return NextResponse.json(
          { success: false, error: 'Este atendimento já foi encaminhado a outro profissional pelo prazo de 24h.' },
          { status: 409 }
        );
      }
      if (resultado.kind === 'capacity_reallocated' || resultado.kind === 'capacity_pending') {
        if (resultado.psicologo) void avisarTransbordo(resultado.lead, resultado.psicologo);
        return NextResponse.json(
          {
            success: false,
            realocado: resultado.kind === 'capacity_reallocated',
            error: resultado.kind === 'capacity_reallocated'
              ? 'Seu limite de 5 pacientes ativos foi atingido. O atendimento foi encaminhado ao próximo profissional.'
              : 'Seu limite de 5 pacientes ativos foi atingido. O atendimento retornou para a fila da gestão.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({
        success: true,
        jaConfirmado: resultado.kind === 'already_confirmed',
        data: resultado.data,
      });
    }

    const snapshot = readSnapshot() ?? emptySnapshot();
    const handled = confirmarContato(snapshot, id, psicologoId);
    const resultado = handled.result;

    if (resultado.kind === 'not_found') {
      return NextResponse.json({ success: false, error: 'Solicitação não encontrada.' }, { status: 404 });
    }
    if (resultado.kind === 'conflict') {
      return NextResponse.json(
        { success: false, error: 'Este atendimento já foi encaminhado a outro profissional pelo prazo de 24h.' },
        { status: 409 }
      );
    }
    await writeSnapshot({ ...handled.next, savedAt: new Date().toISOString() });
    if (resultado.kind === 'capacity_reallocated' || resultado.kind === 'capacity_pending') {
      if (resultado.psicologo) void avisarTransbordo(resultado.lead, resultado.psicologo);
      return NextResponse.json({ success: false, realocado: resultado.kind === 'capacity_reallocated', error: resultado.kind === 'capacity_reallocated' ? 'Seu limite de 5 pacientes ativos foi atingido. O atendimento foi encaminhado ao próximo profissional.' : 'Seu limite de 5 pacientes ativos foi atingido. O atendimento retornou para a fila da gestão.' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      jaConfirmado: resultado.kind === 'already_confirmed',
      data: resultado.data,
    });
  } catch (error) {
    console.error('Erro ao confirmar contato:', error);
    return NextResponse.json({ success: false, error: 'Falha ao registrar a confirmação.' }, { status: 500 });
  }
}
