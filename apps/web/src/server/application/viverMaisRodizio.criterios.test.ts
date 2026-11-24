import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord, PersistedSnapshot, TriagemPacienteRecord } from './persistence';
import { alocarLead, listarPsicologosCompativeis } from './viverMaisRodizio';

function psicologo(id: string, extras: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord {
  return {
    id,
    nomeCompleto: `Profissional ${id}`,
    crp: '00/00001',
    whatsapp: '48999990000',
    status: 'APROVADO',
    criadoEm: '2026-10-01T10:00:00.000Z',
    turnosDisponiveis: ['TARDE'],
    modalidadesAtendidas: ['PARTICULAR'],
    modalidadeAtendimento: 'ONLINE',
    servicosHabilitados: ['PSICOTERAPIA', 'ORIENTACAO_PARENTAL', 'AVALIACAO'],
    publicoAlvo: ['Adulto', 'Família'],
    temposAtendimento: [50],
    limitePacientesAtivos: 5,
    ...extras,
  };
}

function lead(extras: Partial<TriagemPacienteRecord> = {}): TriagemPacienteRecord {
  return {
    id: 'lead-criterio',
    protocolo: 'VM-100001',
    nomePaciente: 'Paciente Fictício',
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

function snapshot(psicologos: CadastroPsicologoRecord[], triagem: TriagemPacienteRecord): PersistedSnapshot {
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
    cadastrosPsicologos: psicologos,
    triagensPacientes: [triagem],
  };
}

describe('viverMaisRodizio — formato, abordagem e duração', () => {
  it('aplica formato, abordagem (com 2ª pós) e duração na alocação e na listagem de compatíveis', () => {
    const presencial = psicologo('psi-presencial', {
      modalidadeAtendimento: 'PRESENCIAL',
      posGraduacaoViverMais: 'Formação e Pós-graduação em Terapia Cognitivo-Comportamental',
      temposAtendimento: [50, 90],
    });
    const onlinePsicanalise50 = psicologo('psi-psicanalise', {
      modalidadeAtendimento: 'ONLINE',
      posGraduacaoViverMais: 'Programa de Estudos e Pós-graduação em Psicanálise',
      temposAtendimento: [50],
    });
    const hibridoTccSegundaPos90 = psicologo('psi-hibrido-tcc', {
      modalidadeAtendimento: 'AMBOS',
      posGraduacaoViverMais: 'Formação e Pós-graduação em Psicodrama',
      segundaPosGraduacao: 'Formação e Pós-graduação em Terapia Cognitivo-Comportamental',
      temposAtendimento: [50, 90],
    });

    const pedido = lead({
      servicoKey: 'ORIENTACAO_PARENTAL',
      paraQuemE: 'Família',
      formatoAtendimento: 'ONLINE',
      abordagemDesejada: 'TCC',
    });

    const state = snapshot([presencial, onlinePsicanalise50, hibridoTccSegundaPos90], pedido);
    expect(listarPsicologosCompativeis(state, pedido).map((p) => p.id)).toEqual(['psi-hibrido-tcc']);

    const alocado = alocarLead(state, pedido);
    expect(alocado.psicologo?.id).toBe('psi-hibrido-tcc');
  });
});
