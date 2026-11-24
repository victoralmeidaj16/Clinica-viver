import { readSession } from '@/server/auth';
import { failure, readJson, success } from '@/server/application/http';
import { definirCpfDoPaciente } from '@/server/application/patientFiscalIdentity';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { nomeDoUsuario } from '@/server/application/autorGestao';
import { auditarPaciente, estadoDoPaciente } from '@/server/application/auditoriaPaciente';
import { mascararCpf } from '@/lib/auditoria';

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
    const referencia = decodeURIComponent(id);
    const antes = referencia.startsWith('lead:') ? null : await estadoDoPaciente(session.organizationId, referencia);
    const resultado = await definirCpfDoPaciente(session.organizationId, referencia, body.cpf);
    // CPF entra mascarado na trilha (13.02); lead em triagem ainda sem cadastro fica com o ref do lead.
    const pacienteRef = resultado.patientId ?? referencia;
    await auditarPaciente({ organizationId: session.organizationId, pacienteRef, acao: 'definir_cpf',
      antes: antes ?? { cpf: null }, depois: resultado.patientId ? await estadoDoPaciente(session.organizationId, resultado.patientId) : { cpf: mascararCpf(resultado.cpf) },
      rotulos: { cpf: 'CPF' }, autor: { usuarioRef: session.userId, nome: await nomeDoUsuario(session.userId) } });
    return success(resultado);
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: error.message } }, { status: error.status });
    }
    return failure(error);
  }
}
