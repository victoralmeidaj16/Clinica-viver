import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Envio operacional de texto pelo WhatsApp. A chave da Evolution fica apenas
 * no servidor; telas client-side nunca recebem URL, instância ou segredo.
 */
export async function POST(request: Request) {
  try {
    await resolveRequestContext(request, true);
    const body = await readJson(request);
    const number = String(body.number ?? '').replace(/\D/g, '');
    const text = String(body.text ?? '').trim();
    if (!/^\d{10,15}$/.test(number)) {
      throw new ApplicationError('INVALID_NUMBER', 'Número de WhatsApp inválido.', 400);
    }
    if (!text || text.length > 4096) {
      throw new ApplicationError('INVALID_MESSAGE', 'Mensagem vazia ou maior que 4096 caracteres.', 400);
    }

    const evoUrl = process.env.EVOLUTION_API_URL;
    const evoApiKey = process.env.EVOLUTION_API_KEY;
    const evoInstance = process.env.EVOLUTION_INSTANCE_NAME;
    if (!evoUrl || !evoApiKey || !evoInstance) {
      throw new ApplicationError('EVOLUTION_NOT_CONFIGURED', 'WhatsApp não está configurado no servidor.', 503);
    }

    const response = await fetch(`${evoUrl.replace(/\/$/, '')}/message/sendText/${evoInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoApiKey },
      body: JSON.stringify({ number, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new ApplicationError('EVOLUTION_DELIVERY_FAILED', 'O WhatsApp recusou o envio.', 502);
    }

    const result = await response.json().catch(() => ({}));
    return success({ sent: true, messageId: result?.key?.id ?? null });
  } catch (error) {
    return failure(error);
  }
}
