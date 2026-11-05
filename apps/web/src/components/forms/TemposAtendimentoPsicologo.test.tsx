import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TemposAtendimentoPsicologo } from './TemposAtendimentoPsicologo';

describe('duração compartilhada entre cadastro e edição do perfil', () => {
  it.each(['Pós-graduação em Neuropsicologia Clínica', 'Pós-graduação em Avaliação Psicológica'])(
    'oculta todas as opções para %s mesmo com tempos legados', (posGraduacao) => {
      expect(renderToStaticMarkup(<TemposAtendimentoPsicologo posGraduacao={posGraduacao} value={[50, 90]} onChange={() => {}} />)).toBe('');
    });

  it('oculta as opções quando avaliação é a segunda pós', () => {
    expect(renderToStaticMarkup(<TemposAtendimentoPsicologo posGraduacao="Programa de Estudos e Pós-graduação em Psicanálise"
      segundaPosGraduacao="Pós-graduação em Avaliação Psicológica" value={[50, 90]} onChange={() => {}} />)).toBe('');
  });

  it('oferece somente 50 e 90 minutos e exige uma escolha nas demais pós', () => {
    const html = renderToStaticMarkup(<TemposAtendimentoPsicologo posGraduacao="Programa de Estudos e Pós-graduação em Psicanálise"
      value={[]} onChange={() => {}} />);
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(2);
    expect(html).toContain('50min');
    expect(html).toContain('1h30min');
    expect(html).toContain('required');
    expect(html).not.toContain('Variável');
  });
});
