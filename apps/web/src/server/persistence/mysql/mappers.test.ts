import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { toSqlTimestamp } from './mappers';

describe('mapeamento de timestamps MySQL', () => {
  it('converte o horário ISO recebido por webhooks para o formato aceito pelo MySQL', () => {
    expect(toSqlTimestamp('2026-09-02T13:17:47.912Z'))
      .toBe('2026-09-02 13:17:47.912');
  });
});
