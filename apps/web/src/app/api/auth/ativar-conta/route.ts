import { activatePsychologistAccount } from '@/server/application/psychologistAccess';
import { startSession } from '@/server/auth';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const token = String(body.token ?? '').trim();
    const password = String(body.password ?? '');
    if (!token) throw new ApplicationError('INVALID_INVITE', 'Link de ativação inválido.', 400);
    const account = await activatePsychologistAccount(token, password);
    await startSession(account);
    return success({ activated: true, destination: '/meu-cadastro' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível ativar a conta.';
    return failure(new ApplicationError('ACTIVATION_FAILED', message, 400));
  }
}
