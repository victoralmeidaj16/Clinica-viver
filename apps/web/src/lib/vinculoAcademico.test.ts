import { describe, expect, it } from 'vitest';
import type { CursoPos } from '@/components/forms/opcoesPsicologo';
import type { TurmaRegistro } from './turmasCiclo';
import {
  formatosPermitidos,
  lerDecisoesVinculos,
  origemDosServicos,
  permissoesEfetivas,
  situacaoAcademica,
  vinculosDoCadastro,
} from './vinculoAcademico';

const CURSO_A = 'Pós-graduação Fictícia em Clínica A';
const CURSO_B = 'Pós-graduação Fictícia em Avaliação B';

const CATALOGO: CursoPos[] = [
  { nome: CURSO_A, servicos: ['Atendimento Psicológico'], publicos: ['Criança', 'Adolescente'], tempos: [50], duracaoVariavel: false, formatos: [], ativo: true },
  { nome: CURSO_B, servicos: ['Avaliação Psicológica'], publicos: ['Idoso'], tempos: [], duracaoVariavel: true, formatos: ['ONLINE'], ativo: true },
];

const PRAZO = { quantidade: 3, unidade: 'MESES' } as const;
const HOJE = '2026-11-24';

function turma(posGraduacao: string, codigo: string, extra: Partial<TurmaRegistro> = {}): TurmaRegistro {
  return { id: `t-${codigo}`, posGraduacao, codigo, historico: [], ...extra };
}

const cadastro = {
  status: 'APROVADO',
  posGraduacaoViverMais: CURSO_A,
  turmaViverMais: '24a',
  segundaPosGraduacao: CURSO_B,
  segundaTurmaViverMais: '25B',
};

describe('vinculosDoCadastro', () => {
  it('sem decisão gravada, cada pós segue a situação do cadastro', () => {
    const vinculos = vinculosDoCadastro(cadastro);
    expect(vinculos.map((v) => [v.papel, v.posGraduacao, v.turma, v.status])).toEqual([
      ['PRINCIPAL', CURSO_A, '24A', 'APROVADO'],
      ['SEGUNDA', CURSO_B, '25B', 'APROVADO'],
    ]);
  });

  it('uma decisão sobre outra pós não vale depois da troca do curso', () => {
    const vinculos = vinculosDoCadastro({
      ...cadastro,
      vinculosAcademicos: { SEGUNDA: { posGraduacao: 'Curso anterior', status: 'RECUSADO', decididoEm: '2026-10-01T12:00:00Z' } },
    });
    expect(vinculos[1].status).toBe('APROVADO');
    expect(vinculos[1].decisao).toBeUndefined();
  });

  it('lê as decisões gravadas como texto JSON e ignora o que não tem forma', () => {
    const lidas = lerDecisoesVinculos(JSON.stringify({
      PRINCIPAL: { posGraduacao: CURSO_A, status: 'PENDENTE', decididoEm: '2026-11-01T12:00:00Z', validoAte: 'amanhã' },
      SEGUNDA: { posGraduacao: CURSO_B, status: 'OUTRO', decididoEm: '2026-11-01T12:00:00Z' },
    }));
    expect(lidas?.PRINCIPAL).toEqual({ posGraduacao: CURSO_A, status: 'PENDENTE', decididoEm: '2026-11-01T12:00:00Z' });
    expect(lidas?.SEGUNDA).toBeUndefined();
    expect(lerDecisoesVinculos('não é json')).toBeUndefined();
  });
});

describe('situacaoAcademica', () => {
  it('turma em prazo de saída mantém o vínculo válido e alimenta a contagem', () => {
    const situacao = situacaoAcademica(cadastro, [turma(CURSO_A, '24A', { encerradaEm: '2026-09-10' })], PRAZO, HOJE);
    expect(situacao.desligado).toBe(false);
    expect(situacao.cursosValidos).toEqual([CURSO_A, CURSO_B]);
    expect(situacao.emSaida).toMatchObject({ papel: 'PRINCIPAL', saidaEm: '2026-12-10', diasRestantes: 16 });
  });

  it('depois da saída, continua visível pela outra pós aprovada e válida', () => {
    const situacao = situacaoAcademica(cadastro, [turma(CURSO_A, '24A', { encerradaEm: '2026-06-01' })], PRAZO, HOJE);
    expect(situacao.vinculos[0]).toMatchObject({ valido: false, motivoInvalido: 'TURMA_ENCERRADA', situacaoTurma: 'DESLIGADA' });
    expect(situacao.desligado).toBe(false);
    expect(situacao.cursosValidos).toEqual([CURSO_B]);
  });

  it('sai da vitrine quando nenhuma pós aprovada continua válida', () => {
    const situacao = situacaoAcademica(
      { ...cadastro, vinculosAcademicos: { SEGUNDA: { posGraduacao: CURSO_B, status: 'APROVADO', decididoEm: '2026-01-01T12:00:00Z', validoAte: '2026-11-01' } } },
      [turma(CURSO_A, '24A', { encerradaEm: '2026-06-01' })],
      PRAZO,
      HOJE
    );
    expect(situacao.vinculos[1].motivoInvalido).toBe('VALIDADE_VENCIDA');
    expect(situacao.desligado).toBe(true);
    expect(situacao.cursosValidos).toEqual([]);
  });

  it('cadastro aprovado com os dois vínculos recusados sai da vitrine', () => {
    const decisao = (posGraduacao: string) => ({ posGraduacao, status: 'RECUSADO' as const, decididoEm: '2026-11-20T12:00:00Z', motivo: 'Teste' });
    const situacao = situacaoAcademica(
      { ...cadastro, vinculosAcademicos: { PRINCIPAL: decisao(CURSO_A), SEGUNDA: decisao(CURSO_B) } },
      [],
      PRAZO,
      HOJE
    );
    expect(situacao.desligado).toBe(true);
  });

  it('cadastro em análise não conta como desligado, só como não aprovado', () => {
    const situacao = situacaoAcademica({ ...cadastro, status: 'EM_ANALISE' }, [], PRAZO, HOJE);
    expect(situacao.desligado).toBe(false);
    expect(situacao.vinculos.every((v) => v.motivoInvalido === 'NAO_APROVADO')).toBe(true);
  });

  it('segunda pós pendente não libera serviço novo', () => {
    const situacao = situacaoAcademica(
      { ...cadastro, vinculosAcademicos: { SEGUNDA: { posGraduacao: CURSO_B, status: 'PENDENTE', decididoEm: '2026-11-20T12:00:00Z' } } },
      [],
      PRAZO,
      HOJE
    );
    const permissoes = permissoesEfetivas(situacao, CATALOGO);
    expect(permissoes?.servicos).toEqual(['Atendimento Psicológico']);
    expect(permissoes?.tempos).toEqual([50]);
    expect(origemDosServicos(['Atendimento Psicológico', 'Avaliação Psicológica'], situacao, CATALOGO)).toEqual({
      'Atendimento Psicológico': [CURSO_A],
      'Avaliação Psicológica': [],
    });
  });
});

describe('encerramento importado da tabela antiga', () => {
  it('sem data de saída manual, ganha o prazo contado do encerramento', () => {
    const situacao = situacaoAcademica(cadastro, [turma(CURSO_A, '24A', { encerradaEm: '2026-10-05' })], PRAZO, HOJE);
    expect(situacao.vinculos[0]).toMatchObject({ situacaoTurma: 'EM_SAIDA', saidaEm: '2027-01-05', valido: true });
  });
});

describe('formatosPermitidos', () => {
  it('um curso sem restrição libera os dois formatos', () => {
    expect(formatosPermitidos([CURSO_A, CURSO_B], CATALOGO)).toEqual([]);
  });

  it('só o curso restrito vale quando é o único válido', () => {
    expect(formatosPermitidos([CURSO_B], CATALOGO)).toEqual(['ONLINE']);
  });
});
