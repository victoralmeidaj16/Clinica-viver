import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientProfile } from '@thats-life/core';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';

vi.mock('server-only', () => ({}));

const patients = new Map<string, PatientProfile>();
const identities = {
  getPatient: vi.fn(async (_org: string, id: string) => patients.get(id) ?? null),
  getProfessional: vi.fn(async (_org: string, id: string) => ({ id, status: 'active', displayName: 'Psi' })),
  savePatient: vi.fn(async (patient: PatientProfile) => { patients.set(patient.id, patient); }),
  reassignPatient: vi.fn(),
};

vi.mock('./store', () => ({
  getApplicationStore: () => ({ identities }),
  persistApplicationState: vi.fn(),
}));

const { promoverLeadEmPaciente } = await import('./patientPromotion');

const psicologos = [{ id: 'cad-1', profissionalRef: 'prof-1' }] as CadastroPsicologoRecord[];

describe('promoverLeadEmPaciente', () => {
  beforeEach(() => {
    patients.clear();
    vi.clearAllMocks();
  });

  it('reaproveita o paciente do cadastro manual em vez de criar outro', async () => {
    patients.set('patient-abc', {
      id: 'patient-abc',
      organizationId: 'org-demo',
      displayName: 'Paciente',
      status: 'active',
      primaryProfessionalId: 'prof-1',
      assignedProfessionalIds: ['prof-1'],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    } as PatientProfile);
    const lead = {
      id: 'triagem-manual-patient-abc',
      protocolo: 'VM-MANUAL-ABC',
      nomePaciente: 'Paciente',
      status: 'CONTATO_CONFIRMADO',
      psicologoAlocadoId: 'cad-1',
      pacienteRef: 'patient-abc',
    } as TriagemPacienteRecord;

    const ref = await promoverLeadEmPaciente(lead, psicologos);

    expect(ref).toBe('patient-abc');
    expect(identities.savePatient).not.toHaveBeenCalled();
    expect(patients.size).toBe(1);
  });

  it('cria o paciente com id derivado quando o lead ainda não tem vínculo', async () => {
    const lead = {
      id: 'lead-1',
      protocolo: 'VM-1',
      nomePaciente: 'Paciente',
      status: 'CONTATO_CONFIRMADO',
      psicologoAlocadoId: 'cad-1',
    } as TriagemPacienteRecord;

    expect(await promoverLeadEmPaciente(lead, psicologos)).toBe('paciente-lead-1');
  });
});
