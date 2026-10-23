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

    const patientId = String(body.patientId || '');
    const recipientReference = body.recipientReference ? String(body.recipientReference) : undefined;
    const template: NotificationTemplateInput | undefined = (body.template && typeof body.template === 'object')
      ? (body.template as NotificationTemplateInput)
      : undefined;

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
