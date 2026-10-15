import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { emptySnapshot, type CadastroPsicologoRecord, type TriagemPacienteRecord } from './persistence';
import { aceitarPaciente } from './viverMaisRodizio';

const alocadoEm = '2026-10-15T10:00:00.000Z';
const lead: TriagemPacienteRecord = {
  id: 'lead-1',
  protocolo: 'VM-1',
  nomePaciente: 'Maria',
  telefone: '5511999999999',
  convenioSelecionado: 'Nenhum',
  origem: 'Vitrine',
  turno: 'MANHA',
  status: 'AGUARDANDO_CONTATO',
  criadoEm: alocadoEm,
  alocadoEm,
  psicologoAlocadoId: 'psi-1',
  psicologoNome: 'Dra. Ana',
};

const psicologo: CadastroPsicologoRecord = {
  id: 'psi-1',
  nomeCompleto: 'Dra. Ana',
  whatsapp: '5511888888888',
  crp: '00/0000',
  status: 'APROVADO',
  criadoEm: alocadoEm,
  limitePacientesAtivos: 5,
};

function snapshot(comLead: TriagemPacienteRecord = lead) {
  return { ...emptySnapshot(), triagensPacientes: [comLead], cadastrosPsicologos: [psicologo] };
}

describe('aceite do paciente pelo psicólogo', () => {
  it('persiste o aceite sem reiniciar o prazo e sem concluir o contato', () => {
    const agora = new Date('2026-10-15T12:00:00.000Z');
    const resultado = aceitarPaciente(snapshot(), 'lead-1', 'psi-1', agora);

    expect(resultado.result.kind).toBe('accepted');
    expect(resultado.next.triagensPacientes![0]).toMatchObject({
      aceitoEm: agora.toISOString(),
      alocadoEm,
      status: 'AGUARDANDO_CONTATO',
      psicologoAlocadoId: 'psi-1',
    });
    expect(resultado.next.triagensPacientes![0].confirmadoEm).toBeUndefined();
  });

  it('é idempotente quando o mesmo link é aberto e aceito novamente', () => {
    const aceitoEm = '2026-10-15T12:00:00.000Z';
    const resultado = aceitarPaciente(snapshot({ ...lead, aceitoEm }), 'lead-1', 'psi-1');
    expect(resultado.result.kind).toBe('already_accepted');
    expect(resultado.next.triagensPacientes![0].aceitoEm).toBe(aceitoEm);
  });

  it('rejeita o link quando o paciente já pertence a outro psicólogo', () => {
    const resultado = aceitarPaciente(snapshot({ ...lead, psicologoAlocadoId: 'psi-2' }), 'lead-1', 'psi-1');
    expect(resultado.result.kind).toBe('conflict');
  });
});
