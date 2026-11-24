import { describe, expect, it } from 'vitest';
import { CATALOGO_CURSOS_PADRAO, opcoesAtendimentoDaPos } from '@/components/forms/opcoesPsicologo';
import { catalogoEfetivo, comCursoAjustado, cursosAlterados, validarCurso } from './catalogoCursos';

const PRIMEIRO = CATALOGO_CURSOS_PADRAO[0];

const cursoNovo = {
  nome: 'Pós-graduação Fictícia em Teste',
  servicos: ['Atendimento Psicológico', 'Serviço inventado'],
  publicos: ['Criança'],
  tempos: [50, 75],
  formatos: ['ONLINE', 'HIBRIDO'],
};

describe('catalogoEfetivo', () => {
  it('sem ajustes, é o catálogo padrão com as permissões de antes', () => {
    const catalogo = catalogoEfetivo(undefined);
    expect(catalogo).toEqual(CATALOGO_CURSOS_PADRAO);
    expect(opcoesAtendimentoDaPos(PRIMEIRO.nome, undefined, catalogo)).toEqual(opcoesAtendimentoDaPos(PRIMEIRO.nome));
  });

  it('o ajuste de um curso substitui só ele; curso novo entra no fim', () => {
    const ajustado = { ...PRIMEIRO, publicos: ['Idoso'], formatos: ['PRESENCIAL'] };
    const catalogo = catalogoEfetivo([ajustado, { ...cursoNovo, servicos: ['Atendimento Psicológico'], tempos: [50], formatos: [] }]);
    expect(catalogo[0].publicos).toEqual(['Idoso']);
    expect(catalogo[1]).toEqual(CATALOGO_CURSOS_PADRAO[1]);
    expect(catalogo.at(-1)?.nome).toBe(cursoNovo.nome);
    expect(catalogo).toHaveLength(CATALOGO_CURSOS_PADRAO.length + 1);
  });
});

describe('validarCurso', () => {
  it('filtra o que não está no vocabulário', () => {
    const resultado = validarCurso(cursoNovo, CATALOGO_CURSOS_PADRAO);
    expect(resultado).toEqual({
      ok: true,
      curso: {
        nome: cursoNovo.nome,
        servicos: ['Atendimento Psicológico'],
        publicos: ['Criança'],
        tempos: [50],
        duracaoVariavel: false,
        formatos: ['ONLINE'],
        ativo: true,
      },
    });
  });

  it('não cria curso com nome repetido, ignorando maiúsculas', () => {
    const resultado = validarCurso({ ...cursoNovo, nome: PRIMEIRO.nome.toUpperCase() }, CATALOGO_CURSOS_PADRAO);
    expect(resultado.ok).toBe(false);
  });

  it('na edição, o nome não muda', () => {
    const resultado = validarCurso({ ...cursoNovo, nome: 'Outro nome qualquer' }, CATALOGO_CURSOS_PADRAO, PRIMEIRO);
    expect(resultado.ok && resultado.curso.nome).toBe(PRIMEIRO.nome);
  });

  it('exige modalidade, público e duração (ou duração variável)', () => {
    expect(validarCurso({ ...cursoNovo, servicos: [] }, []).ok).toBe(false);
    expect(validarCurso({ ...cursoNovo, publicos: ['Ninguém'] }, []).ok).toBe(false);
    expect(validarCurso({ ...cursoNovo, tempos: [] }, []).ok).toBe(false);
    const variavel = validarCurso({ ...cursoNovo, tempos: [50], duracaoVariavel: true }, []);
    expect(variavel.ok && variavel.curso.tempos).toEqual([]);
  });

  it('desativar mantém o curso no catálogo, fora do cadastro novo', () => {
    const resultado = validarCurso({ ...cursoNovo, ativo: false }, []);
    expect(resultado.ok && resultado.curso.ativo).toBe(false);
  });
});

describe('ajustes gravados', () => {
  it('substitui o ajuste do mesmo nome e aponta o que mudou', () => {
    const antes = [{ ...PRIMEIRO, publicos: ['Idoso'] }];
    const depois = comCursoAjustado(antes, { ...PRIMEIRO, publicos: ['Casais'] });
    expect(depois).toHaveLength(1);
    expect(depois[0].publicos).toEqual(['Casais']);
    expect(cursosAlterados(antes, depois)).toEqual([PRIMEIRO.nome]);
    expect(cursosAlterados(depois, depois)).toEqual([]);
  });
});
