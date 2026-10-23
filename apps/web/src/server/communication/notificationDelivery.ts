import 'server-only';
import type { NotificationDeliveryPort, NotificationMessage } from '@thats-life/core';
import type { RowDataPacket } from 'mysql2';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { assertWhatsAppRecipientAllowed } from '@/server/adapters/whatsappAllowlist';
import { demoNotificationDeliveries } from '@/server/adapters/notifications';
import { deliverWhatsApp } from './whatsappDelivery';

async function patientPhone(message: NotificationMessage): Promise<string> {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT p.telefone FROM clinica_pacientes p JOIN clinica_organizacoes o ON o.id = p.organizacao_id
      WHERE p.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ? AND p.status = 'ativo' LIMIT 1`,
    [instituicaoId(), message.organizationId, message.patientId],
  );
  const number = normalizeBrazilPhone(rows[0]?.telefone);
  if (!number) throw new Error('Paciente sem telefone válido para entrega.');
  // Nunca envie conteúdo clínico para um número arbitrário vindo do request.
  if (message.recipientReference !== `contact-${message.patientId}`
    && normalizeBrazilPhone(message.recipientReference) !== number) {
    throw new Error('O destinatário não corresponde ao cadastro do paciente.');
  }
  return number;
}

export function notificationDeliveryProvider(channel: NotificationMessage['channel']): NotificationDeliveryPort {
  if (!isMysqlConfigured() && process.env.NODE_ENV !== 'production') {
    return demoNotificationDeliveries.find((provider) => provider.channel === channel)!;
  }
  return {
    channel,
    async send(message) {
      if (channel !== 'whatsapp') throw new Error('Canal de entrega não configurado.');
      if (!isMysqlConfigured()) throw new Error('Persistência de comunicação não configurada.');
      const url = process.env.EVOLUTION_API_URL?.trim();
      const apiKey = process.env.EVOLUTION_API_KEY?.trim();
      const instancia = process.env.EVOLUTION_INSTANCE_NAME?.trim();
      if (!url || !apiKey || !instancia) throw new Error('WhatsApp não configurado.');
      const number = await patientPhone(message);
      assertWhatsAppRecipientAllowed(number);
      const result = await deliverWhatsApp({
        scope: `notification:${message.organizationId}`, key: message.idempotencyKey,
        number, text: message.body, config: { url, apiKey, instancia },
      });
      if (result.state !== 'sent') {
        const error = new Error('A entrega não foi confirmada. Verifique o estado antes de reenviar.');
        error.name = result.state === 'rejected' ? 'DELIVERY_REJECTED' : 'DELIVERY_UNCERTAIN';
        throw error;
      }
      // O ID local referencia uma reserva persistida com aceite HTTP, quando a API não retorna key.id.
      return { providerMessageId: result.providerMessageId ?? `accepted:${message.id}` };
    },
  };
}
