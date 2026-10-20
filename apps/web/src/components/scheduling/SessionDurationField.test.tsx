import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { regrasDuracaoSessao } from '@/lib/duracaoSessao';
import { SessionDurationField } from './SessionDurationField';

const html = (value: number, duracoesFixas: readonly number[], permiteVariavel = false) =>
  renderToStaticMarkup(<SessionDurationField value={value} onChange={vi.fn()} duracoesFixas={duracoesFixas} permiteVariavel={permiteVariavel} className="" />);

describe('SessionDurationField', () => {
  it('oferece apenas 50 min no atendimento individual', () => {
    const markup = html(50, [50]);
    expect(markup).toContain('50 min');
    expect(markup).not.toContain('1h30min');
    expect(markup).not.toContain('Variável');
    expect(markup).not.toContain('type="number"');
  });

  it('oferece 1h30 para casal/família', () => {
    expect(html(50, [50, 90])).toContain('1h30min');
  });

  it('mostra Variável e o campo de minutos para avaliação psicológica', () => {
    expect(html(50, [50, 90], true)).toContain('Variável');
    expect(html(120, [50, 90], true)).toContain('type="number"');
  });

  it('mantém visível a duração de uma grade salva antes das novas opções', () => {
    expect(html(60, [50])).toContain('1h</option>');
  });
});

describe('regrasDuracaoSessao', () => {
  it('deriva as opções do cadastro de psicólogo', () => {
    expect(regrasDuracaoSessao(undefined)).toEqual({ duracoesFixas: [50], permiteVariavel: false });
    expect(regrasDuracaoSessao({ publicoAlvo: ['Casais'] })).toEqual({ duracoesFixas: [50, 90], permiteVariavel: false });
    expect(regrasDuracaoSessao({ publicoAlvo: ['Família'] })).toEqual({ duracoesFixas: [50, 90], permiteVariavel: false });
    expect(regrasDuracaoSessao({ servicosPrestados: ['Avaliação Psicológica'] })).toEqual({ duracoesFixas: [50, 90], permiteVariavel: true });
  });

  it('prioriza o tempo informado no cadastro da pós-graduação', () => {
    expect(regrasDuracaoSessao({ temposAtendimento: [90], publicoAlvo: ['Criança'] }))
      .toEqual({ duracoesFixas: [90], permiteVariavel: false });
  });
});
