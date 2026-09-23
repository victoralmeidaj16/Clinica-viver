import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./agendaRepository', () => ({ getContatosDaSessao: vi.fn() }));
vi.mock('./agendaAvisos', () => ({ avisarSessaoRemarcada: vi.fn() }));
vi.mock('@/server/payments/sessionChargeDueWorker', () => ({ processAppointmentChargeDue: vi.fn() }));
import { getContatosDaSessao } from './agendaRepository';
import { avisarSessaoRemarcada } from './agendaAvisos';
import { processAppointmentChargeDue } from '@/server/payments/sessionChargeDueWorker';
import { concluirReagendamento } from './agendaReagendamentoEffects';
const input = { id: 'a', inicioAnterior: '2026-10-01T12:00:00Z', inicio: '2026-10-02T12:00:00Z',
  fim: '2026-10-02T13:00:00Z', versao: 4 };
beforeEach(() => vi.resetAllMocks());
it('avisa mesmo com ajuste financeiro pendente', async () => {
  vi.mocked(processAppointmentChargeDue).mockResolvedValue('queued');
  vi.mocked(getContatosDaSessao).mockResolvedValue({ agendamentoId: 'a', inicio: input.inicio,
    fim: input.fim, modalidade: 'online', status: 'agendado', pacienteNome: 'Paciente', pacienteTelefone: '11999999999',
    profissionalNome: 'Psicólogo', profissionalTelefone: '11988888888' });
  await concluirReagendamento(input);
  expect(avisarSessaoRemarcada).toHaveBeenCalledWith(expect.objectContaining({ inicio: input.inicio }), input.inicioAnterior, 4);
});
it('falha na consulta de contatos não invalida o horário confirmado', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(getContatosDaSessao).mockRejectedValue(new Error('indisponível'));
  await expect(concluirReagendamento(input)).resolves.toBeUndefined();
  expect(processAppointmentChargeDue).toHaveBeenCalledWith('a');
  log.mockRestore();
});
