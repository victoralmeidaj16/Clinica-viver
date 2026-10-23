import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySnapshot, type CadastroPsicologoRecord, type TriagemPacienteRecord } from '@/server/application/persistence';
import { alocarLeadEscolhido } from '@/server/application/viverMaisRodizio';
import { profissionalCompativelNaVitrine } from '@/lib/vitrineMatching';
import type { PsicologoVitrineItem } from '@/components/vitrineCarrossel';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/server/persistence/captureRepository', () => ({
  getCaptureRepository: () => ({ read: mocks.read }),
  captureStateAsSnapshot: (state: unknown) => state,
}));
import { GET } from './route';

const agora = new Date('2026-10-16T12:00:00Z');
const psi: CadastroPsicologoRecord = {
  id: 'psi-1', nomeCompleto: 'Profissional teste', crp: '00/00000',
  whatsapp: '11999999999', email: 'teste@example.com', status: 'APROVADO',
  criadoEm: agora.toISOString(), turnosDisponiveis: ['MATUTINO'],
  modalidadesAtendidas: ['SOCIAL'], servicosHabilitados: ['PSICOTERAPIA'],
  publicoAlvo: ['Homens', 'Mulheres'], necessidadesAtendidas: ['Ansiedade'],
};
const lead: TriagemPacienteRecord = {
  id: 'lead-1', protocolo: 'TESTE', nomePaciente: 'Paciente teste',
  telefone: psi.whatsapp, email: psi.email, convenioSelecionado: 'Nenhum', origem: 'Whatsapp',
  turno: 'MANHA', modalidade: 'SOCIAL', servicoKey: 'PSICOTERAPIA',
  paraQuemE: 'Homem', status: 'PENDENTE_ATRIBUICAO', criadoEm: agora.toISOString(),
};
afterEach(() => vi.useRealTimers());

describe('compatibilidade da vitrine com o envio da escolha direta', () => {
  const casos: [string, Partial<CadastroPsicologoRecord>, Partial<TriagemPacienteRecord>, boolean][] = [
    ['mesmo telefone e email do profissional', {}, {}, true],
    ['modalidade não cadastrada', { modalidadesAtendidas: [] }, {}, false],
    ['modalidade incompatível', { modalidadesAtendidas: ['PARTICULAR'] }, {}, false],
    ['turnos legados e múltiplos', {}, { turno: 'TARDE,MANHA' }, true],
    ['turno incompatível', {}, { turno: 'NOITE' }, false],
    ['público incompatível', {}, { paraQuemE: 'Criança' }, false],
    ['Individual × Homens', { publicoAlvo: ['Homens'] }, { paraQuemE: 'Individual' }, true],
    ['Individual × Mulheres', { publicoAlvo: ['Mulheres'] }, { paraQuemE: 'Individual' }, true],
    ['Individual × Idoso', { publicoAlvo: ['Idoso'] }, { paraQuemE: 'Individual' }, true],
    ['Infantil × Criança', { publicoAlvo: ['Criança'] }, { paraQuemE: 'Infantil' }, true],
    ['Individual × Casais', { publicoAlvo: ['Casais'] }, { paraQuemE: 'Individual' }, false],
    ['Individual × Família', { publicoAlvo: ['Família'] }, { paraQuemE: 'Individual' }, false],
    ['Individual × Criança', { publicoAlvo: ['Criança'] }, { paraQuemE: 'Individual' }, false],
    ['Individual × Adolescente', { publicoAlvo: ['Adolescente'] }, { paraQuemE: 'Individual' }, false],
    ['Individual × Grupo', { publicoAlvo: ['Grupo'] }, { paraQuemE: 'Individual' }, false],
    ['Casal × Casais', { publicoAlvo: ['Casais'] }, { servicoKey: 'PSICOTERAPIA_CASAL', paraQuemE: 'Casal' }, true],
    ['avaliação e público compatíveis', { servicosHabilitados: ['AVALIACAO'], publicoAlvo: ['Mulheres'] }, { servicoKey: 'AVALIACAO', paraQuemE: 'Individual' }, true],
    ['avaliação com serviço incompatível', { servicosHabilitados: ['PSICOTERAPIA'], publicoAlvo: ['Mulheres'] }, { servicoKey: 'AVALIACAO', paraQuemE: 'Individual' }, false],
    ['avaliação com público incompatível', { servicosHabilitados: ['AVALIACAO'], publicoAlvo: ['Casais'] }, { servicoKey: 'AVALIACAO', paraQuemE: 'Individual' }, false],
    ['necessidade incompatível', {}, { necessidadesPaciente: ['Luto'] }, false],
    ['necessidade compatível', {}, { necessidadesPaciente: ['Ansiedade'] }, true],
    ['psicoterapia habilita casal', { publicoAlvo: ['Casais'] }, { servicoKey: 'PSICOTERAPIA_CASAL', paraQuemE: 'Casal' }, true],
    ['pausa manual', { pausadoNoRodizio: true }, {}, false],
    ['contagem desatualizada recalculada', { pacientesAtivosCount: 100 }, {}, true],
    ['ausência vigente', { ausenciasAgenda: [{ inicio: '2026-10-15T00:00:00Z', fim: '2026-10-17T00:00:00Z', motivo: 'Férias', criadoEm: agora.toISOString() }] }, {}, false],
  ];
  it.each(casos)('%s', async (_nome, cadastro, demanda, esperado) => {
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    const paciente = { ...lead, ...demanda };
    const snapshot = { ...emptySnapshot(), cadastrosPsicologos: [{ ...psi, ...cadastro }], triagensPacientes: [paciente] };
    mocks.read.mockResolvedValue(snapshot);
    const response = await GET();
    expect(response.status).toBe(200);
    const { data } = await response.json() as { data: PsicologoVitrineItem[] };
    expect(profissionalCompativelNaVitrine(data[0], {
      turno: paciente.turno, modalidade: paciente.modalidade!, servicoKey: paciente.servicoKey!,
      paraQuemE: paciente.paraQuemE, necessidadesPaciente: paciente.necessidadesPaciente,
    })).toBe(esperado);
    expect(Boolean(alocarLeadEscolhido(snapshot, paciente, psi.id, agora).psicologo)).toBe(esperado);
  });

  it('indisponibiliza quando pacientes confirmados atingem a capacidade', async () => {
    mocks.read.mockResolvedValue({ ...emptySnapshot(), cadastrosPsicologos: [{ ...psi, limitePacientesAtivos: 1 }],
      triagensPacientes: [{ ...lead, status: 'CONTATO_CONFIRMADO', psicologoAlocadoId: psi.id }],
    });
    const { data } = await (await GET()).json();
    expect(data[0].disponivelParaNovosPacientes).toBe(false);
  });
});
