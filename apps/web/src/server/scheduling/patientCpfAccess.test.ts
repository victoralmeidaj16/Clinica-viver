import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ query: vi.fn(), beginTransaction: vi.fn(), rollback: vi.fn(), commit: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ ...state, getConnection: async () => state }), isMysqlConfigured: () => true }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst', rowId: (value: string) => value }));
vi.mock('@/server/persistence/mysql/custeioSql', () => ({
  custeioDoAgendamentoSql: (aliases: { agendamento: string }) => `${aliases.agendamento}.custeado`, custeioEfetivoSql: () => '0',
}));
import { identifyPatient } from './agendaRepository';
import { listPayablePatientSessions, reserveAppointmentCharge } from '@/server/payments/paymentLinkRepository';
const moduleName = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22 ? await import(moduleName) as typeof import('node:sqlite') : null;

describe.skipIf(!sqlite)('CPF atual prevalece sobre a triagem nos links públicos', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = new sqlite!.DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE clinica_organizacoes(id TEXT, ref_core TEXT);
      CREATE TABLE clinica_profissionais(id TEXT, ref_core TEXT, instituicao_id TEXT, organizacao_id TEXT, nome TEXT, valor_social_centavos INT, valor_sessao_centavos INT, token_link_agenda TEXT, ativo INT);
      CREATE TABLE clinica_pacientes(id TEXT, ref_core TEXT, instituicao_id TEXT, nome TEXT, nome_social TEXT, profissional_id TEXT, documento TEXT, convenio_ref TEXT, telefone TEXT, email TEXT);
      CREATE TABLE clinica_triagens_pacientes(instituicao_id TEXT, organizacao_ref TEXT, paciente_ref TEXT, cpf TEXT, modalidade TEXT, atualizado_em TEXT, telefone TEXT, email TEXT);
      CREATE TABLE clinica_pacientes_profissionais(paciente_id TEXT, profissional_id TEXT);
      CREATE TABLE clinica_agendamentos(ref_core TEXT, instituicao_id TEXT, organizacao_id TEXT, paciente_id TEXT, profissional_id TEXT, inicio TEXT, token_pagamento_sessao TEXT, status TEXT, valor_centavos INT, sessao_clinica_ref TEXT, custeado INT);
      CREATE TABLE clinica_convenios(instituicao_id TEXT, organizacao_ref TEXT, ref_core TEXT, nome TEXT);
      CREATE TABLE financeiro_cobrancas(instituicao_id TEXT, sessao_ref TEXT, status TEXT);
      INSERT INTO clinica_organizacoes VALUES ('org-row', 'org');
      INSERT INTO clinica_profissionais VALUES ('pro-row','pro','inst','org-row','Profissional fictício',5000,10000,'token',1);
      INSERT INTO clinica_pacientes VALUES ('patient-row','patient','inst','Paciente fictício',NULL,'pro-row','11144477735',NULL,NULL,NULL);
      INSERT INTO clinica_triagens_pacientes VALUES ('inst','org','patient','52998224725','SOCIAL','2026-09-22',NULL,NULL);
      INSERT INTO clinica_agendamentos VALUES ('appt','inst','org-row','patient-row','pro-row','2099-01-01T15:00:00Z','payment-token','agendado',10000,NULL,0);
    `);
    state.query.mockImplementation(async (sql: string, values: string[]) => [db.prepare(sql.replaceAll('UTC_TIMESTAMP(3)', 'CURRENT_TIMESTAMP').replace(' FOR UPDATE', '')).all(...values), []]);
  });
  afterEach(() => db.close());
  it('rejeita o CPF antigo e aceita o novo na agenda', async () => {
    expect(await identifyPatient('token', '52998224725')).toBeNull();
    expect(await identifyPatient('token', '11144477735')).toMatchObject({ patientRef: 'patient' });
  });
  it.each([null, '', '   '])('preserva o fallback da triagem quando documento é %s', async (documento) => {
    db.prepare('UPDATE clinica_pacientes SET documento = ?').run(documento);
    expect(await identifyPatient('token', '52998224725')).toMatchObject({ patientRef: 'patient' });
  });
  it('normaliza a pontuação do CPF cadastrado', async () => {
    db.exec("UPDATE clinica_pacientes SET documento = '111.444.777-35'");
    expect(await identifyPatient('token', '11144477735')).toMatchObject({ patientRef: 'patient' });
    expect(await identifyPatient('token', '52998224725')).toBeNull();
  });
  it('mantém o acesso pelo cadastro quando não existe triagem', async () => {
    db.exec('DELETE FROM clinica_triagens_pacientes');
    expect(await identifyPatient('token', '11144477735')).toMatchObject({ patientRef: 'patient' });
  });
  it('aplica a mesma precedência à lista de sessões para pagamento', async () => {
    expect(await listPayablePatientSessions({ token: 'payment-token', cpf: '52998224725' })).toEqual([]);
    expect(await listPayablePatientSessions({ token: 'payment-token', cpf: '11144477735' })).toHaveLength(1);
    db.exec('UPDATE clinica_pacientes SET documento = NULL');
    expect(await listPayablePatientSessions({ token: 'payment-token', cpf: '52998224725' })).toHaveLength(1);
  });
  it('recusa CPF antigo também ao reservar o checkout', async () => {
    expect(await reserveAppointmentCharge({ token: 'payment-token', cpf: '52998224725' })).toBeNull();
    // Retorno custeado encerra a reserva após autenticar, sem criar cobrança no teste.
    db.exec('UPDATE clinica_agendamentos SET custeado = 1');
    expect(await reserveAppointmentCharge({ token: 'payment-token', cpf: '11144477735' })).toMatchObject({ fundedByCompany: true });
    db.exec("UPDATE clinica_pacientes SET documento = ''");
    expect(await reserveAppointmentCharge({ token: 'payment-token', cpf: '52998224725' })).toMatchObject({ fundedByCompany: true });
  });
});
