import { afterEach, expect, it, vi } from 'vitest';
import { publicoDoVinculo } from './publicoDoVinculo';

const mocks = vi.hoisted(() => ({ mysql: vi.fn(), execute: vi.fn(), read: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: mocks.mysql, getMysqlPool: () => ({ execute: mocks.execute }) }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ read: mocks.read }) }));

afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

it('consulta a última triagem no escopo do vínculo e da instituição', async () => {
  mocks.mysql.mockReturnValue(true);
  mocks.execute.mockResolvedValue([[{ para_quem_e: 'Grupo' }]]);
  await expect(publicoDoVinculo('org-1', 'pac-1')).resolves.toBe('Grupo');
  const [sql, params] = mocks.execute.mock.calls[0];
  expect(sql).toMatch(/instituicao_id = \? AND organizacao_ref = \? AND paciente_ref = \?/);
  expect(sql).toMatch(/ORDER BY atualizado_em DESC, id DESC LIMIT 1/);
  expect(params).toEqual([expect.any(String), 'org-1', 'pac-1']);
});

it('no arquivo, usa a triagem mais recente do paciente na organização configurada', async () => {
  vi.stubEnv('ORGANIZATION_ID', 'org-1');
  mocks.mysql.mockReturnValue(false);
  mocks.read.mockResolvedValue({ triagensPacientes: [
    { pacienteRef: 'pac-1', criadoEm: '2026-10-01', paraQuemE: 'Adulto' },
    { pacienteRef: 'pac-2', criadoEm: '2026-12-01', paraQuemE: 'Casal' },
    { pacienteRef: 'pac-1', criadoEm: '2026-11-01', paraQuemE: 'Grupo' },
  ] });
  await expect(publicoDoVinculo('org-2', 'pac-1')).resolves.toBeUndefined();
  expect(mocks.read).not.toHaveBeenCalled();
  await expect(publicoDoVinculo('org-1', 'pac-1')).resolves.toBe('Grupo');
  await expect(publicoDoVinculo('org-1', 'pac-3')).resolves.toBeUndefined();
});
