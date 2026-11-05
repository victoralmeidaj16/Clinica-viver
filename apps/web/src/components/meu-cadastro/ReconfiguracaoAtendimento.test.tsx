import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ReconfiguracaoAtendimento } from './ReconfiguracaoAtendimento';

it('exige escolhas novas e mostra somente as opções da formação aprovada', () => {
  const html = renderToStaticMarkup(<ReconfiguracaoAtendimento
    posGraduacao="Pós-graduação em Avaliação Psicológica" onConcluido={async () => {}} />);
  expect(html).toContain('Público que atendo');
  expect(html).toContain('Avaliação Psicológica');
  expect(html).toContain('Criança');
  expect(html).not.toContain('Casais');
  expect(html).not.toContain('Atendimento Psicológico');
  expect(html).not.toContain('checked=');
  expect(html).toContain('Confirmar novos públicos e serviços');
});
