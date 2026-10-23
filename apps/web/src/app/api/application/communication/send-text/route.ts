import { deliverWhatsApp } from '@/server/communication/whatsappDelivery';
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
    const context = await resolveRequestContext(request, true);
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

    const result = await deliverWhatsApp({
      scope: `send-text:${context.actor.organizationId}:${context.actor.userId}`,
      key: context.idempotencyKey!, number, text,
      config: { url: evoUrl, apiKey: evoApiKey, instancia: evoInstance },
    });
    if (result.state === 'conflict') {
      throw new ApplicationError('IDEMPOTENCY_CONFLICT', 'Esta chave já foi utilizada com outro destinatário ou conteúdo.', 409);
    }
    if (result.state === 'sending' || result.state === 'unknown') {
      throw new ApplicationError('DELIVERY_UNCERTAIN', 'Envio em andamento ou sem confirmação. Verifique a entrega antes de tentar novamente.', 409);
    }
    if (result.state !== 'sent') {
      throw new ApplicationError('EVOLUTION_DELIVERY_FAILED', 'O WhatsApp recusou o envio.', 502);
    }
    return success({ sent: true, messageId: result.providerMessageId ?? null });
  } catch (error) {
    return failure(error);
  }
}
