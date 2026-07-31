import type { AssessmentInstrument } from '../assessmentTypes';
import { FREQUENCY_OPTIONS } from './shared';

export const GAD7_INSTRUMENT: AssessmentInstrument = {
  id: 'inst_gad7',
  code: 'GAD-7',
  title: 'GAD-7 — Escala de Ansiedade Generalizada',
  description: 'Instrumento de rastreio e mensuração da gravidade de sintomas de ansiedade.',
  category: 'Ansiedade',
  instructions:
    'Durante as últimas 2 semanas, com que frequência você foi incomodado/a pelos problemas abaixo?',
  questionsCount: 7,
  maxScore: 21,
  questions: [
    { id: 'q1', statement: 'Sentir-se nervoso/a, ansioso/a ou muito tenso/a', options: FREQUENCY_OPTIONS },
    {
      id: 'q2',
      statement: 'Não ser capaz de impedir ou de controlar as preocupações',
      options: FREQUENCY_OPTIONS,
    },
    { id: 'q3', statement: 'Preocupar-se muito com diversas coisas', options: FREQUENCY_OPTIONS },
    { id: 'q4', statement: 'Dificuldade para relaxar', options: FREQUENCY_OPTIONS },
    {
      id: 'q5',
      statement: 'Ficar tão agitado/a que se torna difícil permanecer sentado/a',
      options: FREQUENCY_OPTIONS,
    },
    { id: 'q6', statement: 'Ficar facilmente aborrecido/a ou irritado/a', options: FREQUENCY_OPTIONS },
    {
      id: 'q7',
      statement: 'Sentir medo como se algo horrível fosse acontecer',
      options: FREQUENCY_OPTIONS,
    },
  ],
  source: {
    title: 'GAD-7 — Portuguese for Brazil',
    language: 'pt-BR',
    url: 'https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/GAD7_Portuguese%20for%20Brazil.pdf',
    attribution: 'Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke e colegas.',
    permissionNotice: 'Não é necessária permissão para reproduzir, traduzir, exibir ou distribuir.',
  },
};
