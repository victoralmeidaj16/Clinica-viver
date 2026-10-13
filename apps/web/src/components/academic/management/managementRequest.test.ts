import { afterEach, describe, expect, it, vi } from 'vitest';
import { lessonVimeoInput, sendJson } from './managementRequest';

describe('requisições da gestão acadêmica', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devolve os dados quando a API aceita', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, data: { id: 'x' } })));
    await expect(sendJson('/api/x', 'PATCH', { a: 1 })).resolves.toEqual({ id: 'x' });
  });

  it('transforma a recusa da API em erro com a mensagem para exibir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: false, error: { message: 'Matrícula não encontrada.' } }, { status: 404 })));
    await expect(sendJson('/api/x', 'PATCH', {})).rejects.toThrow('Matrícula não encontrada.');
  });

  it('reenvia o vídeo com o hash para não perdê-lo ao reordenar ou editar', () => {
    expect(lessonVimeoInput({ vimeoId: '123', vimeoHash: 'abc123' })).toBe('https://vimeo.com/123/abc123');
    expect(lessonVimeoInput({ vimeoId: '123' })).toBe('123');
  });
});
