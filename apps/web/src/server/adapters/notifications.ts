import { createHash } from 'node:crypto';
import type { NotificationDeliveryPort, NotificationMessage } from '@thats-life/core';

/**
 * Entrega de notificações em modo demonstração.
 *
 * Nada sai para a rede: nenhuma mensagem chega a um WhatsApp real, nenhum
 * e-mail é enviado, nenhum push é disparado. As mensagens ficam num registro
 * em memória que a interface pode exibir como "caixa de saída", de modo que o
 * fluxo completo — enfileirar, entregar, auditar — seja observável sem colocar
 * um número de telefone de verdade em risco.
 *
 * Este é o motivo de o adaptador ser falso em vez de apontar para um número de
 * teste: mensagem enviada é irreversível, e uma demonstração não deve produzir
 * efeitos no mundo real.
 *
 * O ID do provedor é derivado da chave de idempotência, então repetir a mesma
 * operação devolve o mesmo identificador em vez de simular uma segunda entrega.
 */

export interface DeliveredNotification {
  readonly providerMessageId: string;
  readonly channel: NotificationMessage['channel'];
  readonly category: NotificationMessage['category'];
  readonly organizationId: string;
  readonly patientId: string;
  readonly recipientReference: string;
  readonly subject?: string;
  readonly body: string;
  readonly deliveredAt: string;
}

interface OutboxGlobal {
  __thatsLifeOutbox?: DeliveredNotification[];
}
const globalScope = globalThis as typeof globalThis & OutboxGlobal;

function outbox(): DeliveredNotification[] {
  if (!globalScope.__thatsLifeOutbox) {
    globalScope.__thatsLifeOutbox = [];
  }
  return globalScope.__thatsLifeOutbox;
}

export function listDeliveredNotifications(organizationId: string): readonly DeliveredNotification[] {
  return outbox().filter((entry) => entry.organizationId === organizationId);
}

export function clearDeliveredNotifications(): void {
  globalScope.__thatsLifeOutbox = [];
}

function deterministicMessageId(prefix: string, idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16);
  return `${prefix}_${digest}`;
}

function createDemoDelivery(
  channel: NotificationMessage['channel'],
  prefix: string
): NotificationDeliveryPort {
  return {
    channel,
    async send(message: NotificationMessage): Promise<{ providerMessageId: string }> {
      const providerMessageId = deterministicMessageId(prefix, message.idempotencyKey);

      const existing = outbox().find((entry) => entry.providerMessageId === providerMessageId);
      if (existing) {
        return { providerMessageId };
      }

      outbox().push({
        providerMessageId,
        channel: message.channel,
        category: message.category,
        organizationId: message.organizationId,
        patientId: message.patientId,
        recipientReference: message.recipientReference,
        subject: message.subject,
        body: message.body,
        deliveredAt: new Date().toISOString(),
      });

      return { providerMessageId };
    },
  };
}

/** Evolution API / WhatsApp — registra a mensagem, não envia. */
export const demoWhatsAppDelivery = createDemoDelivery('whatsapp', 'wamid_demo');

/** E-mail transacional — registra a mensagem, não envia. */
export const demoEmailDelivery = createDemoDelivery('email', 'email_demo');

/** Push do app do paciente — registra a mensagem, não envia. */
export const demoPushDelivery = createDemoDelivery('push', 'push_demo');

export const demoNotificationDeliveries: readonly NotificationDeliveryPort[] = [
  demoWhatsAppDelivery,
  demoEmailDelivery,
  demoPushDelivery,
];
