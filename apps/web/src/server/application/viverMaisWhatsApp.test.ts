import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/viverMaisConfirmToken', () => ({
  gerarTokenConfirmacao: vi.fn(() => 'token-mock-123'),
}));

import { textoParaPsicologo, textoParaPaciente } from './viverMaisWhatsApp';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';

describe('mensagens de WhatsApp para o psicólogo', () => {
  const leadStub: TriagemPacienteRecord = {
    id: 'lead-123',
    protocolo: 'PROT-999',
    nomePaciente: 'Maria Joaquina da Silva',
    telefone: '11987654321',
    idade: '28',
    genero: 'FEMININO',
    paraQuemE: 'A própria pessoa',
    servico: 'Psicoterapia Individual',
    modalidade: 'SOCIAL',
    turno: 'MANHA',
    convenioSelecionado: 'Nenhum',
    origem: 'Vitrine Principal',
    status: 'AGUARDANDO_CONTATO',
    criadoEm: '2026-09-08T10:00:00Z',
  };

  const psicologoStub: CadastroPsicologoRecord = {
    id: 'psi-456',
    nomeCompleto: 'Dra. Ana Paula Silveira',
    nomeSocial: 'Dra. Ana Paula',
    whatsapp: '11912345678',
    email: 'ana@example.com',
    crp: '06/123456',
    status: 'APROVADO',
    criadoEm: '2026-01-01T00:00:00Z',
  };

  it('inclui o campo "Nome completo" e omite "Origem" e "Protocolo"', () => {
    const texto = textoParaPsicologo(leadStub, psicologoStub);

    // Deve conter o nome completo do paciente
    expect(texto).toContain('Nome completo: Maria Joaquina da Silva');

    // Deve conter dados de contato e instrução com CONFIRMAR
    expect(texto).toContain('WhatsApp do paciente:');
    expect(texto).toContain('*CONFIRMAR*');
    expect(texto).toContain('*ENCAMINHAR*');

    // NÃO deve conter os campos Origem e Protocolo
    expect(texto).not.toContain('Origem:');
    expect(texto).not.toContain('Protocolo:');
    expect(texto).not.toContain('PROT-999');
    expect(texto).not.toContain('Vitrine Principal');
  });

  it('usa o nome social na mensagem de confirmação ao paciente quando presente', () => {
    const comSocial: TriagemPacienteRecord = {
      ...leadStub,
      nomeSocial: 'Joaquina Silva',
    };
    const msg = textoParaPaciente(comSocial);
    expect(msg).toContain('Olá, Joaquina Silva! Recebemos sua solicitação de agendamento.');
  });

  it('usa o nome de registro quando não houver nome social', () => {
    const msg = textoParaPaciente(leadStub);
    expect(msg).toContain('Olá, Maria Joaquina da Silva! Recebemos sua solicitação de agendamento.');
  });
});
