import { describe, expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord, SolicitacaoAlteracaoGestao } from './persistence';
import { montarLista, notificacoesDaGestao } from './notificacoes';

vi.mock('server-only', () => ({}));

const agora = new Date('2026-11-05T12:00:00Z');
const pedido: SolicitacaoAlteracaoGestao = {
  status: 'PENDENTE', solicitadoEm: '2026-11-05T11:00:00Z',
  posGraduacaoViverMais: 'Pós-graduação em Avaliação Psicológica', servicosPrestados: ['Avaliação Psicológica'],
};

function avisos(solicitacao: SolicitacaoAlteracaoGestao | null = pedido, status: CadastroPsicologoRecord['status'] = 'APROVADO') {
  return notificacoesDaGestao({ triagensPacientes: [], cadastrosPsicologos: [{
    id: 'psi-ficticio', nomeCompleto: 'Profissional fictício', crp: '00/00000', whatsapp: '',
    status, criadoEm: '2026-09-01T12:00:00Z', turnosDisponiveis: ['MANHA'], modalidadesAtendidas: ['PARTICULAR'],
    solicitacaoAlteracaoGestao: solicitacao ?? undefined,
  }] }, agora).filter((item) => item.tipo === 'solicitacao-perfil-pendente');
}

describe('solicitação de alteração no sino da gestão', () => {
  it('mostra pedidos existentes sem depender do histórico de edições do perfil', () => {
    const itens = avisos();
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ ocorridoEm: pedido.solicitadoEm, pendente: true, severidade: 'ATENCAO',
      href: '/gestao/psicologos?foco=psicologo-psi-ficticio' });
    expect(itens[0].descricao).toContain('Profissional fictício');
    const lista = montarLista(itens, new Set(['perfil-alterado:psi-ficticio:2026-11-05T11:00:00Z']), agora);
    expect(lista.naoLidas).toBe(1);
    expect(montarLista(itens, new Set([itens[0].chave]), agora).naoLidas).toBe(0);
  });

  it('mantém pedidos pendentes há mais de 30 dias no sino', () => {
    const lista = montarLista(avisos({ ...pedido, solicitadoEm: '2026-09-01T12:00:00Z' }), new Set(), agora);
    expect(lista.itens).toHaveLength(1);
    expect(lista.naoLidas).toBe(1);
  });

  it('um pedido substituto aparece como não lido mesmo se o anterior foi lido', () => {
    const anterior = avisos();
    const novo = avisos({ ...pedido, solicitadoEm: '2026-11-05T11:30:00Z' });
    expect(montarLista(novo, new Set([anterior[0].chave]), agora).naoLidas).toBe(1);
  });

  it.each(['APROVADO', 'RECUSADO'] as const)('remove a pendência após a decisão %s', (status) => {
    expect(avisos({ ...pedido, status })).toEqual([]);
  });

  it('remove a pendência após cancelamento', () => {
    expect(avisos(null)).toEqual([]);
  });

  it('mostra o pedido mesmo quando o credenciamento ainda está em análise', () => {
    expect(avisos(pedido, 'EM_ANALISE')).toHaveLength(1);
  });
});
