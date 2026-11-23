import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { emptySnapshot, type CadastroPsicologoRecord, type TriagemPacienteRecord } from './persistence';
import { recalcularPacientesAtivos } from './viverMaisRodizio';

/**
 * Especificação final, 3.11, 6.02, 6.05, 6.06 e seção 15: o vínculo ativo
 * ocupa vaga; paciente do Projeto Acolhe não entra no limite; desistência e
 * alta liberam a vaga na hora.
 */

const psicologo: CadastroPsicologoRecord = {
  id: 'psi-1', nomeCompleto: 'Profissional Fictício', crp: '00/00000', whatsapp: '',
  status: 'APROVADO', criadoEm: '2026-01-01T00:00:00.000Z', limitePacientesAtivos: 5,
};

const vinculo = (id: string, mudancas: Partial<TriagemPacienteRecord> = {}): TriagemPacienteRecord => ({
  id, protocolo: id, nomePaciente: 'Paciente Fictício', telefone: '5500000000000',
  convenioSelecionado: 'Nenhum', origem: 'Cadastro manual', turno: 'MANHA',
  status: 'CONTATO_CONFIRMADO', criadoEm: '2026-11-01T00:00:00.000Z', psicologoAlocadoId: 'psi-1',
  ...mudancas,
});

const contar = (leads: TriagemPacienteRecord[]) => recalcularPacientesAtivos({
  ...emptySnapshot(), triagensPacientes: leads, cadastrosPsicologos: [psicologo],
}).cadastrosPsicologos![0].pacientesAtivosCount;

describe('contador de pacientes ativos', () => {
  it('cadastro manual ocupa vaga; paciente do Projeto Acolhe não', () => {
    expect(contar([vinculo('manual'), vinculo('acolhe', { projetoAcolhe: true })])).toBe(1);
  });

  it('aceite pelo site ocupa vaga mesmo antes do primeiro agendamento', () => {
    expect(contar([vinculo('site', { status: 'AGUARDANDO_CONTATO', aceitoEm: '2026-11-02T00:00:00.000Z' })])).toBe(1);
  });

  it('desistência e alta liberam a vaga, mesmo de quem foi aceito pelo site', () => {
    const aceitoEm = '2026-11-02T00:00:00.000Z';
    expect(contar([
      vinculo('desistiu', { status: 'DESISTENTE', aceitoEm }),
      vinculo('alta', { status: 'FINALIZADO', aceitoEm }),
    ])).toBe(0);
  });

  it('oferta ainda não aceita não ocupa vaga', () => {
    expect(contar([vinculo('oferta', { status: 'AGUARDANDO_CONTATO' })])).toBe(0);
  });
});
