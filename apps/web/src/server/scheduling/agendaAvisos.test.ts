import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContatosDaSessao } from './agendaRepository';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ execute: vi.fn(), enviar: vi.fn(), reservations: new Set<string>() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ execute: state.execute }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst' }));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({ enviarTexto: state.enviar }));
import { avisarSessaoRemarcada, avisarSolicitacaoReagendamentoPsicologo } from './agendaAvisos';
const session: ContatosDaSessao = {
  agendamentoId: 'appointment', inicio: '2026-09-25T18:00:00Z', fim: '2026-09-25T19:00:00Z',
  modalidade: 'online', status: 'agendado', pacienteNome: 'Paciente fictício', pacienteTelefone: '11999999999',
  profissionalNome: 'Profissional fictício', profissionalTelefone: '11988888888',
};
const previous = '2026-09-24T15:00:00Z';
beforeEach(() => {
  vi.resetAllMocks(); state.reservations.clear();
  state.enviar.mockResolvedValue({ situacao: 'enviada' });
  state.execute.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes('INSERT IGNORE')) {
      const key = values.slice(2).join(':');
      if (state.reservations.has(key)) return [{ affectedRows: 0 }];
      state.reservations.add(key);
    }
    return [{ affectedRows: 1 }];
  });
});
describe('avisos de remarcação', () => {
  it('avisa os dois contatos com horário anterior e novo no fuso da clínica', async () => {
    await avisarSessaoRemarcada(session, previous, 2);
    expect(state.enviar).toHaveBeenCalledTimes(2);
    expect(state.enviar).toHaveBeenCalledWith(session.pacienteTelefone,
      expect.stringContaining('Sua sessão com Profissional fictício foi remarcada'),
      'agenda_remarcacao_paciente', 'agenda:remarcacao_paciente:appointment:2');
    expect(state.enviar).toHaveBeenCalledWith(session.profissionalTelefone,
      expect.stringContaining('A sessão de Paciente fictício foi remarcada'),
      'agenda_remarcacao_psicologo', 'agenda:remarcacao_psicologo:appointment:2');
    for (const [, text] of state.enviar.mock.calls) {
      expect(text).toContain('Horário anterior:'); expect(text).toContain('às 12:00');
      expect(text).toContain('Novo horário:'); expect(text).toContain('às 15:00');
    }
  });
  it('deduplica a mesma versão mas permite avisos de novas remarcações', async () => {
    await avisarSessaoRemarcada(session, previous, 2);
    await avisarSessaoRemarcada(session, previous, 2);
    expect(state.enviar).toHaveBeenCalledTimes(2);
    await avisarSessaoRemarcada({ ...session, inicio: previous }, session.inicio, 3);
    expect(state.enviar).toHaveBeenCalledTimes(4);
  });
  it('falha de envio não impede o outro destinatário nem lança para o reagendamento', async () => {
    state.enviar.mockResolvedValueOnce({ situacao: 'falha' });
    await expect(avisarSessaoRemarcada(session, previous, 2)).resolves.toBeUndefined();
    expect(state.enviar).toHaveBeenCalledTimes(2);
    expect(state.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM clinica_agenda_avisos'),
      ['inst', 'appointment', 'remarcacao_paciente', 2]);
  });
});

describe('solicitação de reagendamento', () => {
  it('avisa que houve solicitação, com os dois horários e link focado', async () => {
    await avisarSolicitacaoReagendamentoPsicologo(session, '2026-09-27T16:00:00Z', 4);
    expect(state.enviar).toHaveBeenCalledOnce();
    const [, text, purpose, key] = state.enviar.mock.calls[0];
    expect(text).toContain('solicitou um reagendamento');
    expect(text).toContain('Horário atual:');
    expect(text).toContain('Horário solicitado:');
    expect(text).toContain('https://clinicavivermais.cloud/agenda?foco=sessao-appointment');
    expect(text).not.toContain('foi remarcada');
    expect(purpose).toBe('agenda_solicitacao_reagendamento_psicologo');
    expect(key).toBe('agenda:solicitacao_reagendamento_psicologo:appointment:4');
  });
});
