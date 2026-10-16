import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord } from './persistence';
import { aplicarMudancas, CAMPOS_DA_GESTAO, CAMPOS_DO_PROPRIO_PSICOLOGO, derivarModalidadesAtendidas } from './psychologistRegistration';

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
