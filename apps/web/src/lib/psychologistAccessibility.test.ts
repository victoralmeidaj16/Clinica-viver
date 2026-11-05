import { describe, expect, it } from 'vitest';
import { validarAcessibilidade } from './psychologistAccessibility';

describe('acessibilidade do profissional', () => {
  it('permite não informar e descarta descrição quando responde não', () => {
    expect(validarAcessibilidade(undefined)).toEqual({ ok: true, data: undefined });
    expect(validarAcessibilidade({ necessita: false, descricao: 'Descartar' })).toEqual({ ok: true, data: { necessita: false } });
  });
  it.each(['SIM', [], { necessita: 'false' }, { necessita: true, descricao: 'x'.repeat(1001) }])(
    'recusa resposta inválida ou descrição excessiva: %j', (value) => {
      expect(validarAcessibilidade(value).ok).toBe(false);
    });
});
