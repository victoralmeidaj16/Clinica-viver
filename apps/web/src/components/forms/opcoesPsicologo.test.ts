import { describe, expect, it } from 'vitest';
import { opcoesAtendimentoDaPos } from './opcoesPsicologo';

describe('opcoesAtendimentoDaPos', () => {
  it('oferece a lista ampla para Psicologia Perinatal e Parentalidade', () => {
    expect(opcoesAtendimentoDaPos('Pós-graduação em Psicologia Perinatal e Parentalidade')?.servicos)
      .toEqual([
        'Atendimento Psicológico',
        'Orientação Vocacional e Profissional',
        'Orientação Parental',
        'Orientação Vocacional',
        'Orientação Profissional',
      ]);
  });

  it('restringe Casal e Família às modalidades definidas pela coordenação', () => {
    expect(opcoesAtendimentoDaPos('Pós-graduação em Psicoterapia de Casal e Família')?.servicos)
      .toEqual([
        'Atendimento Psicológico',
        'Orientação Parental',
        'Orientação Vocacional e Profissional',
      ]);
  });

  it('mantém a lista ampla quando Perinatal é a segunda pós', () => {
    expect(opcoesAtendimentoDaPos('Pós-graduação em Psicoterapia de Casal e Família', 'Pós-graduação em Psicologia Perinatal e Parentalidade')?.servicos)
      .toContain('Orientação Profissional');
  });
});
