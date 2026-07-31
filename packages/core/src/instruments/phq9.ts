import type { AssessmentInstrument } from '../assessmentTypes';
import { FREQUENCY_OPTIONS } from './shared';

export const PHQ9_INSTRUMENT: AssessmentInstrument = {
  id: 'inst_phq9',
  code: 'PHQ-9',
  title: 'PHQ-9 — Questionário de Saúde do Paciente',
  description: 'Instrumento de rastreio e mensuração da gravidade de sintomas depressivos.',
  category: 'Depressão',
  instructions:
    'Durante as últimas 2 semanas, com que frequência você foi incomodado/a por qualquer um dos problemas abaixo?',
  questionsCount: 9,
  maxScore: 27,
  questions: [
    { id: 'q1', statement: 'Pouco interesse ou pouco prazer em fazer as coisas', options: FREQUENCY_OPTIONS },
    { id: 'q2', statement: 'Se sentir “para baixo”, deprimido/a ou sem perspectiva', options: FREQUENCY_OPTIONS },
    {
      id: 'q3',
      statement:
        'Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume',
      options: FREQUENCY_OPTIONS,
    },
    { id: 'q4', statement: 'Se sentir cansado/a ou com pouca energia', options: FREQUENCY_OPTIONS },
    { id: 'q5', statement: 'Falta de apetite ou comendo demais', options: FREQUENCY_OPTIONS },
    {
      id: 'q6',
      statement:
        'Se sentir mal consigo mesmo/a — ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo/a',
      options: FREQUENCY_OPTIONS,
    },
    {
      id: 'q7',
      statement: 'Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão',
      options: FREQUENCY_OPTIONS,
    },
    {
      id: 'q8',
      statement:
        'Lentidão para se movimentar ou falar, a ponto das outras pessoas perceberem? Ou o oposto — estar tão agitado/a ou irrequieto/a que você fica andando de um lado para o outro muito mais do que de costume',
      options: FREQUENCY_OPTIONS,
    },
    {
      id: 'q9',
      statement: 'Pensar em se ferir de alguma maneira ou que seria melhor estar morto/a',
      options: FREQUENCY_OPTIONS,
    },
  ],
  followUpQuestions: [
    {
      id: 'functionalImpact',
      statement:
        'Se você assinalou qualquer um dos problemas, indique o grau de dificuldade que os mesmos lhe causaram para realizar seu trabalho, tomar conta das coisas em casa ou para se relacionar com as pessoas.',
      options: [
        { value: 0, label: 'Nenhuma dificuldade' },
        { value: 1, label: 'Alguma dificuldade' },
        { value: 2, label: 'Muita dificuldade' },
        { value: 3, label: 'Extrema dificuldade' },
      ],
    },
  ],
  source: {
    title: 'PHQ-9 — Portuguese for Brazil',
    language: 'pt-BR',
    url: 'https://www.phqscreeners.com/images/sites/g/files/g10060481/f/201412/PHQ9_Portuguese%20for%20Brazil.pdf',
    attribution: 'Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke e colegas.',
    permissionNotice: 'Não é necessária permissão para reproduzir, traduzir, exibir ou distribuir.',
  },
};
