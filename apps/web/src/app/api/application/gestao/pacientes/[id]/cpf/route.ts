import { readSession } from '@/server/auth';
import { failure, readJson, success } from '@/server/application/http';
import { definirCpfDoPaciente } from '@/server/application/patientFiscalIdentity';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Grava o CPF do paciente — pré-requisito do tomador na NFS-e.
 *
 * Restrito à gestão pelo mesmo porteiro do diretório de pacientes: é o cadastro
 * da clínica, e o psicólogo não edita cadastro. `id` aceita o identificador que
 * a listagem devolve, inclusive o `lead:<id>` de quem ainda está em triagem.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirGestao();
    const session = await readSession();
    if (!session) throw new NaoAutorizadoError(401, 'Faça login para continuar.');

    const { id } = await params;
    const body = await readJson(request);
    return success(await definirCpfDoPaciente(session.organizationId, decodeURIComponent(id), body.cpf));
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: error.message } }, { status: error.status });
    }
    return failure(error);
  }
}
