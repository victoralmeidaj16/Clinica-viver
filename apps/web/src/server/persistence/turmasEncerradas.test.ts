import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({
  getMysqlPool: vi.fn(),
  isMysqlConfigured: () => false,
}));

import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import type { TurmaEncerrada } from '@/lib/turmaEncerrada';
import {
  aplicarTurmasEncerradas,
  comTurmasEncerradas,
  getTurmasEncerradasRepository,
  type TurmasEncerradasRepository,
} from './turmasEncerradas';

const cursoPsicodrama = 'Formação e Pós-graduação em Psicodrama';
const cursoPsicanalise = 'Programa de Estudos e Pós-graduação em Psicanálise';

function cadastro(overrides: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord {
  return {
    id: crypto.randomUUID(),
    nomeCompleto: 'Psicólogo de teste',
    crp: '00/00000',
    whatsapp: '11999999999',
    status: 'APROVADO',
    criadoEm: '2026-01-01T12:00:00.000Z',
    turmaViverMais: '25A',
    posGraduacaoViverMais: cursoPsicodrama,
    ...overrides,
  };
}

describe('aplicação dos encerramentos compostos', () => {
  it('encerra somente o curso e código correspondentes', () => {
    const psicodrama = cadastro();
    const psicanalise = cadastro({ posGraduacaoViverMais: cursoPsicanalise });
    const encerradas: TurmaEncerrada[] = [{
      turma: '25A', posGraduacao: cursoPsicodrama, encerradaEm: '2026-10-06',
    }];

    const resultado = aplicarTurmasEncerradas([psicodrama, psicanalise], encerradas);

    expect(resultado[0].turmaEncerrada?.posGraduacao).toBe(cursoPsicodrama);
    expect(resultado[1].turmaEncerrada).toBeUndefined();
  });

  it('normaliza espaços e o código ao comparar', () => {
    const [resultado] = aplicarTurmasEncerradas(
      [cadastro({ turmaViverMais: '25a ', posGraduacaoViverMais: ` ${cursoPsicodrama} ` })],
      [{ turma: '25A', posGraduacao: cursoPsicodrama, encerradaEm: '2026-10-06' }]
    );

    expect(resultado.turmaEncerrada).toBeDefined();
  });

  it('degrada para os cadastros originais quando o repositório falha', async () => {
    const original = cadastro();
    const repositorio = {
      migrarLegadas: vi.fn().mockRejectedValue(new Error('indisponível')),
      listar: vi.fn(), encerrar: vi.fn(), reabrir: vi.fn(),
    } satisfies TurmasEncerradasRepository;

    const resultado = await comTurmasEncerradas([original], undefined, repositorio);

    expect(resultado).toEqual([original]);
    expect(repositorio.listar).not.toHaveBeenCalled();
  });
});

describe('migração do arquivo legado', () => {
  let diretorio: string;
  let caminhoEstado: string;
  let caminhoTurmas: string;
  const demoStateAnterior = process.env.DEMO_STATE_FILE;

  beforeEach(async () => {
    diretorio = await mkdtemp(join(tmpdir(), 'turmas-encerradas-'));
    caminhoEstado = join(diretorio, 'snapshot.json');
    caminhoTurmas = join(diretorio, 'turmas-encerradas.json');
    process.env.DEMO_STATE_FILE = caminhoEstado;
  });

  afterEach(async () => {
    if (demoStateAnterior === undefined) delete process.env.DEMO_STATE_FILE;
    else process.env.DEMO_STATE_FILE = demoStateAnterior;
    await rm(diretorio, { recursive: true, force: true });
  });

  it('expande um código antigo para os cursos aprovados e grava v2', async () => {
    await writeFile(caminhoTurmas, JSON.stringify({
      '25A': { encerradaEm: '2026-09-17', encerradaPor: 'admin-1' },
    }));
    const repositorio = getTurmasEncerradasRepository();

    await repositorio.migrarLegadas([
      cadastro(),
      cadastro({ posGraduacaoViverMais: cursoPsicanalise }),
      cadastro({ posGraduacaoViverMais: 'Curso recusado', status: 'RECUSADO' }),
    ]);

    const arquivo = JSON.parse(await readFile(caminhoTurmas, 'utf8')) as {
      versao: number;
      turmas: Array<{ turma: string; posGraduacao: string; encerradaPor?: string }>;
    };
    expect(arquivo).toMatchObject({ versao: 2 });
    expect(arquivo.turmas).toHaveLength(2);
    expect(arquivo.turmas.every((item) => item.turma === '25A')).toBe(true);
    expect(arquivo.turmas.map((item) => item.posGraduacao).sort()).toEqual(
      [cursoPsicanalise, cursoPsicodrama].sort()
    );
    expect(arquivo.turmas.every((item) => item.encerradaPor === 'admin-1')).toBe(true);
  });

  it('descarta encerramento antigo sem combinação aprovada', async () => {
    await writeFile(caminhoTurmas, JSON.stringify({
      '26B': { encerradaEm: '2026-09-17' },
    }));
    const repositorio = getTurmasEncerradasRepository();

    await repositorio.migrarLegadas([cadastro({ turmaViverMais: '26B', status: 'RECUSADO' })]);

    expect(await repositorio.listar()).toEqual([]);
  });

  it('não reexpande arquivo que já está no formato v2', async () => {
    const encerrada = {
      turma: '25A', posGraduacao: cursoPsicodrama, encerradaEm: '2026-09-17',
    };
    await writeFile(caminhoTurmas, JSON.stringify({ versao: 2, turmas: [encerrada] }));
    const repositorio = getTurmasEncerradasRepository();

    await repositorio.migrarLegadas([
      cadastro(), cadastro({ posGraduacaoViverMais: cursoPsicanalise }),
    ]);

    expect(await repositorio.listar()).toEqual([encerrada]);
  });
});
