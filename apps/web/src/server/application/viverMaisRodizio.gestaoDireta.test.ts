import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord, PersistedSnapshot, TriagemPacienteRecord } from './persistence';
import { alocarLeadParaPsicologo, reatribuirLeadPelaGestao } from './viverMaisRodizio';

function psicologo(id: string, limitePacientesAtivos = 5): CadastroPsicologoRecord {
  return {
    id,
    profissionalRef: `prof-${id}`,
    nomeCompleto: `Profissional ${id}`,
    crp: '00/00001',
    whatsapp: '48999990000',
    status: 'APROVADO',
    criadoEm: '2026-10-01T10:00:00.000Z',
    turnosDisponiveis: ['TARDE'],
    modalidadesAtendidas: ['PARTICULAR'],
    servicosHabilitados: ['PSICOTERAPIA'],
    publicoAlvo: ['Adulto'],
    limitePacientesAtivos,
  };
}

function lead(id: string, extras: Partial<TriagemPacienteRecord> = {}): TriagemPacienteRecord {
  return {
    id,
    protocolo: `VM-${id}`,
    nomePaciente: `Paciente ${id}`,
    telefone: '48988880000',
    convenioSelecionado: 'Nenhum',
    origem: 'Site',
    turno: 'TARDE',
    modalidade: 'PARTICULAR',
    servicoKey: 'PSICOTERAPIA',
    paraQuemE: 'Adulto',
    status: 'PENDENTE_ATRIBUICAO',
    criadoEm: '2026-11-23T12:00:00.000Z',
    ...extras,
  };
}

function snapshotComLotado(limite = 5): PersistedSnapshot {
  const ativos = Array.from({ length: limite }, (_, i) =>
    lead(`ativo-${i}`, {
      psicologoAlocadoId: 'psi-1',
      psicologoNome: 'Profissional psi-1',
      status: 'CONTATO_CONFIRMADO',
      aceitoEm: '2026-11-20T10:00:00.000Z',
      confirmadoEm: '2026-11-20T10:00:00.000Z',
    })
  );
  return {
    version: 1,
    savedAt: '2026-11-23T12:00:00.000Z',
    appointments: [],
    sessions: [],
    records: [],
    timeline: [],
    notifications: [],
    ledger: { charges: [], discounts: [], payments: [], refunds: [], fees: [], transfers: [] },
    deliveredHandoffs: [],
    assessments: [],
    preferences: [],
    consents: [],
    cadastrosPsicologos: [psicologo('psi-1', limite)],
    triagensPacientes: [...ativos, lead('novo')],
  };
}

describe('viverMaisRodizio — vínculo direto pela Gestão e exceção de limite (§§ 6.07–6.08)', () => {
  it('permite escolher entre pedir aceite e vincular diretamente na triagem', () => {
    const base = snapshotComLotado(5);
    base.cadastrosPsicologos = [psicologo('psi-livre', 5)];

    const pedido = reatribuirLeadPelaGestao(base, 'novo', 'prof-psi-livre', new Date(), {
      modo: 'PEDIR_ACEITE',
    });
    expect(pedido.situacao).toBe('reatribuido');
    if (pedido.situacao === 'reatribuido') {
      expect(pedido.lead.status).toBe('AGUARDANDO_CONTATO');
      expect(pedido.lead.aceitoEm).toBeUndefined();
      expect(pedido.ocupacaoResultante).toEqual({ ativos: 0, limite: 5 });
    }

    const direto = reatribuirLeadPelaGestao(base, 'novo', 'prof-psi-livre', new Date(), {
      modo: 'VINCULAR_DIRETO',
    });
    expect(direto.situacao).toBe('reatribuido');
    if (direto.situacao === 'reatribuido') {
      expect(direto.lead.status).toBe('CONTATO_CONFIRMADO');
      expect(direto.lead.aceitoEm).toBeDefined();
      expect(direto.lead.confirmadoEm).toBeDefined();
      expect(direto.ocupacaoResultante).toEqual({ ativos: 1, limite: 5 });
    }
  });

  it('bloqueia alocação sem autorização quando profissional está lotado (5/5) e exige justificativa', () => {
    const base = snapshotComLotado(5);

    const bloqueado = reatribuirLeadPelaGestao(base, 'novo', 'prof-psi-1', new Date(), {
      modo: 'VINCULAR_DIRETO',
    });
    expect(bloqueado).toMatchObject({ situacao: 'limite_atingido', ativos: 5, limite: 5 });

    const semJustificativa = reatribuirLeadPelaGestao(base, 'novo', 'prof-psi-1', new Date(), {
      modo: 'VINCULAR_DIRETO',
      excederLimite: true,
      justificativaExcesso: '   ',
    });
    expect(semJustificativa).toMatchObject({ situacao: 'justificativa_obrigatoria', ativos: 5, limite: 5 });
  });

  it('permite exceder o limite com justificativa e apura 6 de 5 pacientes ativos', () => {
    const base = snapshotComLotado(5);

    const excedido = reatribuirLeadPelaGestao(base, 'novo', 'prof-psi-1', new Date(), {
      modo: 'VINCULAR_DIRETO',
      excederLimite: true,
      justificativaExcesso: 'Continuidade terapêutica autorizada pela coordenação.',
    });
    expect(excedido.situacao).toBe('reatribuido');
    if (excedido.situacao === 'reatribuido') {
      expect(excedido.excedeuLimite).toBe(true);
      expect(excedido.ocupacaoResultante).toEqual({ ativos: 6, limite: 5 });
      expect(excedido.psicologo.pacientesAtivosCount).toBe(6);
    }

    const desistenteBase = snapshotComLotado(5);
    desistenteBase.triagensPacientes = [
      ...(desistenteBase.triagensPacientes ?? []).filter((item) => item.id !== 'novo'),
      lead('desistente', { status: 'DESISTENTE', psicologoAlocadoId: 'psi-anterior' }),
    ];
    const reativado = alocarLeadParaPsicologo(
      desistenteBase,
      lead('desistente', { status: 'DESISTENTE' }),
      'psi-1',
      '2026-11-23T15:00:00.000Z',
      { modo: 'VINCULAR_DIRETO', excederLimite: true, justificativaExcesso: 'Retorno ao mesmo vínculo.' }
    );
    expect(reativado.psicologo?.pacientesAtivosCount).toBe(6);
  });
});
