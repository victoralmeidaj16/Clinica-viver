import { resolveRequestContext } from '@/server/application/context';
import { updatePatientConvenio } from '@/server/application/convenioService';
import { failure, readJson, success } from '@/server/application/http';
import { nomeDoUsuario } from '@/server/application/autorGestao';
import { auditarPaciente, estadoDoPaciente } from '@/server/application/auditoriaPaciente';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await resolveRequestContext(request, true);
    const pacienteRef = decodeURIComponent(id);
    const antes = await estadoDoPaciente(context.actor.organizationId, pacienteRef);
    const resultado = await updatePatientConvenio(context, pacienteRef, await readJson(request));
    // Convênio e pagador, antes e depois (13.02).
    await auditarPaciente({ organizationId: context.actor.organizationId, pacienteRef, acao: 'alterar_convenio', antes,
      depois: await estadoDoPaciente(context.actor.organizationId, pacienteRef),
      autor: { usuarioRef: context.actor.userId, nome: await nomeDoUsuario(context.actor.userId) } });
    return success(resultado);
  } catch (error) { return failure(error); }
}
