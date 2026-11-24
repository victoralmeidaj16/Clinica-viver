import { describe, expect, it } from 'vitest';
import { camposAlterados, mascararCpf, reaisDeCentavos } from './auditoria';

describe('trilha de alterações', () => {
  it('devolve só os campos que mudaram, com rótulo, anterior e novo', () => {
    expect(camposAlterados(
      { valor: 'R$ 100,00', categoria: 'Particular', ativo: true },
      { valor: 'R$ 120,00', categoria: 'Particular', ativo: false },
      { valor: 'Valor', categoria: 'Categoria', ativo: 'Ativo' },
    )).toEqual([
      { campo: 'valor', rotulo: 'Valor', anterior: 'R$ 100,00', novo: 'R$ 120,00' },
      { campo: 'ativo', rotulo: 'Ativo', anterior: 'Sim', novo: 'Não' },
    ]);
  });

  it('trata ausência como vazio e ignora campos sem rótulo', () => {
    expect(camposAlterados({ x: null, y: 1 }, { x: 'novo', y: 2 }, { x: 'X' }))
      .toEqual([{ campo: 'x', rotulo: 'X', anterior: '—', novo: 'novo' }]);
  });

  it('mascara o CPF e formata valores', () => {
    expect(mascararCpf('123.456.789-01')).toBe('***.***.*89-01');
    expect(mascararCpf(null)).toBe('—');
    expect(reaisDeCentavos(12050)).toBe('R$ 120,50');
  });
});
