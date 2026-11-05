import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import PatientConvenioPanel from './PatientConvenioPanel';
import type { ManagedPatient } from './managementTypes';

const PACIENTE = { patientId: 'pat-1', convenioId: 'conv-1' } as ManagedPatient;

function painel(patient: Partial<ManagedPatient>, pacote?: { pacoteSessoes: number; pacoteSessoesCiclo: 'total' | 'mensal' }) {
  return renderToStaticMarkup(<PatientConvenioPanel patient={{ ...PACIENTE, ...patient }} onConvenioChange={vi.fn()}
    convenios={[{ id: 'conv-1', nome: 'Convênio fictício', empresaPagaSessoes: true, ...pacote }]} />);
}

it('com pacote, não oferece cota individual e mostra o saldo do pacote', () => {
  const markup = painel({ custeioCota: 10, custeioCiclo: 'total', custeioConsumidas: 3 }, { pacoteSessoes: 10, pacoteSessoesCiclo: 'total' });
  expect(markup).not.toContain('Personalizada: empresa cobre uma quantidade');
  expect(markup).not.toContain('Sessões por conta da empresa');
  expect(markup).toContain('Pacote do convênio: 10 sessões no total');
  expect(markup).toContain('Já usadas 3 de 10');
  expect(markup).toContain('7 restantes');
});

it('descreve o pacote mensal', () => {
  expect(painel({ custeioCota: 4, custeioCiclo: 'mensal', custeioConsumidas: 1 }, { pacoteSessoes: 4, pacoteSessoesCiclo: 'mensal' }))
    .toContain('Pacote do convênio: 4 sessões por mês');
});

it('sem pacote, mantém a cota individual', () => {
  const markup = painel({ custeioCota: 5, custeioCiclo: 'total' });
  expect(markup).toContain('Personalizada: empresa cobre uma quantidade');
  expect(markup).toContain('Sessões por conta da empresa');
  expect(markup).not.toContain('Pacote do convênio');
});
