import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CadastroPsicologoForm } from './CadastroPsicologoForm';
import { CadastroPsicologoFormacao } from './CadastroPsicologoFormacao';
import { CadastroPsicologoAcessibilidade } from './CadastroPsicologoAcessibilidade';
import { CADASTRO_PSICOLOGO_INICIAL } from './cadastroPsicologoFormState';

describe('credenciamento do psicólogo', () => {
  it('pergunta sobre a acessibilidade do profissional', () => {
    const html = renderToStaticMarkup(<CadastroPsicologoForm onSucesso={() => {}} />);
    expect(html).toContain('Você tem alguma necessidade de acessibilidade?');
  });

  it('exige foto de perfil', () => {
    const html = renderToStaticMarkup(<CadastroPsicologoForm onSucesso={() => {}} />);
    const input = html.match(/<input[^>]*type="file"[^>]*>/)?.[0];
    expect(input).toContain('required');
    expect(html).not.toContain('Foto de Perfil <span class="text-slate-400 font-normal">(opcional)');
  });

  it('mantém a escolha obrigatória de duração no cadastro das demais pós', () => {
    const html = renderToStaticMarkup(<CadastroPsicologoFormacao
      formPsicologo={{ ...CADASTRO_PSICOLOGO_INICIAL, posGraduacaoViverMais: 'Programa de Estudos e Pós-graduação em Psicanálise' }} setFormPsicologo={() => {}}
      temSegundaPos={false} setTemSegundaPos={() => {}} segundaPosGraduacao="" setSegundaPosGraduacao={() => {}} />);
    expect(html).toContain('Tempo de atendimento');
    expect(html).toContain('50min');
    expect(html).toContain('1h30min');
  });

  it.each(['Pós-graduação em Neuropsicologia Clínica', 'Pós-graduação em Avaliação Psicológica'])(
    'não pede duração nem apresenta variável ao selecionar %s', (posGraduacaoViverMais) => {
      const html = renderToStaticMarkup(<CadastroPsicologoFormacao
        formPsicologo={{ ...CADASTRO_PSICOLOGO_INICIAL, posGraduacaoViverMais }} setFormPsicologo={() => {}}
        temSegundaPos={false} setTemSegundaPos={() => {}} segundaPosGraduacao="" setSegundaPosGraduacao={() => {}} />);
      expect(html).toContain('Avaliação Psicológica');
      expect(html.includes('Tempo de atendimento') || html.includes('Variável')).toBe(false);
    });

  it('permite descrever o recurso de acessibilidade ao responder sim', () => {
    const html = renderToStaticMarkup(<CadastroPsicologoAcessibilidade value={{ necessita: true }} onChange={() => {}} />);
    expect(html).toContain('Qual adaptação ou recurso de acessibilidade você precisa?');
    expect(html.toLowerCase()).toContain('maxlength="1000"');
    expect(html).toContain('<textarea');
  });
});
