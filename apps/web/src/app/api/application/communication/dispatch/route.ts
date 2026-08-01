import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import {
  dispatchCommunicationMessage,
  sendTestNotification,
} from '@/server/application/communicationService';
import type { NotificationTemplateInput } from '@thats-life/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request, true);
    const body = await readJson(request);

    if (body.messageId) {
      const result = await dispatchCommunicationMessage(
        context,
        String(body.messageId)
      );
      return success(result);
    }

    const patientId = String(body.patientId || 'patient-1');
    const recipientReference = body.recipientReference ? String(body.recipientReference) : '5511987654321';
    const template: NotificationTemplateInput = (body.template && typeof body.template === 'object')
      ? (body.template as NotificationTemplateInput)
      : {
          category: 'appointment_reminder',
          professionalName: 'Dra. Camila Vasconcelos',
          appointmentLabel: 'Amanhã às 14:00',
        };

    const result = await sendTestNotification(context, {
      patientId,
      recipientReference,
      template,
    });

    return success(result, 201);
  } catch (error) {
    return failure(error);
  }
}
