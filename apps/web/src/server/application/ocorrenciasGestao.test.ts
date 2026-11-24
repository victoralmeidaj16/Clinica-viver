import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => false, getMysqlPool: () => { throw new Error('sem banco'); } }));
vi.mock('./notificacoesDaSessao', () => ({
  notificacoesDaSessao: vi.fn(async () => [
    { chave: 'lead-sem-profissional:l1', tipo: 'lead-sem-profissional', titulo: 'Pedido sem profissional', descricao: 'Fictício',
      ocorridoEm: '2026-11-24T10:00:00.000Z', severidade: 'CRITICO', href: '/gestao/cockpit?lead=l1' },
    { chave: 'pagamento-recebido:x', tipo: 'pagamento-recebido', titulo: 'Pagamento', descricao: 'Informativo',
      ocorridoEm: '2026-11-24T09:00:00.000Z', severidade: 'INFO' },
  ]),
}));
vi.mock('@/server/communication/avisosEnviosRepository', () => ({
  listarEnviosDeAvisos: vi.fn(async () => [{ id: 'e1', finalidade: 'agenda_confirmacao_paciente', situacao: 'falha',
    referencia: 'agendamento:a1', criadoEm: '2026-11-24T11:00:00.000Z' }]),
}));

import { listarOcorrencias, registrarDecisaoOcorrencia } from './ocorrenciasGestao';

const sessao = { userId: 'u1', organizationId: 'org-teste', role: 'admin' } as never;
const autor = { usuarioRef: 'u1', nome: 'Gestão fictícia' };

describe('ocorrências da Gestão', () => {
  it('reúne só o que precisa de decisão, com link para a origem', async () => {
    const lista = await listarOcorrencias(sessao, new Date('2026-11-24T12:00:00.000Z'));
    expect(lista.map((o) => [o.chave, o.categoria, o.situacao])).toEqual([
      ['aviso:e1', 'comunicacao', 'aberta'],
      ['lead-sem-profissional:l1', 'pedido', 'aberta'],
    ]);
    expect(lista[1].href).toBe('/gestao/cockpit?lead=l1');
  });

  it('registra a decisão com autor e situação, e mantém o histórico', async () => {
    const agora = new Date('2026-11-24T12:00:00.000Z');
    await registrarDecisaoOcorrencia(sessao, autor, { chave: 'aviso:e1', situacao: 'em_andamento', decisao: 'Ligar para o paciente' }, agora);
    const resolvida = await registrarDecisaoOcorrencia(sessao, autor,
      { chave: 'aviso:e1', situacao: 'resolvida', decisao: 'Reenviado pela tela de envios' }, new Date('2026-11-24T13:00:00.000Z'));
    expect(resolvida.situacao).toBe('resolvida');
    expect(resolvida.decisoes.map((d) => d.situacao)).toEqual(['resolvida', 'em_andamento']);
    expect((await listarOcorrencias(sessao, agora)).find((o) => o.chave === 'aviso:e1')?.situacao).toBe('resolvida');
  });

  it('recusa decisão vazia, situação inválida ou ocorrência inexistente', async () => {
    await expect(registrarDecisaoOcorrencia(sessao, autor, { chave: 'aviso:e1', situacao: 'resolvida', decisao: '' })).rejects.toMatchObject({ status: 400 });
    await expect(registrarDecisaoOcorrencia(sessao, autor, { chave: 'aviso:e1', situacao: 'x', decisao: 'Algo' })).rejects.toMatchObject({ status: 400 });
    await expect(registrarDecisaoOcorrencia(sessao, autor, { chave: 'nao-existe', situacao: 'resolvida', decisao: 'Algo' })).rejects.toMatchObject({ status: 404 });
  });
});
