import 'server-only';
import { deliveryHash, finishDelivery, reserveDelivery } from './whatsappDeliveryRepository';

export interface WhatsAppDeliveryResult {
  state: 'sent' | 'rejected' | 'unknown' | 'sending' | 'conflict';
  providerMessageId?: string;
}
interface Input {
  scope: string; key: string; number: string; text: string;
  config: { url: string; apiKey: string; instancia: string };
}
const inFlight = new Map<string, { fingerprint: string; promise: Promise<WhatsAppDeliveryResult> }>();

export function deliverWhatsApp(input: Input): Promise<WhatsAppDeliveryResult> {
  const key = deliveryHash(JSON.stringify([input.scope, input.key]));
  const fingerprint = deliveryHash(JSON.stringify([input.number, input.text]));
  const running = inFlight.get(key);
  if (running) return running.fingerprint === fingerprint
    ? running.promise : Promise.resolve({ state: 'conflict' });
  const promise = send(input, key, fingerprint).finally(() => inFlight.delete(key));
  inFlight.set(key, { fingerprint, promise });
  return promise;
}

async function send(input: Input, key: string, fingerprint: string): Promise<WhatsAppDeliveryResult> {
  const reservation = await reserveDelivery(key, fingerprint);
  if (reservation.fingerprint !== fingerprint) return { state: 'conflict' };
  if (!reservation.acquired) return { state: reservation.state, providerMessageId: reservation.providerMessageId };
  let result: WhatsAppDeliveryResult;
  try {
    const response = await fetch(`${input.config.url.replace(/\/$/, '')}/message/sendText/${input.config.instancia}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: input.config.apiKey },
      body: JSON.stringify({ number: input.number, text: input.text }), signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      let body;
      try { body = await response.json(); } catch { /* O HTTP já confirmou o aceite. */ }
      result = { state: 'sent', providerMessageId: typeof body?.key?.id === 'string' ? body.key.id : undefined };
    } else {
      const explicitRejection = [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(response.status);
      result = { state: explicitRejection ? 'rejected' : 'unknown' };
    }
  } catch {
    result = { state: 'unknown' };
  }
  // Se a gravação falhar, a reserva permanece sending: não reenviar às cegas.
  await finishDelivery(reservation, result.state as 'sent' | 'rejected' | 'unknown', result.providerMessageId);
  return result;
}
