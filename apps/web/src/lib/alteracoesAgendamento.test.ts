import { expect, it } from 'vitest';
import { diferencasDoAgendamento } from './alteracoesAgendamento';

const antes = { inicio: '2026-11-24T12:30:00Z', fim: '2026-11-24T13:20:00Z', modalidade: 'online' };

it('considera somente os campos enviados pela Gestão', () => {
  expect(diferencasDoAgendamento(antes, { modalidade: 'presencial' })).toEqual([
    { campo: 'formato', rotulo: 'Formato', de: 'On-line', para: 'Presencial' },
  ]);
});

it('reconhece o mesmo instante em fusos diferentes', () => {
  expect(diferencasDoAgendamento(antes, { inicio: '2026-11-24T09:30:00-03:00', fim: antes.fim })).toEqual([]);
});

it('mostra o intervalo no fuso da clínica', () => {
  expect(diferencasDoAgendamento(antes, { inicio: '2026-11-25T14:30:00Z', fim: '2026-11-25T15:20:00Z' })).toEqual([
    { campo: 'horario', rotulo: 'Data e horário', de: '24/11/2026 às 09:30 – 10:20', para: '25/11/2026 às 11:30 – 12:20' },
  ]);
});

it('registra alteração de valor da sessão formatada em reais', () => {
  const mudancas = diferencasDoAgendamento({ valorCentavos: 12000 }, { valorCentavos: 15000 });
  expect(mudancas).toHaveLength(1);
  expect(mudancas[0]).toMatchObject({ campo: 'valor', rotulo: 'Valor da sessão' });
  expect(mudancas[0].de).toContain('120,00');
  expect(mudancas[0].para).toContain('150,00');
});
