import { describe, expect, it } from 'vitest';
import { chaveTurma, normalizarIdentidadeTurma } from './turmaEncerrada';

describe('identidade da turma', () => {
  it('apara os campos e normaliza o código para maiúsculas', () => {
    expect(normalizarIdentidadeTurma({ turma: ' 25a ', posGraduacao: ' Psicodrama ' }))
      .toEqual({ turma: '25A', posGraduacao: 'Psicodrama' });
  });

  it('distingue cursos diferentes com o mesmo código', () => {
    expect(chaveTurma({ turma: '25A', posGraduacao: 'Psicodrama' }))
      .not.toBe(chaveTurma({ turma: '25A', posGraduacao: 'Psicanálise' }));
  });

  it('produz a mesma chave para variações normalizáveis', () => {
    expect(chaveTurma({ turma: ' 25a', posGraduacao: ' Psicodrama ' }))
      .toBe(chaveTurma({ turma: '25A', posGraduacao: 'Psicodrama' }));
  });
});
