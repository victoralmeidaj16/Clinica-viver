import { describe, expect, it } from 'vitest';
import { createPatientProfile } from '@thats-life/core';
import { managedPatientRegistration } from './managedPatientRegistration';
import type { TriagemPacienteRecord } from './persistence';

const lead = { nomePaciente: 'Nome antigo', telefone: '11911111111', email: 'antigo@example.com',
  cpf: '52998224725', cep: '01310100', numeroResidencia: '10' } as TriagemPacienteRecord;
const patient = createPatientProfile({ id: 'patient', organizationId: 'org', displayName: 'Nome atualizado',
  assignedProfessionalIds: [], createdAt: '2026-01-01T12:00:00.000Z' });

describe('dados cadastrais exibidos na gestão', () => {
  it('exibe os dados salvos mesmo que a triagem ainda contenha valores antigos', () => {
    expect(managedPatientRegistration(patient, { legalName: 'Nome corrigido', socialName: 'Nome social',
      phone: '11922222222', email: 'novo@example.com', documento: '11144477735', cep: '01001000', numero: '20' }, lead))
      .toEqual({ nome: 'Nome social', whatsapp: '11922222222', email: 'novo@example.com',
        cpf: '11144477735', cep: '01001000', numeroResidencia: '20' });
  });
  it('preserva os dados da triagem antes da promoção para paciente', () => {
    expect(managedPatientRegistration(undefined, undefined, lead)).toMatchObject({ nome: 'Nome antigo', whatsapp: lead.telefone, cpf: lead.cpf });
  });
  it('mostra cadastro de paciente sem triagem e usa nome civil ao remover o social', () => {
    expect(managedPatientRegistration(patient, { legalName: 'Nome civil', socialName: '', documento: '11144477735' }, undefined))
      .toMatchObject({ nome: 'Nome civil', cpf: '11144477735' });
  });
});
