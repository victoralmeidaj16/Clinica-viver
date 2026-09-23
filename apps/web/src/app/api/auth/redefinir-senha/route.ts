import { resetPsychologistPassword } from '@/server/application/passwordReset';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { startSession } from '@/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const account = await resetPsychologistPassword(String(body.token ?? '').trim(), String(body.password ?? ''));
    await startSession(account);
    return success({ reset: true, destination: '/cockpit' });
  } catch (error) {
    // Só as recusas previstas (senha fraca, link vencido) chegam ao navegador;
    // falha de banco ou de sessão fica no log, sem expor detalhe interno.
    if (error instanceof ApplicationError) return failure(error);
    console.error('[redefinir-senha] Falha ao redefinir a senha:', error);
    return failure(new ApplicationError('PASSWORD_RESET_FAILED', 'Não foi possível redefinir a senha agora. Tente novamente em instantes.', 500));
  }
}
