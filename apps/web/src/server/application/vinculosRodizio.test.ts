import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { AvisoSaidaTurma, CadastroPsicologoRecord } from './persistence';
import { notificacoesDaGestao, notificacoesDoPsicologo } from './notificacoes';
import { paraPsicologoPerfil, publicoEfetivo, servicosEfetivos } from './viverMaisRodizio';

const cadastro = (mudancas: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord => ({
  id: 'psi-teste',
  nomeCompleto: 'Cadastro de teste',
  crp: '00/00000',
  whatsapp: '00000000000',
  status: 'APROVADO',
  criadoEm: '2026-01-01T12:00:00.000Z',
  pausadoNoRodizio: false,
  exibirNaVitrine: true,
  servicosHabilitados: ['PSICOTERAPIA', 'AVALIACAO'],
  publicoAlvo: ['Criança', 'Idoso', 'Adulto'],
  ...mudancas,
});

const soPsicoterapia = { tempos: [50], servicos: ['Atendimento Psicológico'], publico: ['Criança'] };

describe('permissões efetivas no rodízio', () => {
  it('sem situação acadêmica calculada, vale o que foi homologado', () => {
    expect(servicosEfetivos(cadastro())).toEqual(['PSICOTERAPIA', 'AVALIACAO']);
    expect(publicoEfetivo(cadastro())).toEqual(['Criança', 'Idoso', 'Adulto']);
  });

  it('limita serviços e públicos ao que os vínculos válidos permitem, sem apagar valores antigos', () => {
    const record = cadastro({ permissoesEfetivas: soPsicoterapia });
    expect(servicosEfetivos(record)).toEqual(['PSICOTERAPIA']);
    // "Adulto" não está no vocabulário atual: fica, para não sumir com cadastros antigos.
    expect(publicoEfetivo(record)).toEqual(['Criança', 'Adulto']);
    expect(record.servicosHabilitados).toEqual(['PSICOTERAPIA', 'AVALIACAO']);
  });

  it('formato único permitido estreita "ambos" e pausa quem só atende no outro', () => {
    expect(paraPsicologoPerfil(cadastro({ formatosPermitidos: ['ONLINE'], modalidadeAtendimento: 'AMBOS' })).pausadoNoRodizio).toBe(false);
    expect(paraPsicologoPerfil(cadastro({ formatosPermitidos: ['ONLINE'], modalidadeAtendimento: 'PRESENCIAL' })).pausadoNoRodizio).toBe(true);
  });

  it('sai do rodízio quando nenhum vínculo continua válido', () => {
    const situacaoAcademica = { vinculos: [], desligado: true, cursosValidos: [] };
    expect(paraPsicologoPerfil(cadastro({ situacaoAcademica })).pausadoNoRodizio).toBe(true);
  });
});

describe('avisos da saída da turma', () => {
  const aviso: AvisoSaidaTurma = {
    turma: '24A', posGraduacao: 'Pós-graduação Fictícia', encerradaEm: '2026-09-10', saidaEm: '2026-12-10',
    diasRestantes: 16, marco: 30, textoPsicologo: 'Texto ao psicólogo.', textoGestao: 'Texto à Gestão.',
  };
  const agora = new Date('2026-11-24T12:00:00Z');

  it('o psicólogo recebe o texto configurado, com chave por marco', () => {
    const record = cadastro({ avisoSaidaTurma: aviso });
    const itens = notificacoesDoPsicologo({ triagensPacientes: [], cadastrosPsicologos: [record] }, record, agora)
      .filter((item) => item.tipo === 'turma-saida');
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ descricao: 'Texto ao psicólogo.', severidade: 'ATENCAO' });
    expect(itens[0].chave).toContain(':30');
  });

  it('a Gestão recebe um aviso por turma com quantos psicólogos dependem dela', () => {
    const itens = notificacoesDaGestao({ triagensPacientes: [], cadastrosPsicologos: [
      cadastro({ id: 'psi-1', nomeCompleto: 'Pessoa Um', avisoSaidaTurma: aviso }),
      cadastro({ id: 'psi-2', nomeCompleto: 'Pessoa Dois', avisoSaidaTurma: { ...aviso, diasRestantes: 5, marco: 7 } }),
      cadastro({ id: 'psi-3', nomeCompleto: 'Pessoa Três', avisoSaidaTurma: aviso }),
    ] }, agora).filter((item) => item.tipo === 'turma-saida');
    expect(itens).toHaveLength(2);
    expect(itens[0].descricao).toContain('Psicólogos afetados: 2');
    expect(itens[0].href).toBe('/gestao/cursos?aba=turmas');
    expect(itens[1].severidade).toBe('CRITICO');
  });
});
