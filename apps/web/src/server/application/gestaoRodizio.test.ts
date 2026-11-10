import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { posicoesDoRodizio } from './gestaoRodizio';
import { paraPsicologoPerfil } from './viverMaisRodizio';
import { selecionarPsicologoRoundRobin } from '@thats-life/core';
import type { CadastroPsicologoRecord } from './persistence';

const agora = new Date('2026-11-10T12:00:00Z');
const cadastro = (id: string, campos: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord => ({
  id, nomeCompleto: 'Profissional fictício', crp: '00/00000', whatsapp: '', status: 'APROVADO',
  criadoEm: '2026-01-01T00:00:00Z', turnosDisponiveis: ['MANHA'], modalidadesAtendidas: ['PARTICULAR'],
  ...campos,
});

describe('posição geral do rodízio na gestão', () => {
  it('segue a mesma ordem do motor sem alterar a ordem da listagem', () => {
    const lista = [cadastro('recente', { ultimoLeadRecebidoEm: '2026-11-09T12:00:00Z' }),
      cadastro('novo'), cadastro('antigo', { ultimoLeadRecebidoEm: '2026-10-01T12:00:00Z' }), cadastro('outro-novo')];
    const posicoes = posicoesDoRodizio(lista, agora);
    expect(lista.map((p) => p.id)).toEqual(['recente', 'novo', 'antigo', 'outro-novo']);
    expect([...posicoes.values()].map((p) => p.posicao)).toEqual([4, 1, 3, 2]);
    let perfis = lista.map((p) => paraPsicologoPerfil(p, agora));
    for (let posicao = 1; posicao <= lista.length; posicao++) {
      const proximo = selecionarPsicologoRoundRobin(perfis, 'MANHA', 'PARTICULAR')!;
      expect(posicoes.get(proximo.id)).toEqual({ posicao, total: 4 });
      perfis = perfis.filter((p) => p.id !== proximo.id);
    }
  });

  it.each([
    [{ status: 'EM_ANALISE' }, 'Aguardando aprovação'],
    [{ status: 'RECUSADO' }, 'Cadastro recusado'],
    [{ pausadoNoRodizio: true }, 'Pausado pela gestão'],
    [{ reconfiguracaoAtendimentoPendente: true }, 'Cadastro de atendimento pendente'],
    [{ pacientesAtivosCount: 5 }, 'Capacidade esgotada'],
    [{ turnosDisponiveis: ['inexistente'] }, 'Sem turno válido cadastrado'],
    [{ modalidadesAtendidas: [] }, 'Sem modalidade válida cadastrada'],
    [{ turmaEncerrada: { turma: '24A', posGraduacao: 'Curso fictício', encerradaEm: '2026-11-01' } }, 'Turma encerrada'],
    [{ ausenciasAgenda: [{ inicio: '2026-11-09T00:00:00Z', fim: '2026-11-11T00:00:00Z', criadoEm: '2026-11-01T00:00:00Z' }] }, 'Ausente na agenda'],
  ] as [Partial<CadastroPsicologoRecord>, string][])('não atribui posição a quem está indisponível: %j', (campos, motivo) => {
    const posicoes = posicoesDoRodizio([cadastro('fora', campos), cadastro('ativo')], agora);
    expect(posicoes.get('fora')).toEqual({ posicao: null, total: 1, motivo });
    expect(posicoes.get('ativo')).toEqual({ posicao: 1, total: 1 });
  });

  it('recalcula após encaminhamento, priorização e término das férias', () => {
    const a = cadastro('a', { ultimoLeadRecebidoEm: '2026-11-01T00:00:00Z' });
    const b = cadastro('b', { ultimoLeadRecebidoEm: '2026-11-02T00:00:00Z' });
    expect(posicoesDoRodizio([a, b], agora).get('a')?.posicao).toBe(1);
    expect(posicoesDoRodizio([{ ...a, ultimoLeadRecebidoEm: agora.toISOString() }, b], agora).get('a')?.posicao).toBe(2);
    expect(posicoesDoRodizio([a, { ...b, ultimoLeadRecebidoEm: undefined }], agora).get('b')?.posicao).toBe(1);
    const ferias = { inicio: '2026-11-01T00:00:00Z', fim: agora.toISOString(), criadoEm: '2026-10-01T00:00:00Z' };
    expect(posicoesDoRodizio([{ ...a, ausenciasAgenda: [ferias] }, b], agora).get('a')?.posicao).toBe(1);
  });

  it('inclui quem está oculto na vitrine sem pausa, como faz o motor', () => {
    expect(posicoesDoRodizio([cadastro('oculto', { exibirNaVitrine: false })], agora).get('oculto')?.posicao).toBe(1);
  });

  it('trata data ilegível como ausência e preserva empates na ordem recebida', () => {
    const posicoes = posicoesDoRodizio([cadastro('ilegivel', { ultimoLeadRecebidoEm: 'inválida' }),
      cadastro('novo'), cadastro('a', { ultimoLeadRecebidoEm: '2026-11-01T00:00:00Z' }),
      cadastro('b', { ultimoLeadRecebidoEm: '2026-11-01T00:00:00Z' })], agora);
    expect([...posicoes.values()].map((p) => p.posicao)).toEqual([1, 2, 3, 4]);
  });
});
