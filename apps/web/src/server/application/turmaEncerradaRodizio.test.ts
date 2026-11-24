import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord } from './persistence';
import { paraPsicologoPerfil } from './viverMaisRodizio';
import { desligadoPorTurma, formatarDataCurta, hojeEmBrasilia } from '@/lib/turmaEncerrada';
import { aplicarTurmasEncerradas } from '@/server/persistence/turmasEncerradas';

const cadastro = (mudancas: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord => ({
  id: 'psi-teste',
  nomeCompleto: 'Cadastro de teste',
  crp: '00/00000',
  whatsapp: '00000000000',
  status: 'APROVADO',
  criadoEm: '2026-01-01T12:00:00.000Z',
  pausadoNoRodizio: false,
  exibirNaVitrine: true,
  turmaViverMais: '24A',
  ...mudancas,
});

describe('turma encerrada no rodízio', () => {
  const posGraduacao = 'Formação e Pós-graduação em Psicodrama';

  it('continua na fila durante os três meses seguintes ao encerramento', () => {
    const turmaEncerrada = { turma: '24A', posGraduacao, encerradaEm: hojeEmBrasilia() };
    expect(desligadoPorTurma(turmaEncerrada)).toBe(false);
    expect(paraPsicologoPerfil(cadastro({ turmaEncerrada })).pausadoNoRodizio).toBe(false);
  });

  it('todo encerramento, inclusive o antigo sem data de saída, sai no fim do prazo padrão', () => {
    const turmaEncerrada = { turma: '24A', posGraduacao, encerradaEm: '2026-09-17' };
    expect(desligadoPorTurma(turmaEncerrada, '2026-12-16')).toBe(false);
    expect(desligadoPorTurma(turmaEncerrada, '2026-12-17')).toBe(true);
    const antiga = { ...turmaEncerrada, encerradaEm: '2020-01-10' };
    expect(paraPsicologoPerfil(cadastro({ turmaEncerrada: antiga })).pausadoNoRodizio).toBe(true);
  });

  it('sem encerramento não afeta ninguém', () => {
    expect(desligadoPorTurma(undefined)).toBe(false);
    expect(paraPsicologoPerfil(cadastro()).pausadoNoRodizio).toBe(false);
  });

  it('não apaga a pausa manual da gestão', () => {
    expect(paraPsicologoPerfil(cadastro({ pausadoNoRodizio: true })).pausadoNoRodizio).toBe(true);
  });

  it('isola duas pós-graduações que usam o mesmo código', () => {
    const cursoEncerrado = 'Formação e Pós-graduação em Psicodrama';
    const [psicodrama, psicanalise] = aplicarTurmasEncerradas([
      cadastro({ id: 'psi-psicodrama', posGraduacaoViverMais: cursoEncerrado }),
      cadastro({
        id: 'psi-psicanalise',
        posGraduacaoViverMais: 'Programa de Estudos e Pós-graduação em Psicanálise',
      }),
    ], [{ turma: '24A', posGraduacao: cursoEncerrado, encerradaEm: '2020-01-10' }]);

    expect(paraPsicologoPerfil(psicodrama).pausadoNoRodizio).toBe(true);
    expect(paraPsicologoPerfil(psicanalise).pausadoNoRodizio).toBe(false);
  });
});

describe('datas da turma', () => {
  it('hoje segue o fuso da clínica', () => {
    expect(hojeEmBrasilia(new Date('2026-09-18T02:00:00.000Z'))).toBe('2026-09-17');
  });

  it('formata sem passar por fuso', () => {
    expect(formatarDataCurta('2026-09-17')).toBe('17/09/2026');
  });
});
