import { expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from '@/server/application/persistence';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/persistence', () => ({ readSnapshot: () => null }));
vi.mock('@/server/persistence/turmasEncerradas', () => ({
  comTurmasEncerradas: async (cadastros: CadastroPsicologoRecord[]) => cadastros,
}));

import { MysqlCaptureRepository } from './captureRepository';

const leadComRecusa: TriagemPacienteRecord = {
  id: 'triagem-recusa-ficticia',
  protocolo: 'VM-RECUSA',
  nomePaciente: 'Paciente Fictício',
  telefone: '48988880000',
  convenioSelecionado: 'Nenhum',
  origem: 'Site',
  turno: 'TARDE',
  status: 'AGUARDANDO_CONTATO',
  criadoEm: '2026-11-23T12:00:00Z',
  recusas: [
    {
      psicologoId: 'psi-1',
      psicologoNome: 'Dra. Teste',
      recusadoEm: '2026-11-23T13:00:00Z',
      motivo: 'Sem agenda no período.',
    },
  ],
};

it('continua salvando normalmente quando a migration 086 ainda não rodou', async () => {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("column_name = 'recusas'")) return [[]];
    if (sql.includes('information_schema')) return [[{ 1: 1 }]];
    return [[]];
  });
  const connection = {
    query,
    execute: vi.fn(async () => [{}]),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
  const repository = new MysqlCaptureRepository({
    ...connection,
    getConnection: async () => connection,
  } as never);

  await repository.mutate((state) => ({
    next: { ...state, triagensPacientes: [leadComRecusa] },
    result: null,
  }));

  const chamadas = connection.execute.mock.calls as unknown as Array<[string, unknown[]]>;
  const [sql] = chamadas.find(([texto]) => texto.includes('clinica_triagens_pacientes'))!;
  expect(sql).not.toContain('recusas');
  expect(connection.commit).toHaveBeenCalledOnce();
});

it('lê e grava o histórico de recusas quando a coluna existe', async () => {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('information_schema')) return [[{ 1: 1 }]];
    if (sql.includes('FROM clinica_triagens_pacientes')) {
      expect(sql).toContain('recusas');
      return [[{
        ref_core: 'triagem-recusa-ficticia',
        protocolo: 'VM-RECUSA',
        nome_paciente: 'Paciente Fictício',
        telefone: '48988880000',
        convenio_selecionado: 'Nenhum',
        origem: 'Site',
        turno: 'TARDE',
        status: 'AGUARDANDO_CONTATO',
        especificar_necessidades: 0,
        necessidades_paciente: '[]',
        sla_expirado: 0,
        transbordos: 0,
        psicologos_ja_tentados: '["psi-1"]',
        recusas: JSON.stringify(leadComRecusa.recusas),
        criado_em: '2026-11-23 12:00:00.000',
      }]];
    }
    return [[]];
  });
  const connection = {
    query,
    execute: vi.fn(async () => [{}]),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
  const repository = new MysqlCaptureRepository({
    ...connection,
    getConnection: async () => connection,
  } as never);

  const state = await repository.read();
  expect(state.triagensPacientes[0].recusas).toEqual(leadComRecusa.recusas);

  await repository.mutate((current) => ({
    next: { ...current, triagensPacientes: [leadComRecusa] },
    result: null,
  }));
  const chamadas = connection.execute.mock.calls as unknown as Array<[string, unknown[]]>;
  const [sql, valores] = chamadas.find(([texto]) => texto.includes('clinica_triagens_pacientes'))!;
  const colunas = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((coluna) => coluna.trim());
  expect(valores[colunas.indexOf('recusas')]).toBe(JSON.stringify(leadComRecusa.recusas));
});
