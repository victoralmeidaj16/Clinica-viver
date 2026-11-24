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
const situacoes = () => state.execute.mock.calls.filter(([sql]) => String(sql).startsWith('UPDATE clinica_agenda_avisos SET situacao = ?'))
  .map(([, values]) => values[0]);

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
    await expect(liberarAvisosAguardando(abertura)).resolves.toEqual({ enviados: 1, descartados: 0, adiados: 0, incertos: 0 });
    expect(state.enviar).toHaveBeenCalledWith(session.pacienteTelefone, expect.stringContaining('Sua sessão foi marcada'),
      'agenda_confirmacao_paciente', 'agenda:confirmacao_paciente:appointment:0',
      false, expect.objectContaining({ variaveis: expect.objectContaining({ nome_paciente: 'Paciente fictício' }) }));
    expect(situacoes()).toEqual(['reservado', 'enviada']);
  });
  it('não envia se outra chamada já tomou a linha', async () => {
    state.execute.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 0 }]);
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
    state.enviar.mockResolvedValue({ situacao: 'falha', reenvioSeguro: true });
    await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ adiados: 1 });
    expect(state.execute).toHaveBeenCalledWith(expect.stringContaining("SET situacao = 'aguardando_horario', enviar_em = ?"),
      [new Date(abertura.getTime() + 5 * 60_000), 'inst', 'aviso']);
  });
  it('retira entregas incertas da fila para conferência', async () => {
    state.enviar.mockResolvedValue({ situacao: 'falha', reenvioSeguro: false });
    await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ adiados: 0, incertos: 1 });
    expect(situacoes()).toEqual(['reservado', 'entrega_incerta']);
  });
  it.skipIf(Number(process.versions.node.split('.')[0]) < 22)('libera o aviso 51 após um lote de falhas', async () => {
    const moduleName = 'node:sqlite';
    const { DatabaseSync } = await import(moduleName) as typeof import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(`CREATE TABLE clinica_agenda_avisos (id TEXT PRIMARY KEY, instituicao_id TEXT,
        agendamento_id TEXT, tipo TEXT, versao INTEGER, dados_reenvio TEXT, situacao TEXT,
        enviar_em INTEGER, atualizado_em INTEGER)`);
      const inserir = db.prepare(`INSERT INTO clinica_agenda_avisos VALUES (?, 'inst', ?,
        'confirmacao_paciente', 0, '{}', 'aguardando_horario', ?, ?)`);
      for (let i = 0; i <= 50; i++) {
        inserir.run(String(i), String(i), abertura.getTime() - 51 + i, abertura.getTime());
      }
      const params = (values: Array<Date | string>) => values.map(value => value instanceof Date ? value.getTime() : value);
      state.query.mockImplementation(async (sql, values) => [db.prepare(sql).all(...params(values))]);
      state.execute.mockImplementation(async (sql, values) => [{ affectedRows: db.prepare(sql).run(...params(values)).changes }]);
      state.contatos.mockImplementation(async id => ({ ...session, agendamentoId: id }));
      state.enviar.mockImplementation(async (_telefone, _texto, _finalidade, chave: string) => {
        const id = Number(chave.split(':')[2]);
        return id === 50 ? { situacao: 'enviada' } : { situacao: 'falha', reenvioSeguro: id % 2 === 0 };
      });
      await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ adiados: 25, incertos: 25, enviados: 0 });
      await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ adiados: 0, incertos: 0, enviados: 1 });
      expect(state.enviar).toHaveBeenCalledTimes(51);
    } finally { db.close(); }
  });
  it('retoma a remarcação com a mesma chave e sem guardar o conteúdo na fila', async () => {
    state.query.mockResolvedValue([[{ id: 'aviso', agendamento_id: 'appointment', tipo: 'remarcacao_paciente', versao: 2,
      dados_reenvio: { inicioAnterior: '2026-09-24T15:00:00Z', inicioNovo: session.inicio, fimNovo: session.fim, modalidade: session.modalidade } }]]);
    state.contatos.mockResolvedValue(session);
    await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ enviados: 1 });
    expect(state.enviar).toHaveBeenCalledWith(session.pacienteTelefone, expect.stringContaining('Horário anterior:'),
      'agenda_remarcacao_paciente', 'agenda:remarcacao_paciente:appointment:2',
      false, expect.objectContaining({ variaveis: expect.objectContaining({ nome_paciente: 'Paciente fictício' }) }));
  });
  it('descarta remarcação superada por outra alteração', async () => {
    state.query.mockResolvedValue([[{ id: 'aviso', agendamento_id: 'appointment', tipo: 'remarcacao_paciente', versao: 2,
      dados_reenvio: { inicioAnterior: '2026-09-24T15:00:00Z', inicioNovo: '2026-09-26T18:00:00Z', fimNovo: session.fim, modalidade: session.modalidade } }]]);
    state.contatos.mockResolvedValue(session);
    await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ descartados: 1 });
    expect(state.enviar).not.toHaveBeenCalled();
  });
  it('descarta aviso de pedido já respondido', async () => {
    state.query.mockResolvedValueOnce([[{ id: 'aviso', agendamento_id: 'appointment', tipo: 'solicitacao_reagendamento_psicologo', versao: 1,
      dados_reenvio: { inicioSolicitado: '2026-09-27T16:00:00Z' } }]])
      .mockResolvedValueOnce([[{ status: 'aceita' }]]);
    await expect(liberarAvisosAguardando(abertura)).resolves.toMatchObject({ descartados: 1 });
    expect(state.enviar).not.toHaveBeenCalled();
  });
});
