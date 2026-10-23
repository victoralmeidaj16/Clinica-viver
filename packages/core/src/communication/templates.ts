import type { NotificationTemplateInput } from './types';
import { reviewPatientHandoffContent } from '../patientHandoff';

const restricted = /\b(?:soap|prontu[aá]rio|hip[oó]tese diagn[oó]stica|diagn[oó]stico|idea[çc][aã]o suicida|autoles[aã]o)\b/i;
const clean = (value: string, field: string) => { const text = value.replace(/\s+/g, ' ').trim(); if (!text) throw new Error(`${field} é obrigatório.`); if (restricted.test(text)) throw new Error('A mensagem contém conteúdo clínico restrito.'); return text; };

export function renderNotificationTemplate(input: NotificationTemplateInput): { subject: string; body: string } {
  switch (input.category) {
    case 'patient_handoff': {
      const warnings = reviewPatientHandoffContent(input.summary, input.tasks);
      if (warnings.length) throw new Error(warnings.join(' '));
      return { subject: 'Orientações após a sessão', body: [
        `Orientações de ${clean(input.professionalName, 'professionalName')}:`,
        clean(input.summary, 'summary'),
        ...input.tasks.map((task) => `• ${clean(task, 'task')}`),
        ...(input.nextSessionLabel ? [`Próxima sessão: ${clean(input.nextSessionLabel, 'nextSessionLabel')}`] : []),
      ].join('\n\n') };
    }
    case 'appointment_reminder': return { subject: 'Lembrete de sessão', body: `Olá! Lembramos sua sessão com ${clean(input.professionalName, 'professionalName')} em ${clean(input.appointmentLabel, 'appointmentLabel')}.` };
    case 'appointment_changed': return { subject: 'Sessão atualizada', body: `Seu horário com ${clean(input.professionalName, 'professionalName')} foi atualizado para ${clean(input.appointmentLabel, 'appointmentLabel')}.` };
    case 'task_assigned': return { subject: 'Nova atividade', body: `Uma nova atividade está disponível no app: ${clean(input.taskTitle, 'taskTitle')}.` };
    case 'task_due': return { subject: 'Lembrete de atividade', body: `A atividade “${clean(input.taskTitle, 'taskTitle')}” está prevista para ${clean(input.dueLabel, 'dueLabel')}.` };
    case 'billing_due': return { subject: 'Cobrança disponível', body: `Há uma cobrança de ${clean(input.amountLabel, 'amountLabel')} com vencimento em ${clean(input.dueLabel, 'dueLabel')}.${input.paymentUrl ? ` Acesse: ${clean(input.paymentUrl, 'paymentUrl')}` : ''}` };
    case 'payment_confirmed': return { subject: 'Pagamento confirmado', body: `Recebemos seu pagamento de ${clean(input.amountLabel, 'amountLabel')}. Obrigado!` };
    case 'receipt_available': return { subject: 'Recibo disponível', body: `Seu recibo está disponível em ${clean(input.receiptUrl, 'receiptUrl')}.` };
  }
}
