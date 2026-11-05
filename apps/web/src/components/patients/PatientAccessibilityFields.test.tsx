import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PatientAccessibilityFields } from './PatientAccessibilityFields';

describe('pergunta de acessibilidade', () => {
  it('oferece Sim, Não e Prefiro não informar sem tornar a resposta obrigatória', () => {
    const html = renderToStaticMarkup(<PatientAccessibilityFields onChange={() => {}} />);
    expect(html).toContain('deficiência ou necessidade de acessibilidade?');
    expect(html).toContain('Prefiro não informar');
    expect(html).toContain('>Sim</option>');
    expect(html).toContain('>Não</option>');
    expect(html).not.toContain('required');
    expect(html).not.toContain('<textarea');
  });
  it('mostra a adaptação existente somente para Sim', () => {
    const render = (necessita: boolean) => renderToStaticMarkup(<PatientAccessibilityFields
      value={{ necessita, descricao: 'Acesso sem degraus' }} onChange={() => {}} disabled />);
    expect(render(true)).toContain('Acesso sem degraus');
    expect(render(true)).toContain('maxLength="1000"');
    expect(render(true)).toContain('disabled');
    expect(render(false)).not.toContain('<textarea');
  });
});
