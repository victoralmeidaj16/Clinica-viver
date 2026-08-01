import { EvolutionApiClient } from '../evolutionApi';
import type { NotificationDeliveryPort } from './ports';
import type { NotificationMessage } from './types';

export class EvolutionWhatsAppDeliveryProvider
  implements NotificationDeliveryPort
{
  readonly channel = 'whatsapp' as const;
  private readonly client: EvolutionApiClient;

  constructor(baseUrl = 'https://api.evolution.demo', apiKey = 'demo-api-key') {
    this.client = new EvolutionApiClient(baseUrl, apiKey);
  }

  async send(
    notification: NotificationMessage
  ): Promise<{ providerMessageId: string }> {
    const number = notification.recipientReference || '5511987654321';
    const instanceName = `instance_${notification.organizationId}`;

    const result = await this.client.sendTextMessage({
      instanceName,
      number,
      text: notification.body,
    });

    return { providerMessageId: result.messageId };
  }
}
