import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/persistence/monthlyIndicatorsRepository', () => ({
  readMonthlyIndicatorsData: vi.fn(),
}));

import { readMonthlyIndicatorsData, type MonthlyIndicatorsData } from '@/server/persistence/monthlyIndicatorsRepository';
import { getMonthlyIndicators, resolveCompetencia } from './monthlyIndicators';
import type { RequestContext } from './context';

const mockedRead = vi.mocked(readMonthlyIndicatorsData);

function context(roles: RequestContext['actor']['roles'] = ['admin']): RequestContext {
  return {
    actor: {
      actorType: 'staff', organizationId: 'org-1', userId: 'user-1', membershipId: 'member-1',
      membershipStatus: 'active', roles,
    },
    correlationId: 'correlation-1',
  };
}

function data(overrides: Partial<MonthlyIndicatorsData> = {}): MonthlyIndicatorsData {
  return {
    queue: { pendentesAtribuicao: 1, aguardandoContato: 2, alocados: 2, semProfissional: 1 },
    leads: [], sessions: [], previousSessions: [], audit: [], firstAuditAt: null,
    ...overrides,
  };
}

describe('indicadores mensais', () => {
  beforeEach(() => mockedRead.mockReset());

  it('resolve a competência nas bordas do mês civil de São Paulo', () => {
    expect(resolveCompetencia('2026-08')).toEqual({
      competencia: '2026-08',
      start: '2026-08-01T03:00:00.000Z',
      end: '2026-09-01T03:00:00.000Z',
      previousStart: '2026-07-01T03:00:00.000Z',
    });
    expect(resolveCompetencia('2018-12').start).toBe('2018-12-01T02:00:00.000Z');
    expect(() => resolveCompetencia('2026-13')).toThrow('Competência inválida');
  });

  it('classifica SLA, sessões e distribuições sem inventar uma taxa', async () => {
    mockedRead.mockResolvedValue(data({
      leads: [
        { genero: 'FEMININO', idade: '17', origem: ' Google  Ads ', modalidade: 'SOCIAL', alocadoEm: '2026-08-01T10:00:00.000Z', confirmadoEm: '2026-08-02T09:59:00.000Z', slaExpirado: false },
        { genero: 'MASCULINO', idade: '28', origem: 'google ads', modalidade: 'PARTICULAR', alocadoEm: '2026-08-02T10:00:00.000Z', confirmadoEm: '2026-08-03T10:00:00.000Z', slaExpirado: false },
        { genero: 'NAO_BINARIO', idade: '121', origem: '', modalidade: undefined, alocadoEm: '2026-08-03T10:00:00.000Z', confirmadoEm: '2026-08-04T10:00:01.000Z', slaExpirado: false },
        { genero: undefined, idade: undefined, origem: undefined, modalidade: undefined, alocadoEm: '2026-08-20T10:00:00.000Z', slaExpirado: false },
        { genero: undefined, idade: '43', origem: 'Indicação', modalidade: 'SOCIAL', slaExpirado: false },
        { genero: 'FEMININO', idade: '29', origem: 'Indicação', modalidade: 'SOCIAL', alocadoEm: '2026-08-01T10:00:00.000Z', slaExpirado: true },
      ],
      sessions: [
        { status: 'completed', quantidade: 12 }, { status: 'cancelled', quantidade: 2 },
        { status: 'no_show', quantidade: 1 }, { status: 'scheduled', quantidade: 3 },
      ],
      previousSessions: [{ status: 'completed', quantidade: 10 }],
      audit: [
        { status: 'clinical_record.read', quantidade: 4 },
        { status: 'clinical_record.access_denied', quantidade: 1 },
      ],
      firstAuditAt: '2026-08-01T12:00:00.000Z',
    }));

    const result = await getMonthlyIndicators(context(), '2026-08', new Date('2026-08-20T12:00:00.000Z'));

    expect(result.sla24h).toEqual({ cumpridos: 2, violados: 2, emAndamento: 1, semAlocacao: 1, avaliados: 4, percentual: 50 });
    expect(result.sessoes).toMatchObject({ realizadas: 12, canceladas: 2, faltas: 1, total: 18, variacaoRealizadasPercentual: 20 });
    expect(result.leadsDoMes.genero.reduce((sum, item) => sum + item.percentual, 0)).toBe(100);
    expect(result.leadsDoMes.origens).toContainEqual({ label: 'Google Ads', quantidade: 2, percentual: 34 });
    expect(result.auditoria).toMatchObject({ total: 5, acessosConcedidos: 4, acessosNegados: 1 });
    expect(mockedRead).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
  });

  it('retorna percentual nulo sem casos avaliáveis', async () => {
    mockedRead.mockResolvedValue(data({ leads: [{ alocadoEm: '2026-08-21T10:00:00.000Z', slaExpirado: false }] }));
    const result = await getMonthlyIndicators(context(), '2026-08', new Date('2026-08-21T11:00:00.000Z'));
    expect(result.sla24h).toMatchObject({ avaliados: 0, emAndamento: 1, percentual: null });
  });

  it('nega os totais organizacionais ao psicólogo', async () => {
    await expect(getMonthlyIndicators(context(['professional']), '2026-08')).rejects.toThrow('Acesso negado');
    expect(mockedRead).not.toHaveBeenCalled();
  });
});
