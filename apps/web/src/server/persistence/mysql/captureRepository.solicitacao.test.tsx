import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord, SolicitacaoAlteracaoGestao } from '@/server/application/persistence';
import { BannerSolicitacaoAlteracaoGestao } from '@/components/gestao/BannerSolicitacaoAlteracaoGestao';
import type { PsicologoItem } from '@/components/gestao/types';
import { MysqlCaptureRepository } from './captureRepository';

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/persistence', () => ({ readSnapshot: () => null }));
vi.mock('@/server/persistence/turmasEncerradas', () => ({
  comTurmasEncerradas: async (cadastros: CadastroPsicologoRecord[]) => cadastros,
}));

function banco(solicitacao: SolicitacaoAlteracaoGestao | null) {
  const row: Record<string, unknown> = {
    ref_core: 'psi-ficticio', nome_completo: 'Profissional fictício', crp: '00/00000',
    whatsapp: '', status: 'APROVADO', criado_em: '2026-10-28 12:00:00.000',
    solicitacao_alteracao_gestao: solicitacao ? JSON.stringify(solicitacao) : null,
  };
  const connection = {
    query: vi.fn(async (sql: string) => {
      if (!sql.includes('FROM clinica_cadastros_psicologos')) return [[]];
      // Devolve somente as colunas selecionadas, como o driver MySQL.
      const columns = sql.slice(sql.indexOf('SELECT') + 6, sql.indexOf('FROM')).split(',');
      return [[Object.fromEntries(columns.map((column) => [column.trim(), row[column.trim()]]))]];
    }),
    execute: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO clinica_cadastros_psicologos')) {
        const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',');
        columns.forEach((column, index) => { row[column.trim()] = params[index]; });
      }
      return [{}];
    }),
    beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
  };
  return { ...connection, getConnection: async () => connection };
}

const solicitacao: SolicitacaoAlteracaoGestao = {
  status: 'PENDENTE', solicitadoEm: '2026-10-28T12:00:00.000Z',
  servicosPrestados: ['Orientação Parental'], justificativa: 'Nova habilitação fictícia.',
};

describe('solicitação de ajuste de perfil persistida', () => {
  it('carrega a pendência com os detalhes e as ações de aprovação na gestão', async () => {
    const repository = new MysqlCaptureRepository(banco(solicitacao) as never);
    const { cadastrosPsicologos } = await repository.read();
    const cadastro = cadastrosPsicologos[0];
    expect(cadastro.solicitacaoAlteracaoGestao).toEqual(solicitacao);
    const perfil: PsicologoItem = JSON.parse(JSON.stringify(cadastro));
    const html = renderToStaticMarkup(<BannerSolicitacaoAlteracaoGestao
      psicologo={perfil} trabalhando={false}
      onAprovar={() => {}} onRecusar={() => {}} onEditar={() => {}}
    />);
    expect(html).toContain('Orientação Parental');
    expect(html).toContain('Nova habilitação fictícia.');
    expect(html).toContain('Aprovar Alteração');
    expect(html).toContain('Recusar');
  });

  it.each(['PENDENTE', 'APROVADO', 'RECUSADO'] as const)(
    'preserva a solicitação %s ao editar outro campo e recarregar', async (status) => {
      const pedido = { ...solicitacao, status };
      const repository = new MysqlCaptureRepository(banco(pedido) as never);
      await repository.mutate((state) => ({
        next: { ...state, cadastrosPsicologos: state.cadastrosPsicologos.map((cadastro) => ({
          ...cadastro, minibio: 'Apresentação fictícia atualizada.',
        })) },
        result: null,
      }));
      const { cadastrosPsicologos } = await repository.read();
      expect(cadastrosPsicologos[0].solicitacaoAlteracaoGestao).toEqual(pedido);
      expect(cadastrosPsicologos[0].minibio).toBe('Apresentação fictícia atualizada.');
    },
  );
});
