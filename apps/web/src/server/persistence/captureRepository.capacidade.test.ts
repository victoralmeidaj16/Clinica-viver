import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { aceitarPaciente } from '@/server/application/viverMaisRodizio';
import { emptySnapshot, writeSnapshot, type TriagemPacienteRecord } from '@/server/application/persistence';
import { FileCaptureRepository, captureStateAsSnapshot } from './captureRepository';

vi.mock('server-only', () => ({}));
vi.mock('./turmasEncerradas', () => ({ comTurmasEncerradas: async (cadastros: unknown[]) => cadastros }));

it('serializa dois aceites simultâneos inclusive quando chegam a instâncias diferentes no modo de demonstração', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'viver-mais-vaga-'));
  vi.stubEnv('DEMO_STATE_FILE', join(directory, 'estado.json'));
  try {
    const agora = new Date('2026-11-20T15:00:00.000Z');
    const criadoEm = agora.toISOString();
    const ofertas: TriagemPacienteRecord[] = ['oferta-a', 'oferta-b'].map((id) => ({
      id, protocolo: id, nomePaciente: 'Cadastro fictício', telefone: '', convenioSelecionado: '',
      origem: 'Vitrine', turno: 'MANHA', modalidade: 'PARTICULAR', status: 'AGUARDANDO_CONTATO',
      criadoEm, alocadoEm: criadoEm, psicologoAlocadoId: 'psi',
    }));
    await writeSnapshot({ ...emptySnapshot(), triagensPacientes: ofertas, cadastrosPsicologos: [{
      id: 'psi', nomeCompleto: 'Profissional fictício', crp: '', whatsapp: '',
      status: 'APROVADO', criadoEm, limitePacientesAtivos: 1,
    }] });
    const resultados = await Promise.all(ofertas.map(({ id }) => new FileCaptureRepository().mutate((state) => {
      const { next, result } = aceitarPaciente(captureStateAsSnapshot(state), id, 'psi', agora);
      return { next: { cadastrosPsicologos: next.cadastrosPsicologos!, triagensPacientes: next.triagensPacientes! }, result: result.kind };
    })));
    expect(resultados.sort()).toEqual(['accepted', 'capacity_pending']);
    const final = await new FileCaptureRepository().read();
    expect(final.triagensPacientes.filter((lead) => lead.aceitoEm)).toHaveLength(1);
    expect(final.triagensPacientes.filter((lead) => lead.status === 'PENDENTE_ATRIBUICAO')).toHaveLength(1);
    expect(final.cadastrosPsicologos[0].pacientesAtivosCount).toBe(1);
  } finally {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
