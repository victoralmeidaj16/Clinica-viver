import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord, PersistedSnapshot, TriagemPacienteRecord } from './persistence';
import { encaminharParaProximo } from './viverMaisRodizio';

function psi(id: string, ultimoLeadRecebidoEm?: string): CadastroPsicologoRecord {
  return {
    id,
    nomeCompleto: `Profissional ${id}`,
    crp: '00/00001',
    whatsapp: '48999990000',
    status: 'APROVADO',
    criadoEm: '2026-10-01T10:00:00.000Z',
    turnosDisponiveis: ['TARDE'],
    modalidadesAtendidas: ['PARTICULAR'],
    servicosHabilitados: ['PSICOTERAPIA'],
    publicoAlvo: ['Adulto'],
    limitePacientesAtivos: 5,
    ultimoLeadRecebidoEm,
  };
}

function leadBase(extras: Partial<TriagemPacienteRecord> = {}): TriagemPacienteRecord {
  return {
    id: 'lead-recusa',
    protocolo: 'VM-400001',
    nomePaciente: 'Paciente Fictício',
    telefone: '48988880000',
    convenioSelecionado: 'Nenhum',
    origem: 'Site',
    turno: 'TARDE',
    modalidade: 'PARTICULAR',
    servicoKey: 'PSICOTERAPIA',
    paraQuemE: 'Adulto',
    status: 'AGUARDANDO_CONTATO',
    psicologoAlocadoId: 'psi-1',
    psicologoNome: 'Profissional psi-1',
    alocadoEm: '2026-11-23T12:00:00.000Z',
    tipoAlocacao: 'RODIZIO',
    psicologosJaTentados: ['psi-1'],
    criadoEm: '2026-11-23T12:00:00.000Z',
    ...extras,
  };
}

function state(cadastrosPsicologos: CadastroPsicologoRecord[], triagem: TriagemPacienteRecord): PersistedSnapshot {
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
    cadastrosPsicologos,
    triagensPacientes: [triagem],
  };
}

describe('encaminharParaProximo — motivo opcional na recusa (§ 5.04)', () => {
  it('registra recusa com motivo opcional ao encaminhar para o próximo do rodízio', () => {
    const agora = new Date('2026-11-23T14:00:00.000Z');
    const resultado = encaminharParaProximo(
      state([psi('psi-1'), psi('psi-2')], leadBase()),
      'lead-recusa',
      'psi-1',
      agora,
      '  Agenda cheia à tarde neste mês.  '
    );

    expect(resultado.situacao).toBe('encaminhado');
    expect(resultado.lead?.psicologoAlocadoId).toBe('psi-2');
    expect(resultado.lead?.recusas).toEqual([
      {
        psicologoId: 'psi-1',
        psicologoNome: 'Profissional psi-1',
        recusadoEm: agora.toISOString(),
        motivo: 'Agenda cheia à tarde neste mês.',
      },
    ]);
  });

  it('registra recusa sem motivo em escolha direta devolvida à Gestão e quando não há outro candidato', () => {
    const agora = new Date('2026-11-23T15:00:00.000Z');
    const direta = encaminharParaProximo(
      state([psi('psi-1'), psi('psi-2')], leadBase({ tipoAlocacao: 'ESCOLHA_DIRETA' })),
      'lead-recusa',
      'psi-1',
      agora,
      '   '
    );
    expect(direta.situacao).toBe('devolvido_gestao');
    expect(direta.lead?.recusas).toEqual([
      {
        psicologoId: 'psi-1',
        psicologoNome: 'Profissional psi-1',
        recusadoEm: agora.toISOString(),
      },
    ]);

    const semCandidato = encaminharParaProximo(
      state([psi('psi-1')], leadBase()),
      'lead-recusa',
      'psi-1',
      agora,
      'Demanda fora da minha área.'
    );
    expect(semCandidato.situacao).toBe('sem_candidato');
    expect(semCandidato.snapshot.triagensPacientes?.[0].recusas).toEqual([
      {
        psicologoId: 'psi-1',
        psicologoNome: 'Profissional psi-1',
        recusadoEm: agora.toISOString(),
        motivo: 'Demanda fora da minha área.',
      },
    ]);
  });
});
