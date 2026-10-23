import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ write: vi.fn(), read: vi.fn(() => null) }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: vi.fn() }));
vi.mock('./persistence', async (original) => ({
  ...await original<typeof import('./persistence')>(), readSnapshot: mocks.read, writeSnapshot: mocks.write,
}));
import { persistApplicationState } from './store';
const scope = globalThis as typeof globalThis & { __thatsLifeApplication?: unknown };
afterEach(() => { delete scope.__thatsLifeApplication; vi.clearAllMocks(); });
it('não lê nem copia a fila cifrada para o snapshot local em uma instalação MySQL nova', async () => {
  const list = vi.fn(async () => [{ body: 'Resumo privado' }]);
  scope.__thatsLifeApplication = {
    notifications: { list }, appointments: { list }, sessions: { list }, records: { list },
    financial: { getLedger: list }, deliveredHandoffs: [], assessments: [], preferences: [], consents: [],
  };
  await persistApplicationState();
  expect(list).not.toHaveBeenCalled();
  expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ notifications: [], records: [], timeline: [] }));
  expect(JSON.stringify(mocks.write.mock.calls)).not.toContain('Resumo privado');
});
