import { describe, expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from '@/server/application/persistence';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/persistence', () => ({ readSnapshot: () => null, emptySnapshot: () => ({}) }));
vi.mock('@/server/persistence/turmasEncerradas', () => ({
  comTurmasEncerradas: async (cadastros: CadastroPsicologoRecord[]) => cadastros,
}));

import { MysqlCaptureRepository } from './captureRepository';

const COLUNAS = [
  'prazo_resposta_horas', 'lista_espera', 'inativacoes', 'preferencias_originais',
  'alteracoes_preferencias', 'responsavel_financeiro', 'identificado_por_responsavel', 'vinculo_coletivo',
];

const linhaExistente = {
  ref_core: 'triagem-ficticia', protocolo: 'VM-FICT', nome_paciente: 'Paciente Fictício', telefone: '48988880000',
  convenio_selecionado: 'Nenhum', origem: 'Site', turno: 'TARDE', status: 'PENDENTE_ATRIBUICAO',
  especificar_necessidades: 0, necessidades_paciente: '[]', sla_expirado: 0, transbordos: 0,
  psicologos_ja_tentados: '[]', criado_em: '2026-11-23 12:00:00.000',
};

const novoLead: TriagemPacienteRecord = {
  id: 'triagem-nova', protocolo: 'VM-NOVA', nomePaciente: 'Menor Fictício', telefone: '48988880000',
  convenioSelecionado: 'Nenhum', origem: 'Site', turno: 'TARDE', status: 'PENDENTE_ATRIBUICAO',
  criadoEm: '2026-11-23T12:00:00Z',
  responsavelFinanceiro: { nome: 'Responsável Fictício', cpf: '11144477735' },
  identificadoPeloResponsavel: true,
};

function repositorio(comMigration: boolean, existentes: Record<string, unknown>[] = []) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('column_name AS nome')) {
      return [comMigration
        ? [...COLUNAS.map((nome) => ({ nome, tipo: 'json' })), { nome: 'status', tipo: "enum('PENDENTE_ATRIBUICAO','INATIVO')" }]
        : [{ nome: 'status', tipo: "enum('PENDENTE_ATRIBUICAO')" }]];
    }
    if (sql.includes('information_schema')) return [[{ 1: 1 }]];
    if (sql.includes('FROM clinica_triagens_pacientes')) return [existentes];
    return [[]];
  });
  const connection = {
    query, execute: vi.fn(async () => [{}]),
    beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
  };
  return { connection, repository: new MysqlCaptureRepository({ ...connection, getConnection: async () => connection } as never) };
}

function colunasGravadas(connection: { execute: { mock: { calls: unknown[] } } }) {
  const chamadas = connection.execute.mock.calls as unknown as Array<[string, unknown[]]>;
  const [sql, valores] = chamadas.find(([texto]) => texto.includes('clinica_triagens_pacientes'))!;
  const colunas = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((coluna) => coluna.trim());
  return { colunas, valores };
}

describe('colunas da migration 088 nos pedidos', () => {
  it('sem a migration, grava o pedido novo do site sem as colunas novas', async () => {
    const { connection, repository } = repositorio(false);
    await repository.mutate((state) => ({ next: { ...state, triagensPacientes: [novoLead] }, result: null }));
    const { colunas } = colunasGravadas(connection);
    expect(colunas).not.toContain('responsavel_financeiro');
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it('sem a migration, recusa inativação e mudança de lista de espera com a causa', async () => {
    const inativo = repositorio(false, [linhaExistente]);
    await expect(inativo.repository.mutate((state) => ({
      next: { ...state, triagensPacientes: state.triagensPacientes.map((lead) => ({ ...lead, status: 'INATIVO' as const })) },
      result: null,
    }))).rejects.toThrow('migration 088');
    expect(inativo.connection.rollback).toHaveBeenCalled();

    const espera = repositorio(false, [linhaExistente]);
    await expect(espera.repository.mutate((state) => ({
      next: { ...state, triagensPacientes: state.triagensPacientes.map((lead) => ({
        ...lead, listaEspera: { modo: 'MANUAL' as const, entradaEm: '2026-11-23T12:00:00Z', eventos: [] },
      })) },
      result: null,
    }))).rejects.toThrow('lista_espera');
  });

  it('com a migration, lê e grava responsável, identificação e lista de espera', async () => {
    const { connection, repository } = repositorio(true, [{
      ...linhaExistente,
      lista_espera: JSON.stringify({ modo: 'AUTOMATICO', entradaEm: '2026-11-20T10:00:00Z', eventos: [] }),
      prazo_resposta_horas: 48,
    }]);
    const estado = await repository.read();
    expect(estado.triagensPacientes[0]).toMatchObject({ prazoRespostaHoras: 48, listaEspera: { modo: 'AUTOMATICO' } });

    await repository.mutate((state) => ({ next: { ...state, triagensPacientes: [...state.triagensPacientes, novoLead] }, result: null }));
    const { colunas, valores } = colunasGravadas(connection);
    expect(JSON.parse(String(valores[colunas.indexOf('responsavel_financeiro')]))).toEqual(novoLead.responsavelFinanceiro);
    expect(valores[colunas.indexOf('identificado_por_responsavel')]).toBe(1);
  });
});
