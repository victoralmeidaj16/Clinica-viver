import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { permiteDuracaoVariavel } from '@/lib/duracaoSessao';
import { SessionDurationField } from './SessionDurationField';

const html = (value: number, permiteVariavel: boolean) =>
  renderToStaticMarkup(<SessionDurationField value={value} onChange={vi.fn()} permiteVariavel={permiteVariavel} className="" />);

describe('SessionDurationField', () => {
  it('oferece só 50 min e 1h30 para quem não é aluno de Avaliação Psicológica', () => {
    const markup = html(50, false);
    expect(markup).toContain('50 min');
    expect(markup).toContain('1h30min');
    expect(markup).not.toContain('Variável');
    expect(markup).not.toContain('type="number"');
  });

  it('mostra Variável e o campo de minutos para quem pode escolher a duração', () => {
    expect(html(50, true)).toContain('Variável');
    expect(html(120, true)).toContain('type="number"');
  });

  it('mantém visível a duração de uma grade salva antes das novas opções', () => {
    expect(html(60, false)).toContain('1h</option>');
  });
});

describe('permiteDuracaoVariavel', () => {
  it('vale para a primeira ou a segunda pós em Avaliação Psicológica', () => {
    expect(permiteDuracaoVariavel({ posGraduacaoViverMais: 'Pós-graduação em Avaliação Psicológica' })).toBe(true);
    expect(permiteDuracaoVariavel({ segundaPosGraduacao: 'Pós-graduação em Avaliação Psicológica' })).toBe(true);
    expect(permiteDuracaoVariavel({ posGraduacaoViverMais: 'Pós-graduação em Neuropsicologia Clínica' })).toBe(false);
    expect(permiteDuracaoVariavel(undefined)).toBe(false);
  });
});
