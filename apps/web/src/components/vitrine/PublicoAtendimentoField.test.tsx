import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PublicoAtendimentoField } from './PublicoAtendimentoField';

const render = (value = '', opcoes = ['Individual', 'Infantil', 'Adolescente'] as const) =>
  renderToStaticMarkup(
    <PublicoAtendimentoField
      opcoes={opcoes}
      value={value}
      outroValue=""
      onChange={vi.fn()}
      onOutroChange={vi.fn()}
    />,
  );

describe('PublicoAtendimentoField', () => {
  it('renderiza somente as opções autorizadas para avaliação', () => {
    const markup = render();
    expect(markup).toContain('Individual');
    expect(markup).toContain('Infantil');
    expect(markup).toContain('Adolescente');
    expect(markup).not.toContain('Casal');
    expect(markup).not.toContain('Família');
    expect(markup).not.toContain('Outro');
  });

  it('mostra a especificação apenas quando Outro está selecionado', () => {
    const opcoes = ['Individual', 'Outro'] as const;
    const semOutro = renderToStaticMarkup(
      <PublicoAtendimentoField opcoes={opcoes} value="Individual" outroValue="" onChange={vi.fn()} onOutroChange={vi.fn()} />,
    );
    const comOutro = renderToStaticMarkup(
      <PublicoAtendimentoField opcoes={opcoes} value="Outro" outroValue="gestante" onChange={vi.fn()} onOutroChange={vi.fn()} />,
    );

    expect(semOutro).not.toContain('Especifique para quem');
    expect(comOutro).toContain('Especifique para quem');
    expect(comOutro).toContain('gestante');
  });

  it('não apresenta controles de duração ao paciente', () => {
    const markup = render();
    expect(markup).not.toContain('50 min');
    expect(markup).not.toContain('1h30min');
    expect(markup).not.toContain('type="number"');
  });
});
