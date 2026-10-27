import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { RescheduleRequestCard } from './RescheduleRequestCard';

it('mostra a modalidade solicitada antes da decisão', () => {
  const markup = renderToStaticMarkup(<RescheduleRequestCard patientName="Paciente fictício" onDecision={vi.fn()}
    request={{ id: 'req', sequence: 1, appointmentId: 'a', currentStartsAt: '2030-01-02T12:00:00Z',
      currentEndsAt: '2030-01-02T12:50:00Z', requestedStartsAt: '2030-01-03T12:00:00Z',
      requestedEndsAt: '2030-01-03T12:50:00Z', requestedModality: 'presencial', requestedAt: '2030-01-01T12:00:00Z' }} />);
  expect(markup).toContain('Presencial');
  expect(markup).toContain('Aceitar');
});
