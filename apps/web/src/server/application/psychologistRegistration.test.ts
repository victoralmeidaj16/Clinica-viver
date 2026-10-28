import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord } from './persistence';
import { aplicarMudancas, assertDecisaoDoPedidoAtual, CAMPOS_DA_GESTAO, CAMPOS_DO_PROPRIO_PSICOLOGO, derivarModalidadesAtendidas } from './psychologistRegistration';

const cadastro = (mudancas: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord => ({
  id: 'psi-1',
  nomeCompleto: 'Joliana Souza',
  crp: '12/29788',
  whatsapp: '5548999999999',
  status: 'APROVADO',
  criadoEm: '2026-08-26T12:00:00.000Z',
  pausadoNoRodizio: false,
  exibirNaVitrine: true,
  ...mudancas,
});

describe('estado operacional do psicólogo', () => {
  it('retira da vitrine ao pausar o rodízio', () => {
    const resultado = aplicarMudancas(
      cadastro(),
      { pausadoNoRodizio: true, motivoPausaRodizio: 'Férias' },
      CAMPOS_DA_GESTAO
    );

    expect(resultado.pausadoNoRodizio).toBe(true);
    expect(resultado.exibirNaVitrine).toBe(false);
  });

  it('devolve à vitrine ao retomar o rodízio', () => {
    const resultado = aplicarMudancas(
      cadastro({ pausadoNoRodizio: true, exibirNaVitrine: false }),
      { pausadoNoRodizio: false },
      CAMPOS_DA_GESTAO
    );

    expect(resultado.pausadoNoRodizio).toBe(false);
    expect(resultado.exibirNaVitrine).toBe(true);
    expect(resultado.motivoPausaRodizio).toBeUndefined();
    expect(resultado.motivoDesativacao).toBeUndefined();
  });

  it('converte o comando legado de ocultar em pausa', () => {
    const resultado = aplicarMudancas(
      cadastro(),
      { exibirNaVitrine: false },
      CAMPOS_DA_GESTAO
    );

    expect(resultado.pausadoNoRodizio).toBe(true);
    expect(resultado.exibirNaVitrine).toBe(false);
  });

  it('deriva modalidades com equivalência social e acessível', () => {
    expect(derivarModalidadesAtendidas('SOCIAL')).toContain('ACESSIVEL_SOCIAL');
    expect(derivarModalidadesAtendidas('SOCIAL')).toContain('SOCIAL');
    expect(derivarModalidadesAtendidas('PARTICULAR')).toEqual(['PARTICULAR']);
    expect(derivarModalidadesAtendidas('AMBOS')).toContain('ACESSIVEL_SOCIAL');
    expect(derivarModalidadesAtendidas('AMBOS')).toContain('PARTICULAR');
  });
});

it('impede pedido de limite pelo psicólogo e preserva os demais itens da solicitação', () => {
  const solicitacao = { limitePacientesAtivos: 30, servicosPrestados: ['Atendimento Psicológico'],
    justificativa: 'Atualização dos serviços', solicitadoEm: '2026-10-16T12:00:00Z', status: 'PENDENTE' as const };
  const resultado = aplicarMudancas(cadastro({ limitePacientesAtivos: 5 }), {
    limitePacientesAtivos: 30, solicitacaoAlteracaoGestao: solicitacao,
  }, CAMPOS_DO_PROPRIO_PSICOLOGO);
  expect(resultado.limitePacientesAtivos).toBe(5);
  expect(resultado.solicitacaoAlteracaoGestao).not.toHaveProperty('limitePacientesAtivos');
  expect(resultado.solicitacaoAlteracaoGestao?.servicosPrestados).toEqual(solicitacao.servicosPrestados);
  expect(solicitacao.limitePacientesAtivos).toBe(30);
});
it('mantém o ajuste direto de capacidade exclusivo da gestão', () => {
  expect(aplicarMudancas(cadastro({ limitePacientesAtivos: 5 }), {
    limitePacientesAtivos: 10,
  }, CAMPOS_DA_GESTAO).limitePacientesAtivos).toBe(10);
});
it('permite cancelar a solicitação do psicólogo', () => {
  const existente = cadastro({ solicitacaoAlteracaoGestao: { status: 'PENDENTE', solicitadoEm: '2026-10-16T12:00:00Z' } });
  expect(aplicarMudancas(existente, { solicitacaoAlteracaoGestao: null }, CAMPOS_DO_PROPRIO_PSICOLOGO)
    .solicitacaoAlteracaoGestao).toBeUndefined();
});

it('não permite ao psicólogo alterar diretamente turma ou formação homologada', () => {
  const anterior = cadastro({ turmaViverMais: '24A', posGraduacaoViverMais: 'Curso original' });
  const resultado = aplicarMudancas(anterior, { turmaViverMais: '25A', posGraduacaoViverMais: 'Outro curso' }, CAMPOS_DO_PROPRIO_PSICOLOGO);
  expect(resultado).toMatchObject({ turmaViverMais: '24A', posGraduacaoViverMais: 'Curso original' });
});

describe('decisão da gestão sobre o pedido de ajuste de perfil', () => {
  const pedido = {
    status: 'PENDENTE' as const, solicitadoEm: '2026-10-16T12:00:00Z', justificativa: 'Nova turma',
    turmaViverMais: '25A', servicosPrestados: ['Orientação Parental'], limitePacientesAtivos: 12,
  };
  const base = () => cadastro({
    turmaViverMais: '24A', posGraduacaoViverMais: 'Curso original', servicosPrestados: ['Atendimento Psicológico'],
    limitePacientesAtivos: 5, solicitacaoAlteracaoGestao: pedido,
  });

  it('aprova aplicando exatamente os campos solicitados e preservando os demais', () => {
    const resultado = aplicarMudancas(base(), {
      solicitacaoAlteracaoGestao: { ...pedido, status: 'APROVADO', respondidoEm: '2026-10-17T12:00:00Z' },
      turmaViverMais: '25A', servicosPrestados: pedido.servicosPrestados, limitePacientesAtivos: 12,
    }, CAMPOS_DA_GESTAO);
    expect(resultado).toMatchObject({
      turmaViverMais: '25A', servicosPrestados: ['Orientação Parental'], limitePacientesAtivos: 12,
      posGraduacaoViverMais: 'Curso original', nomeCompleto: 'Joliana Souza', crp: '12/29788',
    });
    expect(resultado.solicitacaoAlteracaoGestao?.status).toBe('APROVADO');
  });

  it('recusa mantendo os valores atuais e registrando o motivo para o psicólogo', () => {
    const resultado = aplicarMudancas(base(), {
      solicitacaoAlteracaoGestao: { ...pedido, status: 'RECUSADO', respondidoEm: '2026-10-17T12:00:00Z', motivoRecusa: 'Turma ainda não homologada' },
    }, CAMPOS_DA_GESTAO);
    expect(resultado).toMatchObject({
      turmaViverMais: '24A', servicosPrestados: ['Atendimento Psicológico'], limitePacientesAtivos: 5,
      posGraduacaoViverMais: 'Curso original',
    });
    expect(resultado.solicitacaoAlteracaoGestao).toMatchObject({ status: 'RECUSADO', motivoRecusa: 'Turma ainda não homologada' });
  });

  it('o pedido cancelado deixa de existir e não sobra pendência para a gestão', () => {
    const resultado = aplicarMudancas(base(), { solicitacaoAlteracaoGestao: null }, CAMPOS_DO_PROPRIO_PSICOLOGO);
    expect(resultado.solicitacaoAlteracaoGestao).toBeUndefined();
    expect(resultado.turmaViverMais).toBe('24A');
  });

  it('o psicólogo não consegue aprovar o próprio pedido nem aplicar os campos da gestão', () => {
    const resultado = aplicarMudancas(base(), {
      solicitacaoAlteracaoGestao: { ...pedido, status: 'APROVADO' },
      turmaViverMais: '25A', limitePacientesAtivos: 99, servicosPrestados: ['Outro'],
    }, CAMPOS_DO_PROPRIO_PSICOLOGO);
    expect(resultado).toMatchObject({ turmaViverMais: '24A', limitePacientesAtivos: 5 });
    expect(resultado.solicitacaoAlteracaoGestao).not.toHaveProperty('limitePacientesAtivos');
  });

  it('recusa a decisão quando o psicólogo já enviou outro pedido', () => {
    const decisaoAntiga = { ...pedido, solicitadoEm: '2026-10-15T12:00:00Z', status: 'APROVADO' };
    expect(() => assertDecisaoDoPedidoAtual(base(), { solicitacaoAlteracaoGestao: decisaoAntiga })).toThrow(/novo pedido/);
    expect(() => assertDecisaoDoPedidoAtual(base(), { solicitacaoAlteracaoGestao: { ...pedido, status: 'APROVADO' } })).not.toThrow();
  });
});
