import type { PatientHandoff } from '@thats-life/core';

export const DEMO_PATIENT_HANDOFF: PatientHandoff = {
  schemaVersion: 1,
  patientId: 'pac-01',
  sessionId: 'demo-pac-01-session-01',
  summary:
    'Nesta sessão vocês trabalharam estratégias para lidar com a ansiedade em situações profissionais, reconhecer limites na rotina e fortalecer formas mais assertivas de comunicação.',
  tasks: [
    {
      id: 'demo-pac-01-session-01-task-1',
      title: '📝 Preencher RPD ao perceber gatilhos de ansiedade',
      completed: true,
    },
    {
      id: 'demo-pac-01-session-01-task-2',
      title: '🧘 Praticar 10 min de respiração diafragmática ao acordar',
      completed: false,
    },
    {
      id: 'demo-pac-01-session-01-task-3',
      title: '✉️ Escrever rascunho de alinhamento de demandas com a gerência',
      completed: false,
    },
  ],
  nextSessionLabel: 'Quarta-feira, 05 de Agosto às 14:00',
  professionalName: 'Dra. Camila Vasconcelos',
  status: 'delivered',
  humanReviewRequired: true,
  safetyWarnings: [],
  approvedBy: 'psi-demo-01',
  approvedAt: '2026-07-30T12:00:00.000Z',
  deliveredAt: '2026-07-30T12:01:00.000Z',
};
