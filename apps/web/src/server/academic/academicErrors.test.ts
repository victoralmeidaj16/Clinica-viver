import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ApplicationError } from '@/server/application/http';
import { academicFailure } from './academicErrors';

describe('academicFailure', () => {
  it('preserva código, status e mensagem de erros de aplicação', async () => {
    const response = academicFailure(new ApplicationError('NOT_FOUND', 'Curso não encontrado.', 404));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'Curso não encontrado.' } });
  });

  it('troca erros inesperados por mensagem genérica sem vazar detalhes', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = academicFailure(new Error('PERSISTENCE_UNAVAILABLE: o portal do aluno exige MySQL.'));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('MySQL');
    expect(log).toHaveBeenCalledOnce();
  });
});
