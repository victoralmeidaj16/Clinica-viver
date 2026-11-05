import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PsicologoCardDetalhes } from './PsicologoCardDetalhes';
import type { PsicologoItem } from './types';

describe('acessibilidade nos detalhes da gestão', () => {
  it('mostra a necessidade informada pelo profissional à gestão', () => {
    const p: PsicologoItem = { id: 'psi-ficticio', nomeCompleto: 'Profissional fictício', crp: '00/00000', whatsapp: '', status: 'EM_ANALISE',
      acessibilidade: { necessita: true, descricao: 'Intérprete de Libras.' } };
    const html = renderToStaticMarkup(<PsicologoCardDetalhes p={p} trabalhando={false} onReenviarConvite={() => {}} />);
    expect(html).toContain('Necessidade de acessibilidade do profissional: Sim');
    expect(html).toContain('Intérprete de Libras.');
  });
});
