import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolverPrecoEModalidade, textoParaPaciente } from './viverMaisWhatsApp';
import type { TriagemPacienteRecord } from './persistence';

const lead = {
  id: 'pricing-test', nomePaciente: 'Paciente', telefone: '11999999999',
  servico: 'Orientação Parental', modalidade: 'FAMILIA_PARTICULAR',
} as TriagemPacienteRecord;

describe('preço comunicado ao paciente', () => {
  it.each([
    ['FAMILIA_SOCIAL', 'Orientação Parental', 'Acessível', 'R$ 150,00'],
    ['FAMILIA_PARTICULAR', 'Orientação Parental', 'Particular', 'R$ 230,00'],
    ['SOCIAL', 'Psicoterapia Individual', 'Acessível', 'R$ 75,00'],
    ['PARTICULAR', 'Psicoterapia Individual', 'Particular', 'R$ 130,00'],
    ['CASAL_SOCIAL', 'Psicoterapia de Casal', 'Acessível', 'R$ 150,00'],
    ['CASAL_PARTICULAR', 'Psicoterapia de Casal', 'Particular', 'R$ 260,00'],
    ['SOCIAL', 'Avaliação Psicológica e Neuropsicológica', 'Acessível', 'R$ 100,00'],
    ['PARTICULAR', 'Avaliação Psicológica e Neuropsicológica', 'Particular', 'R$ 150,00'],
  ])('%s / %s corresponde à vitrine', (modalidade, servico, modalidadeRotulo, valor) => {
    expect(resolverPrecoEModalidade({ ...lead, modalidade, servico })).toEqual({
      servico, modalidadeRotulo, valor,
    });
  });

  it('inclui o preço familiar particular na mensagem final', () => {
    expect(textoParaPaciente(lead)).toContain('Orientação Parental Particular é de R$ 230,00 por sessão');
  });
});
