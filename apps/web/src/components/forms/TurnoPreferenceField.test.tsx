import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { TurnoPreferenceField } from './TurnoPreferenceField';

it('exibe dois períodos marcados como checkboxes independentes', () => {
  const html = renderToStaticMarkup(<TurnoPreferenceField multiple value="MANHA,NOITE" onChange={vi.fn()} />);
  expect(html.match(/type="checkbox"/g)).toHaveLength(3);
  expect(html.match(/checked=""/g)).toHaveLength(2);
  expect(html).toContain('Selecione um ou mais períodos');
  expect(html).not.toContain('required=""');
});

it('mantém o modo de seleção única dos cadastros internos', () => {
  const html = renderToStaticMarkup(<TurnoPreferenceField value="TARDE" onChange={vi.fn()} />);
  expect(html.match(/type="radio"/g)).toHaveLength(3);
  expect(html.match(/checked=""/g)).toHaveLength(1);
});
