import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord } from './persistence';
import { paraPsicologoPerfil } from './viverMaisRodizio';
import { desligadoPorTurma, formatarDataCurta, hojeEmBrasilia } from '@/lib/turmaEncerrada';

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
  it('sai da fila assim que a turma é encerrada', () => {
    const turmaEncerrada = { turma: '24A', encerradaEm: '2026-09-17' };
    expect(desligadoPorTurma(turmaEncerrada)).toBe(true);
    expect(paraPsicologoPerfil(cadastro({ turmaEncerrada })).pausadoNoRodizio).toBe(true);
  });

  it('sem encerramento não afeta ninguém', () => {
    expect(desligadoPorTurma(undefined)).toBe(false);
    expect(paraPsicologoPerfil(cadastro()).pausadoNoRodizio).toBe(false);
  });

  it('não apaga a pausa manual da gestão', () => {
    expect(paraPsicologoPerfil(cadastro({ pausadoNoRodizio: true })).pausadoNoRodizio).toBe(true);
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
