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
    const message = error instanceof Error ? error.message : 'Não foi possível redefinir a senha.';
    return failure(new ApplicationError('PASSWORD_RESET_FAILED', message, 400));
  }
}
