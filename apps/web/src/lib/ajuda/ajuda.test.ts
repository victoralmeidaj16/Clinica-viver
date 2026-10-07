import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ETAPAS } from './etapas';
import { BUSSOLA } from './consulta';
import { partesTexto } from './textoRico';

const publico = path.resolve(__dirname, '../../../public');

describe('partesTexto', () => {
  it('separa negrito e itálico do texto comum', () => {
    expect(partesTexto('Clique em **Salvar** e veja *a prévia*.')).toEqual([
      { texto: 'Clique em ' },
      { texto: 'Salvar', estilo: 'negrito' },
      { texto: ' e veja ' },
      { texto: 'a prévia', estilo: 'italico' },
      { texto: '.' },
    ]);
  });

  it('mantém um asterisco solto como texto', () => {
    expect(partesTexto('Campos com * são obrigatórios. O campo *Observações* é administrativo.')).toEqual([
      { texto: 'Campos com * são obrigatórios. O campo ' },
      { texto: 'Observações', estilo: 'italico' },
      { texto: ' é administrativo.' },
    ]);
  });

  it('devolve o texto inteiro quando não há marcação', () => {
    expect(partesTexto('Sem marcação')).toEqual([{ texto: 'Sem marcação' }]);
  });
});

describe('conteúdo da Ajuda', () => {
  it('numera as etapas em sequência, com âncoras únicas', () => {
    expect(ETAPAS.map((etapa) => etapa.numero)).toEqual(ETAPAS.map((_, i) => i + 1));
    expect(new Set(ETAPAS.map((etapa) => etapa.id)).size).toBe(ETAPAS.length);
  });

  it('só cita prints que estão publicados', () => {
    const imagens = ETAPAS.flatMap((etapa) => etapa.blocos.flatMap((bloco) => bloco.imagens ?? []));
    for (const imagem of imagens) expect(existsSync(path.join(publico, imagem.src)), imagem.src).toBe(true);
    expect(existsSync(path.join(publico, 'ajuda/manual-pratico-psicologo.pdf'))).toBe(true);
  });

  it('aponta cada atalho da bússola para uma etapa existente', () => {
    const ids = new Set(ETAPAS.map((etapa) => etapa.id));
    for (const atalho of BUSSOLA) if (atalho.etapa) expect(ids.has(atalho.etapa), atalho.situacao).toBe(true);
  });
});
