import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
vi.mock('server-only', () => ({}));
import { MysqlIdentityRepository } from './identityRepository';
import type { PatientRegistrationDetails } from '@/lib/patientRegistrationDetails';

const details: PatientRegistrationDetails = { legalName: 'Paciente fictício', phone: '11999999999',
  email: 'teste@example.com', cpf: '11144477735', address: { cep: '01310100', logradouro: 'Rua', numero: '1', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' } };
const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(), execute: vi.fn() };
const pool = { getConnection: async () => connection, query: connection.query } as unknown as Pool;
const repository = new MysqlIdentityRepository(pool);
const input = { organizationId: 'org', patientId: 'patient', details, actorUserId: 'user', changedAt: '2026-09-22T12:00:00.000Z' };

beforeEach(() => {
  vi.resetAllMocks();
  connection.query.mockResolvedValue([[{ ref_core: 'patient', nome: details.legalName, documento: '52998224725' }], []]);
  connection.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
});
describe('sincronização transacional do CPF', () => {
  it('atualiza cadastro e triagens vinculadas antes do commit', async () => {
    await repository.updatePatientRegistration(input);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE clinica_pacientes pa'), expect.any(Array));
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE clinica_triagens_pacientes SET cpf'),
      [details.cpf, expect.any(String), expect.any(String), 'org', 'patient']);
    expect(connection.execute.mock.invocationCallOrder.at(-1)).toBeLessThan(connection.commit.mock.invocationCallOrder[0]);
  });
  it('desfaz a edição se não conseguir sincronizar a triagem', async () => {
    connection.execute.mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE clinica_triagens_pacientes')) throw new Error('falha de persistência');
      return [{ affectedRows: 1 }, []];
    });
    await expect(repository.updatePatientRegistration(input)).rejects.toThrow('falha de persistência');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });
  it('não escreve nada quando o paciente não pertence à organização', async () => {
    connection.query.mockResolvedValue([[], []]);
    expect(await repository.updatePatientRegistration(input)).toBeNull();
    expect(connection.execute).not.toHaveBeenCalled();
  });
});
