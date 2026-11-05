import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ConvenioFormModal } from './ConvenioFormModal';
import type { ConvenioView } from './types';

const CONVENIO = { id: 'conv-1', nome: 'Convênio fictício', empresaPagaSessoes: true, ativo: true,
  pacientes: 0, pacientesCusteados: 0, sessoesProvisionadas: 0, valorProvisionadoCents: 0 } as ConvenioView;

const formulario = (convenio: Partial<ConvenioView>) => renderToStaticMarkup(
  <ConvenioFormModal convenio={{ ...CONVENIO, ...convenio }} onClose={vi.fn()} onSave={vi.fn()} />);

it('permite escolher como o pacote é contado', () => {
  const markup = formulario({ pacoteSessoes: 4, pacoteSessoesCiclo: 'mensal' });
  expect(markup).toContain('Contagem do pacote');
  expect(markup).toMatch(/<option value="mensal" selected="">/);
  expect(markup).toContain('A empresa paga até 4 sessões por mês para cada paciente');
});

it('explica o pacote total por paciente', () => {
  expect(formulario({ pacoteSessoes: 10 })).toContain('A empresa paga as 10 primeiras sessões de cada paciente');
});

it('sem pacote, deixa claro que não há limite', () => {
  expect(formulario({})).toContain('Sem pacote, a empresa paga todas as sessões');
});

it('avisa que o pacote não vale quando a empresa não paga', () => {
  expect(formulario({ empresaPagaSessoes: false, pacoteSessoes: 4 })).toContain('só vale quando a empresa paga as sessões');
});
