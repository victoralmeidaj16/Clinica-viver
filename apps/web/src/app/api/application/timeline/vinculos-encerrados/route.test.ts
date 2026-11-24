import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({ contexto: vi.fn(), listar: vi.fn() }));
vi.mock('@/server/application/context', () => ({ resolveRequestContext: mocks.contexto }));
vi.mock('@/server/application/timelineService', () => ({ listFormerTimelinePatients: mocks.listar }));

import { GET } from './route';

const ator = (roles: string[]) => ({ actor: { roles, organizationId: 'org-ficticia', professionalProfileId: 'profissional-a' } });

describe('GET /api/application/timeline/vinculos-encerrados', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve ao psicólogo os pacientes de vínculos encerrados', async () => {
    mocks.contexto.mockResolvedValue(ator(['professional']));
    mocks.listar.mockResolvedValue([{ patientId: 'paciente-transferido', displayName: 'Paciente Transferida' }]);

    const resposta = await GET(new Request('http://localhost/api/application/timeline/vinculos-encerrados'));

    expect(resposta.status).toBe(200);
    expect(JSON.stringify(await resposta.json())).toContain('Paciente Transferida');
  });

  it('nega à Gestão, que não tem acesso clínico', async () => {
    mocks.contexto.mockResolvedValue(ator(['admin']));

    const resposta = await GET(new Request('http://localhost/api/application/timeline/vinculos-encerrados'));

    expect(resposta.status).toBe(403);
    expect(mocks.listar).not.toHaveBeenCalled();
  });
});
