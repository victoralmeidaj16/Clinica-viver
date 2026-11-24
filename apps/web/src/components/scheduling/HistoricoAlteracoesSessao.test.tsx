import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ListaAlteracoes } from './HistoricoAlteracoesSessao';
import type { AlteracaoAgendamento } from '@/lib/alteracoesAgendamento';

it('mostra autor, data e os valores de cada alteração', () => {
  const linha: AlteracaoAgendamento = { id: '1', agendamentoId: 'apt', profissionalRef: 'prof',
    alteradoPorNome: 'Gestora A', alteradoEm: '2026-11-10T12:00:00Z',
    mudancas: [{ campo: 'formato', rotulo: 'Formato', de: 'On-line', para: 'Presencial' }] };
  const html = renderToStaticMarkup(<ListaAlteracoes alteracoes={[linha, { ...linha, id: '2', alteradoPorNome: 'Gestora B' }]} />);
  for (const texto of ['Gestora A', 'Gestora B', '10/11/2026 às 09:00', 'Formato: On-line → Presencial']) expect(html).toContain(texto);
});

it('informa quando o histórico está vazio', () => {
  expect(renderToStaticMarkup(<ListaAlteracoes alteracoes={[]} />)).toContain('Nenhuma alteração registrada pela Gestão.');
});
