import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: vi.fn() }));
vi.mock('@/server/persistence/turmasRepository', () => ({ getTurmasRepository: vi.fn(), novoIdDeTurma: () => 'id-gerado' }));
vi.mock('./catalogoCursos', () => ({ obterCatalogoCursos: vi.fn() }));
vi.mock('./configuracaoGestao', () => ({ gravarConfiguracaoGestao: vi.fn(), lerConfiguracaoGestao: vi.fn() }));

import type { CursoPos } from '@/components/forms/opcoesPsicologo';
import type { TurmaRegistro } from '@/lib/turmasCiclo';
import { aplicarAcaoTurma } from './turmasGestao';

const CURSO = 'Pós-graduação Fictícia em Clínica';
const CATALOGO: CursoPos[] = [
  { nome: CURSO, servicos: ['Atendimento Psicológico'], publicos: ['Criança'], tempos: [50], duracaoVariavel: false, formatos: [], ativo: true },
];
const AUTOR = { usuarioRef: 'usuario-gestao-teste', nome: 'Gestão Teste' };
const AGORA = new Date('2026-11-24T15:00:00Z');

const aberta: TurmaRegistro = { id: 't1', posGraduacao: CURSO, codigo: '26A', historico: [] };
const encerrada: TurmaRegistro = { ...aberta, encerradaEm: '2026-11-01' };

const aplicar = (turmas: TurmaRegistro[], corpo: Record<string, unknown>) =>
  aplicarAcaoTurma(turmas, corpo, AUTOR, CATALOGO, AGORA, () => 'novo-id');

describe('aplicarAcaoTurma', () => {
  it('cria turma de curso do catálogo e registra quem criou', () => {
    const resultado = aplicar([], { acao: 'CRIAR', posGraduacao: CURSO, codigo: 'turma 26b', dataInicio: '2026-02-01' });
    expect(resultado).toEqual({
      ok: true,
      turma: {
        id: 'novo-id', posGraduacao: CURSO, codigo: '26B', dataInicio: '2026-02-01',
        historico: [{ acao: 'CRIADA', em: AGORA.toISOString(), porUsuarioRef: AUTOR.usuarioRef, porNome: AUTOR.nome }],
      },
    });
  });

  it('recusa curso fora do catálogo, turma repetida e datas invertidas', () => {
    expect(aplicar([], { acao: 'CRIAR', posGraduacao: 'Curso inexistente', codigo: '26A' }).ok).toBe(false);
    expect(aplicar([aberta], { acao: 'CRIAR', posGraduacao: CURSO, codigo: '26a' })).toMatchObject({ ok: false, status: 409 });
    expect(aplicar([], { acao: 'CRIAR', posGraduacao: CURSO, codigo: '26C', dataInicio: '2026-05-01', dataEncerramentoPrevista: '2026-01-01' }).ok).toBe(false);
  });

  it('encerra com a data de hoje em Brasília quando não informada', () => {
    const resultado = aplicar([aberta], { acao: 'ENCERRAR', id: 't1' });
    expect(resultado.ok && resultado.turma.encerradaEm).toBe('2026-11-24');
    expect(aplicar([encerrada], { acao: 'ENCERRAR', id: 't1' })).toMatchObject({ ok: false, status: 409 });
  });

  it('prorrogar ou antecipar a saída exige motivo e não pode ser antes do encerramento', () => {
    expect(aplicar([encerrada], { acao: 'ALTERAR_SAIDA', id: 't1', saidaEm: '2027-03-01' }).ok).toBe(false);
    expect(aplicar([encerrada], { acao: 'ALTERAR_SAIDA', id: 't1', saidaEm: '2026-10-01', motivo: 'teste' }).ok).toBe(false);
    const prorrogada = aplicar([encerrada], { acao: 'ALTERAR_SAIDA', id: 't1', saidaEm: '2027-03-01', motivo: 'Defesa adiada' });
    expect(prorrogada.ok && prorrogada.turma.saidaManual).toBe('2027-03-01');
    expect(prorrogada.ok && prorrogada.turma.historico.at(-1)?.detalhe).toBe('Saída em 2027-03-01: Defesa adiada');
    const padrao = aplicar([{ ...encerrada, saidaManual: '2027-03-01' }], { acao: 'ALTERAR_SAIDA', id: 't1', saidaEm: null, motivo: 'Volta ao prazo' });
    expect(padrao.ok && padrao.turma.saidaManual).toBeUndefined();
  });

  it('interromper e retomar a retirada ficam no histórico', () => {
    expect(aplicar([encerrada], { acao: 'INTERROMPER_RETIRADA', id: 't1' }).ok).toBe(false);
    const interrompida = aplicar([encerrada], { acao: 'INTERROMPER_RETIRADA', id: 't1', motivo: 'Aguardando decisão' });
    expect(interrompida.ok && interrompida.turma.retiradaInterrompida).toBe(true);
    if (!interrompida.ok) return;
    const retomada = aplicar([interrompida.turma], { acao: 'RETOMAR_RETIRADA', id: 't1' });
    expect(retomada.ok && retomada.turma.retiradaInterrompida).toBeUndefined();
    expect(retomada.ok && retomada.turma.historico.map((evento) => evento.acao)).toEqual(['RETIRADA_INTERROMPIDA', 'RETIRADA_RETOMADA']);
  });

  it('reabrir limpa encerramento, saída manual e interrupção', () => {
    const resultado = aplicar([{ ...encerrada, saidaManual: '2027-01-01', retiradaInterrompida: true }], { acao: 'REABRIR', id: 't1' });
    expect(resultado.ok && resultado.turma).toMatchObject({ encerradaEm: undefined, saidaManual: undefined, retiradaInterrompida: undefined });
  });

  it('turma desconhecida devolve 404', () => {
    expect(aplicar([], { acao: 'ENCERRAR', id: 'nao-existe' })).toMatchObject({ ok: false, status: 404 });
  });
});
