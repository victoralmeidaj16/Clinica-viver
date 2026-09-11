import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/viverMaisConfirmToken', () => ({
  gerarTokenConfirmacao: vi.fn(() => 'token-mock-123'),
}));

import { textoParaPsicologo, textoParaPaciente, textoParaPacienteTransbordo } from './viverMaisWhatsApp';
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
    expect(msg).toContain('Olá, Joaquina Silva! 💜');
    expect(msg).toContain('processo de Psicoterapia Individual. 💜🧡');
    expect(msg).toContain('O valor para Psicoterapia Individual Acessível é de R$ 75,00 por sessão.');
  });

  it('usa o nome de registro quando não houver nome social', () => {
    const msg = textoParaPaciente(leadStub);
    expect(msg).toContain('Olá, Maria Joaquina da Silva! 💜');
    expect(msg).toContain('Viviane Oliveira de Almeida Jeremias e Cia LTDA');
    expect(msg).toContain('Viver Mais Psicologia');
  });

  it('ajusta valor e modalidade para agendamento particular de casal', () => {
    const casalParticular: TriagemPacienteRecord = {
      ...leadStub,
      servico: 'Psicoterapia de Casal',
      modalidade: 'CASAL_PARTICULAR',
    };
    const msg = textoParaPaciente(casalParticular);
    expect(msg).toContain('O valor para Psicoterapia de Casal Particular é de R$ 260,00 por sessão.');
  });

  it('gera o texto acolhedor de encaminhamento / transbordo para o paciente', () => {
    const msg = textoParaPacienteTransbordo();
    expect(msg).toContain(
      'Para dar continuidade ao seu atendimento, vamos encaminhar você para outro(a) psicólogo(a) da nossa equipe.'
    );
    expect(msg).toContain(
      'Essa mudança é necessária por questões de organização e disponibilidade dos(as) psicólogos(as) da clínica, para que possamos garantir a continuidade do seu atendimento. 💜'
    );
    expect(msg).toContain(
      'O(a) novo(a) psicólogo(a) entrará em contato com você em breve.'
    );
  });
});
