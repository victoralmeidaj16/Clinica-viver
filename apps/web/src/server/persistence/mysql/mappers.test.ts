import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { fromSqlTimestamp, toPatientProfile, toSqlTimestamp, type PacienteRow } from './mappers';

describe('mapeamento de timestamps MySQL', () => {
  it('normaliza texto UTC, instantes ISO e objetos Date para o mesmo instante', () => {
    for (const value of ['2026-10-27 12:00:00.000', '2026-10-27T12:00:00Z', '2026-10-27T09:00:00-03:00', new Date('2026-10-27T12:00:00Z')]) {
      expect(fromSqlTimestamp(value)).toBe('2026-10-27T12:00:00.000Z');
    }
  });
  it('converte o horário ISO recebido por webhooks para o formato aceito pelo MySQL', () => {
    expect(toSqlTimestamp('2026-09-02T13:17:47.912Z'))
      .toBe('2026-09-02 13:17:47.912');
  });
});

describe('toPatientProfile', () => {
  it('inclui o profissional_ref nos atribuídos caso não conste na lista agregada', () => {
    const profile = toPatientProfile({
      ref_core: 'paciente-1',
      organizacao_ref: 'org-1',
      usuario_ref: null,
      referencia_externa: null,
      nome: 'João da Silva',
      nome_social: null,
      data_nascimento: '1990-01-01',
      status: 'ativo',
      profissional_ref: 'psi-1',
      atribuidos: null,
      criado_em: '2026-01-01 10:00:00',
      atualizado_em: '2026-01-01 10:00:00',
    } as unknown as PacienteRow);

    expect(profile.primaryProfessionalId).toBe('psi-1');
    expect(profile.assignedProfessionalIds).toContain('psi-1');
  });
});
