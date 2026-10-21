import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContatosDaSessao } from './agendaRepository';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ execute: vi.fn(), query: vi.fn(), enviar: vi.fn(), contatos: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ execute: state.execute, query: state.query }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst' }));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({ enviarTexto: state.enviar }));
vi.mock('./agendaRepository', () => ({ getContatosDaSessao: state.contatos }));
import { liberarAvisosAguardando } from './agendaAvisosPendentes';

const session: ContatosDaSessao = {
  agendamentoId: 'appointment', inicio: '2026-09-25T18:00:00Z', fim: '2026-09-25T19:00:00Z',
  modalidade: 'online', status: 'agendado', pacienteNome: 'Paciente fictício', pacienteTelefone: '11999999999',
  profissionalNome: 'Profissional fictício', profissionalTelefone: '11988888888',
};
const abertura = new Date('2026-09-23T11:05:00Z');
const situacoes = () => state.execute.mock.calls.map(([, values]) => values[0]);

beforeEach(() => {
  vi.resetAllMocks();
  state.query.mockResolvedValue([[{ id: 'aviso', agendamento_id: 'appointment', versao: 0 }]]);
  state.execute.mockResolvedValue([{ affectedRows: 1 }]);
  state.contatos.mockResolvedValue(session);
  state.enviar.mockResolvedValue({ situacao: 'enviada' });
});

describe('liberação dos avisos adiados', () => {
  it('fora do expediente não consulta a fila', async () => {
    await liberarAvisosAguardando(new Date('2026-09-23T02:00:00Z'));
    expect(state.query).not.toHaveBeenCalled();
  });
  it('na abertura toma a linha e envia a confirmação', async () => {
    await expect(liberarAvisosAguardando(abertura)).resolves.toEqual({ enviados: 1, descartados: 0, adiados: 0 });
    expect(state.enviar).toHaveBeenCalledWith(session.pacienteTelefone, expect.stringContaining('Sua sessão foi marcada'),
      'agenda_confirmacao_paciente', 'agenda:confirmacao_paciente:appointment:0');
    expect(situacoes()).toEqual(['reservado', 'enviada']);
  });
  it('não envia se outra chamada já tomou a linha', async () => {
    state.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await liberarAvisosAguardando(abertura);
    expect(state.enviar).not.toHaveBeenCalled();
  });
  it('descarta a confirmação de sessão cancelada', async () => {
    state.contatos.mockResolvedValue({ ...session, status: 'cancelado' });
    await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ descartados: 1 });
    expect(state.enviar).not.toHaveBeenCalled();
    expect(situacoes()).toEqual(['reservado', 'descartada']);
  });
  it('falha de envio devolve a linha para a fila', async () => {
    state.enviar.mockResolvedValue({ situacao: 'falha' });
    await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ adiados: 1 });
    expect(situacoes()).toEqual(['reservado', 'aguardando_horario']);
  });
});
