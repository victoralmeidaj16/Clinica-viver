import { createPsychologistPasswordReset } from '@/server/application/passwordReset';
import { passwordResetEmailConfigured, sendPasswordResetEmail } from '@/server/application/passwordResetEmail';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { rateLimited } from '@/server/http/publicRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (rateLimited(request, 'password-reset-request', { limite: 5 })) {
    const response = failure(new ApplicationError('RATE_LIMITED', 'Muitas solicitações. Tente novamente em dez minutos.', 429));
    response.headers.set('Retry-After', '600');
    return response;
  }
  try {
    const body = await readJson(request);
    const email = typeof body?.email === 'string' ? body.email.trim().toLocaleLowerCase('pt-BR') : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApplicationError('INVALID_INPUT', 'Informe um e-mail válido.', 400);
    }
    if (!passwordResetEmailConfigured()) {
      throw new ApplicationError('EMAIL_UNAVAILABLE', 'A recuperação de senha está indisponível no momento. Tente novamente mais tarde.', 503);
    }
    try {
      const reset = await createPsychologistPasswordReset(email, true);
      await sendPasswordResetEmail(email, reset.token);
    } catch (error) {
      // Não devolver erros dependentes da existência da conta nem registrar tokens ou e-mails.
      if (!(error instanceof ApplicationError && ['NOT_FOUND', 'RESET_COOLDOWN'].includes(error.code))) {
        console.error('[password-reset-request] Não foi possível concluir o envio.');
      }
    }
    return success({ message: 'Se houver uma conta ativa de psicólogo com esse e-mail, você receberá um link para redefinir sua senha. Confira também a pasta de spam.' });
  } catch (error) {
    return failure(error instanceof ApplicationError ? error : new ApplicationError('RESET_REQUEST_FAILED', 'Não foi possível solicitar o link. Tente novamente mais tarde.', 500));
  }
}
