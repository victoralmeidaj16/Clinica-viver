import { describe, expect, it } from 'vitest';
import { aplicarOperacaoDemanda, demandasAtivas, lerCatalogoDemandas, renomearNaLista } from './catalogoDemandas';
import { DEMANDAS_PADRAO } from './demandasPadrao';

const base = [
  { nome: 'Ansiedade', ativo: true, nomesAnteriores: [] },
  { nome: 'Luto', ativo: true, nomesAnteriores: [] },
];

describe('lerCatalogoDemandas', () => {
  it('sem nada gravado, usa a lista padrão inteira e ativa', () => {
    const catalogo = lerCatalogoDemandas(undefined);
    expect(demandasAtivas(catalogo)).toEqual([...DEMANDAS_PADRAO]);
  });
});

describe('aplicarOperacaoDemanda', () => {
  it('adiciona e recusa nome repetido sem acento ou caixa', () => {
    const adicionada = aplicarOperacaoDemanda(base, { acao: 'ADICIONAR', nome: '  Insônia ' });
    expect(adicionada.ok && adicionada.catalogo.at(-1)).toEqual({ nome: 'Insônia', ativo: true, nomesAnteriores: [] });
    expect(aplicarOperacaoDemanda(base, { acao: 'ADICIONAR', nome: 'ANSIEDÁDE' }).ok).toBe(false);
  });

  it('renomeia guardando o nome anterior e informa a troca', () => {
    const resultado = aplicarOperacaoDemanda(base, { acao: 'RENOMEAR', nome: 'Luto', novoNome: 'Luto e perdas' });
    expect(resultado).toMatchObject({ ok: true, renomeada: { de: 'Luto', para: 'Luto e perdas' } });
    expect(resultado.ok && resultado.catalogo[1]).toEqual({ nome: 'Luto e perdas', ativo: true, nomesAnteriores: ['Luto'] });
  });

  it('não renomeia para um nome que já existe', () => {
    expect(aplicarOperacaoDemanda(base, { acao: 'RENOMEAR', nome: 'Luto', novoNome: 'ansiedade' }).ok).toBe(false);
  });

  it('remover desativa e reativar volta; repetir a mesma ação é recusado', () => {
    const removida = aplicarOperacaoDemanda(base, { acao: 'DESATIVAR', nome: 'Luto' });
    expect(removida.ok && demandasAtivas(removida.catalogo)).toEqual(['Ansiedade']);
    if (!removida.ok) return;
    expect(aplicarOperacaoDemanda(removida.catalogo, { acao: 'DESATIVAR', nome: 'Luto' }).ok).toBe(false);
    const reativada = aplicarOperacaoDemanda(removida.catalogo, { acao: 'REATIVAR', nome: 'Luto' });
    expect(reativada.ok && demandasAtivas(reativada.catalogo)).toEqual(['Ansiedade', 'Luto']);
  });
});

describe('renomearNaLista', () => {
  it('troca o nome sem duplicar e devolve a lista igual quando não usa a demanda', () => {
    expect(renomearNaLista(['Luto', 'Luto e perdas', 'Ansiedade'], 'Luto', 'Luto e perdas')).toEqual(['Luto e perdas', 'Ansiedade']);
    expect(renomearNaLista(['Ansiedade'], 'Luto', 'Luto e perdas')).toEqual(['Ansiedade']);
    expect(renomearNaLista(undefined, 'Luto', 'Luto e perdas')).toBeUndefined();
  });
});
