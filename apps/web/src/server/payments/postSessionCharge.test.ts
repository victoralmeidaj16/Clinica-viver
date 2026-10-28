import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentRepository, FinancialRepository } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: () => ({ getConnection: async () => db }) }));
import { garantirCobrancaPosSessao } from './postSessionCharge';

const requested = { id: 'new-charge-test', organizationId: 'org-test', sessionId: 'session-test', patientId: 'patient-test',
  professionalId: 'pro-test', issuedAt: '2026-10-28T12:00:00Z', dueAt: '2026-10-29T12:00:00Z', amountCents: 10000,
  status: 'pending' as const, createdAt: '2026-10-28T12:00:00Z', updatedAt: '2026-10-28T12:00:00Z' };
const row = { ref_core: 'existing-test', organizacao_ref: 'org-test', sessao_ref: 'booking-test', paciente_ref: 'patient-test',
  profissional_ref: 'pro-test', emitida_em: '2026-10-27 12:00:00.000', vence_em: '2026-10-29 12:00:00.000',
  valor_centavos: 7500, status: 'paid', forma_pagamento: 'card', provedor_ref: 'remote-test',
  criado_em: '2026-10-27 12:00:00.000', atualizado_em: '2026-10-28 12:00:00.000' };
const dependencies = { financial: {} as FinancialRepository, appointments: {} as AppointmentRepository };
beforeEach(() => {
  vi.resetAllMocks();
  db.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM clinica_agendamentos')) return [[{ ref_core: 'booking-test' }], []];
    if (sql.includes('FROM clinica_sessoes')) return [[{ ref_core: 'session-test' }], []];
    if (sql.startsWith('SELECT ref_core FROM financeiro_cobrancas')) return [[{ ref_core: row.ref_core }], []];
    return [[row], []];
  });
});
describe('cobrança do pós-sessão no MySQL', () => {
  it('encontra a cobrança pela referência do agendamento e não regrava valor ou quitação', async () => {
    expect(await garantirCobrancaPosSessao(requested, dependencies)).toMatchObject({
      id: 'existing-test', sessionId: 'session-test', amountCents: 7500, status: 'paid', providerReference: 'remote-test',
    });
    expect(db.execute).not.toHaveBeenCalled();
    const [chargeSql, chargeParams] = db.query.mock.calls[2];
    expect(chargeSql).toContain('FOR UPDATE');
    expect(chargeParams).toEqual(expect.arrayContaining(['org-test', ['session-test', 'booking-test']]));
    expect(db.commit).toHaveBeenCalledOnce();
    expect(db.release).toHaveBeenCalledOnce();
  });
  it('falha sem criar outra dívida quando já existem duas cobranças do atendimento', async () => {
    const query = db.query.getMockImplementation()!;
    db.query.mockImplementation(async (sql: string, params: unknown[]) => sql.startsWith('SELECT ref_core FROM financeiro_cobrancas')
      ? [[{ ref_core: 'existing-test' }, { ref_core: 'duplicate-test' }], []] : query(sql, params));
    await expect(garantirCobrancaPosSessao(requested, dependencies)).rejects.toThrow('mais de uma cobrança');
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalledOnce();
  });
  it('cria a cobrança ausente dentro da transação que trava o atendimento', async () => {
    const query = db.query.getMockImplementation()!;
    db.query.mockImplementation(async (sql: string, params: unknown[]) => sql.startsWith('SELECT ref_core FROM financeiro_cobrancas')
      ? [[], []] : query(sql, params));
    expect(await garantirCobrancaPosSessao(requested, dependencies)).toEqual(requested);
    expect(db.execute).toHaveBeenCalledOnce();
    expect(db.execute.mock.calls[0][0]).toContain('INSERT INTO financeiro_cobrancas');
    expect(db.beginTransaction.mock.invocationCallOrder[0]).toBeLessThan(db.query.mock.invocationCallOrder[0]);
    expect(db.execute.mock.invocationCallOrder[0]).toBeLessThan(db.commit.mock.invocationCallOrder[0]);
  });
});
