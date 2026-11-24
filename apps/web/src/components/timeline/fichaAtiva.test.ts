import { describe, expect, it } from 'vitest';
import type { ClinicalTimelineEntry } from '@thats-life/core';
import {
  corpoDoRascunho,
  daFichaAtiva,
  incorporarRegistrosSalvos,
  novoRascunho,
  rascunhoTemConteudo,
} from './fichaAtiva';

/**
 * Especificação final, § 8.04, e homologação: o cabeçalho e a lista pertencem
 * ao mesmo paciente, e o rascunho só pode ser salvo na ficha em que começou.
 */

const entrada = (id: string, patientId: string) => ({ id, patientId } as ClinicalTimelineEntry);

describe('dados amarrados à ficha', () => {
  it('só entrega o que foi carregado para o paciente da ficha ativa', () => {
    const registrosDeA = { patientId: 'paciente-a', valor: [entrada('registro-a', 'paciente-a')] };

    expect(daFichaAtiva(registrosDeA, 'paciente-a')).toEqual([entrada('registro-a', 'paciente-a')]);
    // Trocou para B e a consulta ainda não chegou (ou falhou): nada de A aparece.
    expect(daFichaAtiva(registrosDeA, 'paciente-b')).toBeUndefined();
    expect(daFichaAtiva(null, 'paciente-a')).toBeUndefined();
  });
});

describe('rascunho de prontuário manual', () => {
  it('nasce vazio e preso ao paciente em que foi aberto', () => {
    const rascunho = novoRascunho('paciente-a');
    expect(rascunho.patientId).toBe('paciente-a');
    expect(rascunhoTemConteudo(rascunho)).toBe(false);
    expect(rascunhoTemConteudo(null)).toBe(false);
    expect(rascunhoTemConteudo({ ...rascunho, plano: '   ' })).toBe(false);
    expect(rascunhoTemConteudo({ ...rascunho, subjetivo: 'Relato fictício.' })).toBe(true);
  });

  it('grava no paciente de origem, qualquer que seja a ficha aberta na hora de salvar', () => {
    const rascunho = { ...novoRascunho('paciente-a'), titulo: 'Sessão fictícia', subjetivo: 'Relato fictício.' };

    expect(corpoDoRascunho(rascunho)).toEqual({
      patientId: 'paciente-a',
      title: 'Sessão fictícia',
      subjective: 'Relato fictício.',
      objective: '',
      assessment: '',
      plan: '',
    });
  });
});

describe('registro salvo entra só na lista do próprio paciente', () => {
  it('acrescenta o registro salvo à lista da mesma ficha, sem duplicar', () => {
    const atual = { patientId: 'paciente-a', valor: [entrada('antigo', 'paciente-a'), entrada('salvo', 'paciente-a')] };

    expect(incorporarRegistrosSalvos(atual, 'paciente-a', [entrada('salvo', 'paciente-a')])).toEqual({
      patientId: 'paciente-a',
      valor: [entrada('salvo', 'paciente-a'), entrada('antigo', 'paciente-a')],
    });
  });

  it('não mistura o registro de A na lista de B quando a ficha mudou durante a gravação', () => {
    const listaDeB = { patientId: 'paciente-b', valor: [entrada('registro-b', 'paciente-b')] };

    expect(incorporarRegistrosSalvos(listaDeB, 'paciente-a', [entrada('salvo', 'paciente-a')])).toBe(listaDeB);
    expect(incorporarRegistrosSalvos(null, 'paciente-a', [entrada('salvo', 'paciente-a')])).toBeNull();
  });
});
