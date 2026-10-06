import { describe, expect, it } from 'vitest';
import { posGraduacoesDaTurma } from './PainelTurmas';
import type { PsicologoItem } from './types';

function psicologo(overrides: Partial<PsicologoItem>): PsicologoItem {
  return {
    id: crypto.randomUUID(),
    nomeCompleto: 'Psicólogo de teste',
    crp: 'CRP 00/00000',
    whatsapp: '11999999999',
    status: 'APROVADO',
    ...overrides,
  };
}

describe('posGraduacoesDaTurma', () => {
  it('lista as pós-graduações únicas dos psicólogos aprovados da turma', () => {
    const psicologos = [
      psicologo({ turmaViverMais: '24A', posGraduacaoViverMais: 'Psicodrama' }),
      psicologo({ turmaViverMais: '24A', posGraduacaoViverMais: 'Psicanálise' }),
      psicologo({ turmaViverMais: '24A', posGraduacaoViverMais: 'Psicodrama' }),
      psicologo({ turmaViverMais: '24B', posGraduacaoViverMais: 'Neuropsicologia' }),
      psicologo({ turmaViverMais: '24A', posGraduacaoViverMais: 'Perinatal', status: 'RECUSADO' }),
    ];

    expect(posGraduacoesDaTurma(psicologos, '24A')).toEqual(['Psicanálise', 'Psicodrama']);
  });

  it('não atribui a segunda pós à turma da primeira formação', () => {
    const psicologos = [
      psicologo({
        turmaViverMais: '25B',
        posGraduacaoViverMais: 'Psicologia Junguiana',
        segundaPosGraduacao: 'Terapia Familiar Sistêmica',
      }),
    ];

    expect(posGraduacoesDaTurma(psicologos, '25B')).toEqual(['Psicologia Junguiana']);
  });

  it('ignora valores vazios', () => {
    const psicologos = [
      psicologo({ turmaViverMais: '26A', posGraduacaoViverMais: '  ' }),
      psicologo({ turmaViverMais: '26A' }),
    ];

    expect(posGraduacoesDaTurma(psicologos, '26A')).toEqual([]);
  });
});
