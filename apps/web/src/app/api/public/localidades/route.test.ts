import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET } from './route';

describe('GET /api/public/localidades', () => {
  it('retorna os 27 estados sem depender de uma chamada externa', async () => {
    const response = await GET(new Request('https://example.com/api/public/localidades'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true });
    expect(payload.data).toHaveLength(27);
    expect(payload.data).toContainEqual(expect.objectContaining({ sigla: 'SC', nome: 'Santa Catarina' }));
  });

  it('retorna os municípios oficiais da UF solicitada', async () => {
    const response = await GET(new Request('https://example.com/api/public/localidades?uf=SC'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true });
    expect(payload.data).toContainEqual(expect.objectContaining({ nome: 'Florianópolis' }));
  });
});
