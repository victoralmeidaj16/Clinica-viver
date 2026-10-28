import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { EditSessionModal } from '@/components/scheduling/EditSessionModal';
import { financialSessionForEdit, type Receivable } from '@/lib/myFinancialModel';
import { MyReceivablesTable } from './MyReceivablesTable';
const receivable: Receivable = { chargeId: 'charge-test', sessionId: 'session-test', appointmentId: 'appointment-test',
  patientName: 'Paciente fictício', startsAt: '2099-01-10T14:00:00Z', endsAt: '2099-01-10T15:30:00Z',
  dueAt: '2099-01-09T15:00:00Z', serviceKey: 'AVALIACAO', versao: 4, status: 'pending',
  attendanceStatus: 'a_confirmar', amountCents: 10000, receivedCents: 0, outstandingCents: 10000 };
it.each([['AVALIACAO', true], ['PSICOTERAPIA', false]] as const)('libera duração variável somente para %s vindo do financeiro', (serviceKey, editable) => {
  const session = financialSessionForEdit({ ...receivable, serviceKey });
  const markup = renderToStaticMarkup(<EditSessionModal session={session} isOpen onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(markup.includes('Variável')).toBe(editable);
  expect(session.versao).toBe(4);
});
it('renderiza antes da chegada das cobranças sem falhar', () => {
  expect(() => renderToStaticMarkup(<MyReceivablesTable pacientesMap={new Map()} onCopyPayment={vi.fn()} onEditSession={vi.fn()} />)).not.toThrow();
});
