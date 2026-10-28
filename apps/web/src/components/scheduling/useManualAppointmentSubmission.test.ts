import { beforeEach, expect, it, vi } from 'vitest';
import { useManualAppointmentSubmission } from './useManualAppointmentSubmission';
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', () => ({ useState(initial: unknown) {
  const index = hooks.cursor++;
  if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? initial() : initial;
  return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
} }));
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/applicationApi', () => ({ applicationRequest: request, commandHeaders: () => ({ 'Idempotency-Key': crypto.randomUUID() }) }));
const onScheduled = vi.fn();
const input = { patientId: 'patient-test', professionalId: 'pro-test', adminMode: false,
  recurrenceDates: ['2099-01-10', '2099-01-17'], date: '2099-01-10', time: '14:00', durationMinutes: 50,
  validDuration: true, chargeDueDate: '2099-01-09', chargeDueTime: '15:00', mode: 'video' as const,
  serviceKey: 'PSICOTERAPIA', onScheduled };
function SubmissionHarness() { return useManualAppointmentSubmission(input); }
function renderSubmission() { hooks.cursor = 0; return SubmissionHarness(); }
beforeEach(() => { hooks.values = []; vi.clearAllMocks(); });
it('avisa sobre cobrança pendente e encerra o formulário sem repetir sessões', async () => {
  request.mockResolvedValueOnce({ charge: { status: 'failed' } }).mockResolvedValueOnce({ charge: { status: 'created' } });
  await renderSubmission().submit({ preventDefault() {} } as React.FormEvent);
  const result = renderSubmission();
  expect(result.message).toMatchObject({ kind: 'warning' });
  expect(result.message?.text).toContain('2 atendimento(s) agendado(s). 1 cobrança(s)');
  expect(result.completed).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
  expect(onScheduled).toHaveBeenCalledOnce();
  const bodies = request.mock.calls.map(([, init]) => JSON.parse(init.body));
  expect(bodies.map((body) => body.chargeDueAt)).toEqual(['2099-01-09T18:00:00.000Z', '2099-01-16T18:00:00.000Z']);
  expect(bodies.map((body) => body.professionalId)).toEqual(['pro-test', 'pro-test']);
});
it('mantém a confirmação normal quando as cobranças foram criadas', async () => {
  request.mockResolvedValue({ charge: { status: 'created' } });
  await renderSubmission().submit({ preventDefault() {} } as React.FormEvent);
  expect(renderSubmission()).toMatchObject({ message: { kind: 'success' }, completed: true });
});
it('após falha no meio da série, a nova tentativa envia só o restante com a mesma chave', async () => {
  const series = { ...input, recurrenceDates: ['2099-01-10', '2099-01-17', '2099-01-24'] };
  function SeriesHarness() { return useManualAppointmentSubmission(series); }
  const harness = () => { hooks.cursor = 0; return SeriesHarness(); };
  request.mockResolvedValueOnce({ charge: { status: 'created' } })
    .mockResolvedValueOnce({ charge: { status: 'created' } })
    .mockRejectedValueOnce(new Error('Falha de rede fictícia.'));
  await harness().submit({ preventDefault() {} } as React.FormEvent);
  expect(harness().message).toMatchObject({ kind: 'error' });
  expect(harness().message?.text).toContain('2 de 3 atendimento(s) foram criados');
  request.mockResolvedValue({ charge: { status: 'created' } });
  await harness().submit({ preventDefault() {} } as React.FormEvent);
  expect(harness().message).toMatchObject({ kind: 'success' });
  expect(harness().message?.text).toContain('3 atendimentos');
  expect(request).toHaveBeenCalledTimes(4);
  const calls = request.mock.calls.map(([, init]) => ({ id: JSON.parse(init.body).id, key: init.headers['Idempotency-Key'] }));
  expect(new Set(calls.map((call) => call.id)).size).toBe(3);
  expect(calls[3]).toEqual(calls[2]);
});
