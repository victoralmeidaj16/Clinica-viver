import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { inativarPelaGestao, reativarPelaGestao } from '@/server/application/patientInactivation';
import { falhaGestao } from '@/server/application/respostaGestao';
import { registrarAlteracao } from '@/server/application/auditoriaAlteracoes';
import type { TriagemPacienteRecord } from '@/server/application/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inativação e reativação do vínculo pela Gestão (6.05 e 13.01).
 *
 * `acao`: `INATIVAR` (com `motivo`) ou `REATIVAR` (com `justificativa` e
 * `excederLimite` quando o psicólogo estiver lotado).
 */
export async function POST(request: Request) {
  try {
    const { sessao, autor } = await exigirGestaoComAutor();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const referencia = {
      patientId: String(body.patientId ?? '').trim() || undefined,
      leadId: String(body.leadId ?? '').trim() || undefined,
    };
    // Situação do vínculo antes e depois, com o motivo (13.02).
    const auditar = (lead: TriagemPacienteRecord, acao: string, de: string, para: string, motivo: unknown) =>
      registrarAlteracao({ organizationId: sessao.organizationId, modulo: 'pacientes', entidadeTipo: 'paciente',
        entidadeRef: lead.pacienteRef ?? `lead:${lead.id}`, entidadeRotulo: `${lead.nomeSocial || lead.nomePaciente} (${lead.protocolo})`,
        acao, campos: [{ campo: 'status_vinculo', rotulo: 'Situação do vínculo', anterior: de, novo: para }],
        motivo: typeof motivo === 'string' ? motivo : undefined, autor });
    if (body.acao === 'INATIVAR') {
      const lead = await inativarPelaGestao(sessao.organizationId, autor, referencia, body.motivo);
      await auditar(lead, 'inativar_vinculo', `Ativo${lead.psicologoNome ? ` com ${lead.psicologoNome}` : ''}`, 'Inativo', body.motivo);
      return NextResponse.json({ success: true, data: lead });
    }
    if (body.acao === 'REATIVAR') {
      const lead = await reativarPelaGestao(sessao.organizationId, autor, referencia, {
        justificativa: typeof body.justificativa === 'string' ? body.justificativa : undefined,
        excederLimite: body.excederLimite === true,
      });
      await auditar(lead, 'reativar_vinculo', 'Inativo', `Ativo${lead.psicologoNome ? ` com ${lead.psicologoNome}` : ''}${body.excederLimite === true ? ' (acima do limite)' : ''}`, body.justificativa);
      return NextResponse.json({ success: true, data: lead });
    }
    return NextResponse.json({ success: false, error: 'Ação desconhecida.' }, { status: 400 });
  } catch (error) {
    return falhaGestao(error, 'Erro ao inativar/reativar vínculo', 'Falha ao atualizar o vínculo.');
  }
}
