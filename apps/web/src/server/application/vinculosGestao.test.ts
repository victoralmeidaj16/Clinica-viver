import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: vi.fn() }));

import type { CadastroPsicologoRecord } from './persistence';
import { decidirVinculo } from './vinculosGestao';

const AUTOR = { usuarioRef: 'usuario-gestao-teste', nome: 'Gestão Teste' };
const AGORA = new Date('2026-11-24T15:00:00Z');

const cadastro = {
  id: 'cadastro-teste',
  status: 'APROVADO',
  posGraduacaoViverMais: 'Pós-graduação Fictícia A',
  turmaViverMais: '24A',
  segundaPosGraduacao: 'Pós-graduação Fictícia B',
} as CadastroPsicologoRecord;

describe('decidirVinculo', () => {
  it('aprova a segunda pós com validade e registra no histórico', () => {
    const resultado = decidirVinculo(cadastro, { papel: 'SEGUNDA', status: 'APROVADO', validoAte: '2027-06-30' }, AUTOR, AGORA);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.cadastro.vinculosAcademicos?.SEGUNDA).toEqual({
      posGraduacao: 'Pós-graduação Fictícia B', status: 'APROVADO', validoAte: '2027-06-30',
      decididoEm: AGORA.toISOString(), decididoPorUsuarioRef: AUTOR.usuarioRef, decididoPorNome: AUTOR.nome,
    });
    expect(resultado.cadastro.vinculosAcademicos?.historico).toHaveLength(1);
    expect(resultado.cadastro.vinculosAcademicos?.PRINCIPAL).toBeUndefined();
  });

  it('recusar exige motivo', () => {
    expect(decidirVinculo(cadastro, { papel: 'PRINCIPAL', status: 'RECUSADO' }, AUTOR, AGORA).ok).toBe(false);
    const recusado = decidirVinculo(cadastro, { papel: 'PRINCIPAL', status: 'RECUSADO', motivo: 'Matrícula não confirmada' }, AUTOR, AGORA);
    expect(recusado.ok && recusado.cadastro.vinculosAcademicos?.PRINCIPAL?.motivo).toBe('Matrícula não confirmada');
  });

  it('mantém a validade anterior quando não é enviada e apaga com null', () => {
    const comValidade = {
      ...cadastro,
      vinculosAcademicos: { PRINCIPAL: { posGraduacao: 'Pós-graduação Fictícia A', status: 'APROVADO', decididoEm: '2026-01-01T12:00:00Z', validoAte: '2027-01-01' } },
    } as CadastroPsicologoRecord;
    const pendente = decidirVinculo(comValidade, { papel: 'PRINCIPAL', status: 'PENDENTE' }, AUTOR, AGORA);
    expect(pendente.ok && pendente.cadastro.vinculosAcademicos?.PRINCIPAL?.validoAte).toBe('2027-01-01');
    const semValidade = decidirVinculo(comValidade, { papel: 'PRINCIPAL', status: 'APROVADO', validoAte: null }, AUTOR, AGORA);
    expect(semValidade.ok && semValidade.cadastro.vinculosAcademicos?.PRINCIPAL?.validoAte).toBeUndefined();
  });

  it('corrige a turma sem criar decisão nova', () => {
    const resultado = decidirVinculo(cadastro, { papel: 'SEGUNDA', acao: 'TURMA', turma: 'turma 25b' }, AUTOR, AGORA);
    expect(resultado.ok && resultado.cadastro.segundaTurmaViverMais).toBe('25B');
    expect(resultado.ok && resultado.cadastro.vinculosAcademicos?.SEGUNDA).toBeUndefined();
    expect(resultado.ok && resultado.cadastro.vinculosAcademicos?.historico?.[0]).toMatchObject({ papel: 'SEGUNDA', turma: '25B', status: 'APROVADO' });
  });

  it('recusa papel inexistente ou pós que o cadastro não tem', () => {
    expect(decidirVinculo(cadastro, { papel: 'TERCEIRA', status: 'APROVADO' }, AUTOR, AGORA).ok).toBe(false);
    expect(decidirVinculo({ ...cadastro, segundaPosGraduacao: undefined }, { papel: 'SEGUNDA', status: 'APROVADO' }, AUTOR, AGORA).ok).toBe(false);
  });
});
