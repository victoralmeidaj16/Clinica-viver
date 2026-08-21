import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/context', () => ({ resolveRequestContext: vi.fn() }));
vi.mock('@/server/application/monthlyIndicators', () => ({ getMonthlyIndicators: vi.fn() }));

import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError } from '@/server/application/http';
import { getMonthlyIndicators } from '@/server/application/monthlyIndicators';
import { GET } from './route';

const mockedContext = vi.mocked(resolveRequestContext);
const mockedIndicators = vi.mocked(getMonthlyIndicators);

describe('GET /api/application/indicadores', () => {
  beforeEach(() => { mockedContext.mockReset(); mockedIndicators.mockReset(); });

  it('exige uma sessão autenticada', async () => {
    mockedContext.mockRejectedValue(new ApplicationError('UNAUTHENTICATED', 'Faça login para continuar.', 401));
    const response = await GET(new Request('http://localhost/api/application/indicadores?competencia=2026-08'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('repassa a competência e usa o envelope padrão', async () => {
    const context = { actor: { organizationId: 'org-1' }, correlationId: 'correlation-1' };
    mockedContext.mockResolvedValue(context as never);
    mockedIndicators.mockResolvedValue({ competencia: '2026-08' } as never);
    const request = new Request('http://localhost/api/application/indicadores?competencia=2026-08');
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(mockedIndicators).toHaveBeenCalledWith(context, '2026-08');
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { competencia: '2026-08' } });
  });
});
