import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), email: vi.fn(), comprovante: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: vi.fn() }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/server/application/psychologistRegistrationEmail', () => ({ avisarCadastroRecebidoPorEmail: mocks.email }));
vi.mock('@/server/application/termoAdesaoComprovantePdf', () => ({ montarComprovanteTermoAdesao: async () => null }));
vi.mock('@/server/application/termoAdesaoComprovanteEmail', () => ({ enviarComprovanteTermoAdesao: mocks.comprovante }));
import { POST } from './route';
import { CadastroDuplicadoError } from '@/server/application/psychologistUniqueness';
import { regrasDuracaoSessao } from '@/lib/duracaoSessao';

const body = { nomeCompleto: 'Teste', crp: '12/34567', email: 'psi@example.com', whatsapp: '48998315675', estadoUf: 'SC', cidade: 'Florianópolis', logradouro: 'Rua Teste', bairro: 'Centro', genero: 'FEMININO', aceitouTermos: true, disponibilidadeTurnos: ['MANHA'], fotoUrl: 'data:image/png;base64,aW1hZ2Vt' };
const request = () => new Request('https://example.com/api/application/credenciamento-psicologo', { method: 'POST', body: JSON.stringify(body) });

describe('resposta ao cadastro repetido', () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([undefined, '', '   '])('recusa cadastro sem foto (%s) antes de gravar ou enviar e-mail', async (fotoUrl) => {
    mocks.email.mockResolvedValue({ situacao: 'enviada' });
    const response = await POST(new Request('https://example.com/cadastro', {
      method: 'POST', body: JSON.stringify({ ...body, fotoUrl }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.comprovante).not.toHaveBeenCalled();
  });

  it('recebe acessibilidade do próprio profissional sem pedir duração no credenciamento de avaliação', async () => {
    mocks.mutate.mockResolvedValue(undefined);
    mocks.email.mockResolvedValue({ situacao: 'enviada' });
    const response = await POST(new Request('https://example.com/cadastro', {
      method: 'POST', body: JSON.stringify({ ...body,
        posGraduacaoViverMais: 'Pós-graduação em Neuropsicologia Clínica',
        servicosPrestados: ['Avaliação Psicológica'], publicoAlvo: ['Adolescente'],
        acessibilidade: { necessita: true, descricao: '  Intérprete de Libras.  ' },
      }),
    }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.acessibilidade).toEqual({ necessita: true, descricao: 'Intérprete de Libras.' });
    expect(result.data.temposAtendimento).toBeUndefined();
    expect(regrasDuracaoSessao(result.data)).toEqual({ duracoesFixas: [50, 90], permiteVariavel: true });
  });

  it('recusa resposta de acessibilidade inválida sem gravar nem enviar e-mail', async () => {
    const response = await POST(new Request('https://example.com/cadastro', {
      method: 'POST', body: JSON.stringify({ ...body, acessibilidade: { necessita: 'false' } }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.comprovante).not.toHaveBeenCalled();
  });

  it.each([undefined, [], [30]])('exige duração permitida nas pós sem avaliação: %j', async (temposAtendimento) => {
    mocks.email.mockResolvedValue({ situacao: 'enviada' });
    const response = await POST(new Request('https://example.com/cadastro', {
      method: 'POST', body: JSON.stringify({ ...body,
        posGraduacaoViverMais: 'Programa de Estudos e Pós-graduação em Psicanálise',
        servicosPrestados: ['Atendimento Psicológico'], publicoAlvo: ['Homens'], temposAtendimento,
      }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it('retorna 409 com ação identificável e não envia nenhum e-mail', async () => {
    mocks.mutate.mockRejectedValue(new CadastroDuplicadoError());
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, code: 'CADASTRO_DUPLICADO' });
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.comprovante).not.toHaveBeenCalled();
  });
  it('mantém o envio normal para um cadastro novo', async () => {
    mocks.mutate.mockResolvedValue(undefined);
    mocks.email.mockResolvedValue({ situacao: 'enviada' });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });

  it('rejeita uma cidade que não pertence à UF antes de gravar o cadastro', async () => {
    const response = await POST(new Request('https://example.com/api/application/credenciamento-psicologo', {
      method: 'POST',
      body: JSON.stringify({ ...body, cidade: 'São Paulo' }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, error: 'Selecione uma cidade oficial da UF informada.' });
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('recusa público fora das opções da pós Perinatal', async () => {
    const response = await POST(new Request('https://example.com/api/application/credenciamento-psicologo', {
      method: 'POST',
      body: JSON.stringify({ ...body,
        posGraduacaoViverMais: 'Pós-graduação em Psicologia Perinatal e Parentalidade',
        servicosPrestados: ['Atendimento Psicológico'], temposAtendimento: [50],
        publicoAlvo: ['Criança', 'Público inválido'],
      }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('aceita Perinatal com modalidade e público do grupo C', async () => {
    mocks.mutate.mockResolvedValue(undefined);
    mocks.email.mockResolvedValue({ situacao: 'enviada' });
    const response = await POST(new Request('https://example.com/api/application/credenciamento-psicologo', {
      method: 'POST',
      body: JSON.stringify({ ...body,
        posGraduacaoViverMais: 'Pós-graduação em Psicologia Perinatal e Parentalidade',
        servicosPrestados: ['Orientação Parental'], temposAtendimento: [50, 90],
        publicoAlvo: ['Criança', 'Família'],
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: {
      servicosPrestados: ['Orientação Parental'], publicoAlvo: ['Criança', 'Família'],
    } });
  });

  it('recusa modalidade exclusiva do grupo B para Perinatal', async () => {
    const response = await POST(new Request('https://example.com/api/application/credenciamento-psicologo', {
      method: 'POST',
      body: JSON.stringify({ ...body,
        posGraduacaoViverMais: 'Pós-graduação em Psicologia Perinatal e Parentalidade',
        servicosPrestados: ['Orientação Vocacional'], temposAtendimento: [50], publicoAlvo: ['Mulheres'],
      }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
