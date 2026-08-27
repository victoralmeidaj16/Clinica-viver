import { describe, expect, it } from 'vitest';
import { validatePatientRegistrationDetails } from './patientRegistrationDetails';

const complete = {
  legalName: 'Maria da Silva', phone: '(11) 99999-9999', email: 'maria@example.com',
  cpf: '529.982.247-25', address: { cep: '01310-100', logradouro: 'Avenida Paulista',
    numero: '1000', complemento: 'Sala 2', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
};

describe('cadastro completo do paciente', () => {
  it('normaliza CPF, telefone, CEP e UF', () => {
    const result = validatePatientRegistrationDetails(complete);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ phone: '11999999999', cpf: '52998224725', address: { cep: '01310100', uf: 'SP' } });
  });

  it.each(['logradouro', 'numero', 'bairro', 'cidade', 'uf'] as const)('recusa endereço sem %s', (field) => {
    const result = validatePatientRegistrationDetails({ ...complete, address: { ...complete.address, [field]: '' } });
    expect(result.ok).toBe(false);
  });

  it('recusa CPF inválido e preserva complemento opcional', () => {
    expect(validatePatientRegistrationDetails({ ...complete, cpf: '111.111.111-11' }).ok).toBe(false);
    expect(validatePatientRegistrationDetails({ ...complete, address: { ...complete.address, complemento: undefined } }).ok).toBe(true);
  });
});
