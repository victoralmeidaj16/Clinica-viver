import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/adapters/whatsappAllowlist', () => ({
  assertWhatsAppRecipientAllowed: vi.fn(),
  RecipientNotAllowedError: class extends Error {},
}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
vi.mock('@/server/viverMaisConfirmToken', () => ({
  gerarTokenConfirmacao: vi.fn(() => 'token-mock-123'),
}));

import { textoParaPsicologo, textoParaPaciente, textoRecebimentoPaciente, avisarRecebimentoPaciente, avisarConfirmacaoPaciente, avisarAlocacao, avisarTransbordo } from './viverMaisWhatsApp';
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
    expect(msg).toContain('processo de Psicoterapia Individual. Seu agendamento');
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

  it('envia o acolhimento exato sem antecipar orientações', () => {
    expect(textoRecebimentoPaciente()).toBe([
      'Olá! Seja bem-vindo(a) à Viver Mais Psicologia! 🫂', '',
      'Recebemos sua solicitação de agendamento e agradecemos por entrar em contato com a gente!', '',
      'Em breve, você receberá as próximas orientações por aqui, neste mesmo contato.', '',
      'Estamos à disposição para te acolher! ✨',
    ].join('\n'));
    expect(textoParaPaciente(leadStub)).toContain('As sessões individuais têm duração de 50 minutos, enquanto as sessões de casal/família têm duração de 1h30.');
  });

  function prepararEnvio() {
    vi.stubEnv('EVOLUTION_API_URL', 'https://evolution.example');
    vi.stubEnv('EVOLUTION_API_KEY', 'test-key');
    vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'test');
    vi.stubEnv('WHATSAPP_COORDINATION_NUMBERS', '');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('envia acolhimento sem alocação e orientações uma única vez na confirmação', async () => {
    const fetchMock = prepararEnvio();
    const lead = { ...leadStub, id: 'flow-confirmacao' };
    await avisarRecebimentoPaciente(lead);
    await avisarConfirmacaoPaciente(lead);
    await avisarConfirmacaoPaciente(lead);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const textos = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).text);
    expect(textos).toEqual([textoRecebimentoPaciente(), textoParaPaciente(lead)]);
  });

  it.each(['sla_vencido', 'encaminhamento_voluntario', 'reatribuicao_gestao'] as const)(
    'não envia mensagem ao paciente na alocação nem no encaminhamento %s', async (motivo) => {
      const fetchMock = prepararEnvio();
      await avisarAlocacao({ ...leadStub, id: `alocacao-${motivo}` }, psicologoStub);
      await avisarTransbordo({ ...leadStub, id: `transbordo-${motivo}` }, psicologoStub, 'Anterior', motivo);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const [, init] of fetchMock.mock.calls) {
        expect(JSON.parse(init.body).number).toBe('5511912345678');
      }
    }
  );
});
