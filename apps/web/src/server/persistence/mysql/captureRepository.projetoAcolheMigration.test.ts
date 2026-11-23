import { expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from '@/server/application/persistence';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/persistence', () => ({ readSnapshot: () => null }));
vi.mock('@/server/persistence/turmasEncerradas', () => ({ comTurmasEncerradas: async (cadastros: CadastroPsicologoRecord[]) => cadastros }));

import { MysqlCaptureRepository } from './captureRepository';

const pacienteAcolhe: TriagemPacienteRecord = {
  id: 'triagem-manual-ficticio', protocolo: 'VM-TESTE', nomePaciente: 'Paciente fictício', telefone: '5500000000000',
  convenioSelecionado: 'Nenhum', origem: 'Cadastro manual', turno: 'MANHA', status: 'CONTATO_CONFIRMADO',
  criadoEm: '2026-11-23T12:00:00Z', psicologoAlocadoId: 'psi-ficticio', projetoAcolhe: true,
};

it('não grava paciente do Projeto Acolhe como vaga comum quando falta a migration', async () => {
  const connection = { query: vi.fn(async () => [[]]), execute: vi.fn(), beginTransaction: vi.fn(),
    commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const repository = new MysqlCaptureRepository({ ...connection, getConnection: async () => connection } as never);

  await expect(repository.mutate((state) => ({
    next: { ...state, triagensPacientes: [pacienteAcolhe] }, result: null,
  }))).rejects.toThrow('083_triagem_projeto_acolhe.sql');
  expect(connection.execute).not.toHaveBeenCalled();
  expect(connection.rollback).toHaveBeenCalledOnce();
  expect(connection.commit).not.toHaveBeenCalled();
});

it('lê e grava a marcação quando a coluna existe', async () => {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('information_schema')) return [[{ 1: 1 }]];
    if (sql.includes('FROM clinica_triagens_pacientes')) {
      expect(sql).toContain('projeto_acolhe');
      return [[]];
    }
    return [[]];
  });
  const connection = { query, execute: vi.fn(async () => [{}]), beginTransaction: vi.fn(),
    commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  const repository = new MysqlCaptureRepository({ ...connection, getConnection: async () => connection } as never);

  await repository.mutate((state) => ({ next: { ...state, triagensPacientes: [pacienteAcolhe] }, result: null }));
  const chamadas = connection.execute.mock.calls as unknown as Array<[string, unknown[]]>;
  const [sql, valores] = chamadas.find(([texto]) => texto.includes('clinica_triagens_pacientes'))!;
  const colunas = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((coluna) => coluna.trim());
  expect(valores[colunas.indexOf('projeto_acolhe')]).toBe(1);
});
