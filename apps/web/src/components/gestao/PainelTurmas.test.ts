import { describe, expect, it } from 'vitest';
import { montarModeloPainelTurmas } from './PainelTurmas';
import type { PsicologoItem } from './types';

const psicodrama = 'Formação e Pós-graduação em Psicodrama';
const psicanalise = 'Programa de Estudos e Pós-graduação em Psicanálise';

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

describe('modelo do painel de turmas', () => {
  it('agrupa por curso e cria uma linha para cada código', () => {
    const modelo = montarModeloPainelTurmas([
      psicologo({ turmaViverMais: '25B', posGraduacaoViverMais: psicodrama }),
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicodrama }),
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicanalise }),
    ], []);

    expect(modelo.grupos.map((grupo) => grupo.posGraduacao)).toEqual([psicodrama, psicanalise]);
    expect(modelo.grupos[0].turmas.map((item) => item.identidade.turma)).toEqual(['25A', '25B']);
    expect(modelo.grupos[1].turmas).toHaveLength(1);
  });

  it('conta aprovados sem duplicar a combinação', () => {
    const modelo = montarModeloPainelTurmas([
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicodrama }),
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicodrama }),
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicodrama, status: 'EM_ANALISE' }),
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicodrama, status: 'RECUSADO' }),
    ], []);

    expect(modelo.grupos[0].turmas).toHaveLength(1);
    expect(modelo.grupos[0].turmas[0].quantidade).toBe(2);
  });

  it('não usa a segunda pós e contabiliza aprovados incompletos', () => {
    const modelo = montarModeloPainelTurmas([
      psicologo({ turmaViverMais: '25A', segundaPosGraduacao: psicodrama }),
      psicologo({ posGraduacaoViverMais: psicodrama }),
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: '   ' }),
    ], []);

    expect(modelo.grupos).toEqual([]);
    expect(modelo.cadastrosIncompletos).toBe(3);
  });

  it('associa o encerramento somente à combinação exata', () => {
    const modelo = montarModeloPainelTurmas([
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicodrama }),
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: psicanalise }),
    ], [{ turma: '25A', posGraduacao: psicodrama, encerradaEm: '2026-10-06' }]);

    expect(modelo.grupos[0].turmas[0].encerramento?.posGraduacao).toBe(psicodrama);
    expect(modelo.grupos[1].turmas[0].encerramento).toBeUndefined();
  });

  it('mostra curso legado, mas o marca como não administrável', () => {
    const modelo = montarModeloPainelTurmas([
      psicologo({ turmaViverMais: '25A', posGraduacaoViverMais: 'Curso legado' }),
    ], []);

    expect(modelo.cursosForaCatalogo).toBe(1);
    expect(modelo.grupos[0].turmas[0].administravel).toBe(false);
  });
});
