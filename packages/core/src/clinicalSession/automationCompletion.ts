import type { FinancialCharge } from '../financial';
import {
  createSessionEvent,
  evolveSession,
  type TransitionMetadata,
} from './eventFactory';
import type {
  ClinicalSession,
  SessionTransitionResult,
} from './types';
import { requireStatus, requireText } from './validation';

type AutomationKey = keyof ClinicalSession['automation'];

export function linkSessionCharge(
  session: ClinicalSession,
  charge: FinancialCharge,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['ready_to_complete'], 'Vincular cobrança');
  if (!session.automationPlan.billing) {
    throw new Error('A cobrança não está habilitada para a sessão.');
  }
  if (
    charge.organizationId !== session.organizationId ||
    charge.sessionId !== session.id ||
    charge.patientId !== session.patientId ||
    ['cancelled', 'refunded'].includes(charge.status)
  ) {
    throw new Error('A cobrança ativa deve pertencer à sessão e ao paciente.');
  }
  const next = evolveSession(
    session,
    {
      artifacts: { ...session.artifacts, chargeId: charge.id },
      automation: {
        ...session.automation,
        billing: {
          ...session.automation.billing,
          status: 'completed',
          updatedAt: metadata.occurredAt,
        },
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.billing_created', metadata),
    ],
  };
}

export function markSessionReceiptIssued(
  session: ClinicalSession,
  receiptId: string,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['ready_to_complete'], 'Emitir recibo');
  if (!session.automationPlan.receipt) {
    throw new Error('A emissão de recibo não está habilitada.');
  }
  if (session.automation.billing.status !== 'completed') {
    throw new Error('O recibo exige uma cobrança vinculada.');
  }
  const next = evolveSession(
    session,
    {
      artifacts: {
        ...session.artifacts,
        receiptId: requireText(receiptId, 'receiptId'),
      },
      automation: {
        ...session.automation,
        receipt: {
          ...session.automation.receipt,
          status: 'completed',
          updatedAt: metadata.occurredAt,
        },
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.receipt_issued', metadata),
    ],
  };
}

export function markSessionNotificationSent(
  session: ClinicalSession,
  notificationReference: string,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['ready_to_complete'], 'Enviar notificação');
  if (!session.automationPlan.notification) {
    throw new Error('A notificação não está habilitada.');
  }
  const next = evolveSession(
    session,
    {
      automation: {
        ...session.automation,
        notification: {
          ...session.automation.notification,
          status: 'completed',
          updatedAt: metadata.occurredAt,
        },
      },
    },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [
      createSessionEvent(next, 'clinical_session.notification_sent', metadata, {
        notificationReference: requireText(
          notificationReference,
          'notificationReference'
        ),
      }),
    ],
  };
}

export function completeClinicalSession(
  session: ClinicalSession,
  metadata: TransitionMetadata
): SessionTransitionResult {
  requireStatus(session.status, ['ready_to_complete'], 'Concluir');
  const requiredSteps: AutomationKey[] = [
    'transcription',
    'patientHandoff',
    'billing',
    'receipt',
    'notification',
  ];
  const unfinished = requiredSteps.filter(
    (key) =>
      !['skipped', 'completed'].includes(session.automation[key].status)
  );
  if (session.automation.clinicalDraft.status !== 'approved') {
    unfinished.push('clinicalDraft');
  }
  if (unfinished.length > 0) {
    throw new Error(`Etapas pós-sessão pendentes: ${unfinished.join(', ')}.`);
  }
  const next = evolveSession(
    session,
    { status: 'completed' },
    metadata.occurredAt
  );
  return {
    session: next,
    events: [createSessionEvent(next, 'clinical_session.completed', metadata)],
  };
}
