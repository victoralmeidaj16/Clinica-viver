import { describe, expect, it } from 'vitest';
import { opcoesAtendimentoDaPos } from './opcoesPsicologo';

describe('opcoesAtendimentoDaPos', () => {
  const publicoAmplo = [
    'Criança', 'Adolescente', 'Homens', 'Idoso', 'Casais', 'Família', 'Mulheres', 'Grupo', 'Outro',
  ];
  const servicosAmplos = [
    'Atendimento Psicológico',
    'Orientação Vocacional e Profissional',
    'Orientação Parental',
    'Orientação Vocacional',
    'Orientação Profissional',
  ];
  const cursosAmplos = [
    'Programa de Estudos e Pós-graduação em Psicanálise',
    'Formação e Pós-graduação em Psicodrama',
    'Formação e Pós-graduação em Psicologia Existencialista Clínica',
    'Formação e Pós-graduação em Psicologia Junguiana Clínica',
    'Pós-graduação em Psicoterapia da Sexualidade',
    'Formação e Pós-graduação em Terapia Cognitivo-Comportamental',
    'Pós-graduação em Terapias Cognitivo-Comportamentais de Terceira Geração',
    'Formação e Pós-graduação em Terapia Familiar Sistêmica',
    'Formação e Pós-graduação em Psicodrama Didata e Psicoterapeuta do Aluno - Nível II',
    'Formação e Pós-graduação em Psicodrama Didata Orientador e Supervisor - Nível III',
  ];

  it.each(cursosAmplos)('oferece a configuração ampla para %s', (curso) => {
    expect(opcoesAtendimentoDaPos(curso)).toEqual({
      tempos: [50, 90],
      servicos: servicosAmplos,
      publico: publicoAmplo,
    });
  });

  it.each([
    'Pós-graduação em Psicologia Perinatal e Parentalidade',
    'Pós-graduação em Psicoterapia de Casal e Família',
    'Pós-graduação em Psicoterapia Infantil e de Adolescentes',
  ])('restringe %s às modalidades definidas pela coordenação', (curso) => {
    expect(opcoesAtendimentoDaPos(curso)).toEqual({
      tempos: [50, 90],
      servicos: [
        'Atendimento Psicológico',
        'Orientação Parental',
        'Orientação Vocacional e Profissional',
      ],
      publico: publicoAmplo,
    });
  });

  it('aplica o grupo restrito quando Perinatal é a segunda pós', () => {
    expect(opcoesAtendimentoDaPos(
      'Pós-graduação em Psicoterapia de Casal e Família',
      'Pós-graduação em Psicologia Perinatal e Parentalidade',
    )).toEqual({ tempos: [50, 90], servicos: [
      'Atendimento Psicológico', 'Orientação Parental', 'Orientação Vocacional e Profissional',
    ], publico: publicoAmplo });
  });

  it('preserva o grupo amplo quando outra pós pertence a ele', () => {
    expect(opcoesAtendimentoDaPos(
      'Pós-graduação em Psicologia Perinatal e Parentalidade',
      'Programa de Estudos e Pós-graduação em Psicanálise',
    )).toEqual({ tempos: [50, 90], servicos: servicosAmplos, publico: publicoAmplo });
  });

  it('aplica as mesmas regras quando o curso está na segunda pós', () => {
    expect(opcoesAtendimentoDaPos(undefined, 'Pós-graduação em Psicoterapia Infantil e de Adolescentes')?.servicos)
      .toEqual([
        'Atendimento Psicológico',
        'Orientação Parental',
        'Orientação Vocacional e Profissional',
      ]);
    expect(opcoesAtendimentoDaPos(undefined, 'Pós-graduação em Neuropsicologia Clínica')?.publico)
      .toEqual(['Adolescente', 'Criança', 'Idoso', 'Homens', 'Mulheres']);
  });

  it.each([
    'Pós-graduação em Avaliação Psicológica',
    'Pós-graduação em Neuropsicologia Clínica',
  ])('restringe %s à avaliação psicológica', (posGraduacao) => {
    expect(opcoesAtendimentoDaPos(posGraduacao)).toEqual({
      tempos: [50, 90],
      servicos: ['Avaliação Psicológica'],
      publico: ['Adolescente', 'Criança', 'Idoso', 'Homens', 'Mulheres'],
    });
  });
});
