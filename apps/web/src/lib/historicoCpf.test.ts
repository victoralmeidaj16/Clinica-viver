import { describe, expect, it } from 'vitest';
import { historicoAdministrativoPorCpf, normalizarCpfBusca } from './historicoCpf';

describe('histórico administrativo por CPF (§§ 4.02 e 6.09)', () => {
  it('normaliza CPF ignorando pontuação e descarta valores inválidos', () => {
    expect(normalizarCpfBusca('111.222.333-44')).toBe('11122233344');
    expect(normalizarCpfBusca('1234')).toBeUndefined();
    expect(normalizarCpfBusca(undefined)).toBeUndefined();
  });

  it('reúne solicitações sucessivas do mesmo CPF ordenadas da mais recente para a mais antiga', () => {
    const triagens = [
      {
        id: 'lead-1',
        protocolo: 'VM-100001',
        cpf: '111.222.333-44',
        criadoEm: '2026-09-01T10:00:00.000Z',
        status: 'FINALIZADO',
        servico: 'Psicoterapia Individual',
        modalidade: 'SOCIAL',
        psicologoNome: 'Dra. Primeira',
      },
      {
        id: 'lead-outro',
        protocolo: 'VM-999999',
        cpf: '99988877766',
        criadoEm: '2026-10-15T10:00:00.000Z',
        status: 'CONTATO_CONFIRMADO',
      },
      {
        id: 'lead-2',
        protocolo: 'VM-100002',
        cpf: '11122233344',
        criadoEm: '2026-11-23T12:00:00.000Z',
        status: 'AGUARDANDO_CONTATO',
        servicoKey: 'PSICOTERAPIA',
        modalidade: 'PARTICULAR',
        psicologoNome: 'Dr. Segundo',
      },
    ];

    expect(historicoAdministrativoPorCpf(triagens, '111.222.333-44', 'lead-2')).toEqual([
      {
        leadId: 'lead-2',
        protocolo: 'VM-100002',
        criadoEm: '2026-11-23T12:00:00.000Z',
        status: 'AGUARDANDO_CONTATO',
        servico: 'PSICOTERAPIA',
        modalidade: 'PARTICULAR',
        psicologoNome: 'Dr. Segundo',
        atual: true,
      },
      {
        leadId: 'lead-1',
        protocolo: 'VM-100001',
        criadoEm: '2026-09-01T10:00:00.000Z',
        status: 'FINALIZADO',
        servico: 'Psicoterapia Individual',
        modalidade: 'SOCIAL',
        psicologoNome: 'Dra. Primeira',
        atual: false,
      },
    ]);
  });
});
