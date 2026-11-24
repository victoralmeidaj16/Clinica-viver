import { describe, expect, it } from 'vitest';
import { expiracaoDaOferta, prazoDaOferta, prazoOfertaValido, rotuloPrazo } from './prazoOferta';
import {
  pacienteMenorDeIdade,
  pagadorDoAtendimento,
  responsavelDoPrimeiroContato,
  validarResponsavelFinanceiro,
} from './responsavelFinanceiro';
import { tipoColetivoDoPedido, validarVinculoColetivo } from './vinculoColetivo';
import { historicoAdministrativoDoPedido } from './historicoCpf';
import { validarAlteracaoPreferencias } from './preferenciasSolicitacao';
import { validarSubmissaoTriagem } from './triagemSubmissao';

const CPF_PACIENTE = '52998224725';
const CPF_RESPONSAVEL = '11144477735';

describe('prazo da oferta (§ 5.02)', () => {
  it('aceita só horas inteiras de 1 a 168 e cai em 24 sem valor', () => {
    expect(prazoOfertaValido(48)).toBe(48);
    expect(prazoOfertaValido('12')).toBe(12);
    expect(prazoOfertaValido(0)).toBeNull();
    expect(prazoOfertaValido(169)).toBeNull();
    expect(prazoOfertaValido(1.5)).toBeNull();
    expect(prazoDaOferta({})).toBe(24);
  });

  it('mostra prazos longos também em dias e calcula o vencimento', () => {
    expect(rotuloPrazo(1)).toBe('1 hora');
    expect(rotuloPrazo(24)).toBe('24 horas');
    expect(rotuloPrazo(48)).toBe('48 horas (2 dias)');
    expect(rotuloPrazo(36)).toBe('36 horas (1 dia e 12 horas)');
    expect(expiracaoDaOferta({ alocadoEm: '2026-11-23T10:00:00.000Z', prazoRespostaHoras: 48 })).toBe('2026-11-25T10:00:00.000Z');
  });
});

describe('responsável financeiro (§§ 6.03 e 6.04)', () => {
  it('reconhece criança ou adolescente pela data, pela idade ou pelo público', () => {
    const agora = new Date('2026-11-23T12:00:00.000Z');
    expect(pacienteMenorDeIdade({ dataNascimento: '2010-01-01' }, agora)).toBe(true);
    expect(pacienteMenorDeIdade({ dataNascimento: '2008-11-23' }, agora)).toBe(false);
    expect(pacienteMenorDeIdade({ idade: '17' }, agora)).toBe(true);
    expect(pacienteMenorDeIdade({ paraQuemE: 'Infantil' }, agora)).toBe(true);
    expect(pacienteMenorDeIdade({ paraQuemE: 'Individual' }, agora)).toBe(false);
  });

  it('valida nome e CPF e exige o que o fluxo precisar', () => {
    expect(validarResponsavelFinanceiro({ nome: 'Responsável Fictício', cpf: '123' }).ok).toBe(false);
    expect(validarResponsavelFinanceiro({ nome: 'Responsável Fictício', cpf: CPF_RESPONSAVEL }, { email: true })).toMatchObject({ ok: false });
    expect(validarResponsavelFinanceiro({
      nome: '  Responsável   Fictício ', cpf: '111.444.777-35', telefone: '(48) 98888-0000',
    })).toMatchObject({ ok: true, responsavel: { nome: 'Responsável Fictício', cpf: CPF_RESPONSAVEL, telefone: '48988880000' } });
  });

  it('usa o responsável inteiro como pagador e como primeiro contato só fora do coletivo', () => {
    const responsavel = { nome: 'Responsável Fictício', cpf: CPF_RESPONSAVEL, email: 'resp@example.com' };
    expect(pagadorDoAtendimento({ nome: 'Menor Fictício', cpf: CPF_PACIENTE, email: 'menor@example.com' }, responsavel))
      .toEqual({ nome: 'Responsável Fictício', cpf: CPF_RESPONSAVEL, email: 'resp@example.com', telefone: undefined, origem: 'RESPONSAVEL' });
    expect(pagadorDoAtendimento({ nome: 'Paciente', cpf: CPF_PACIENTE })).toMatchObject({ origem: 'PACIENTE', cpf: CPF_PACIENTE });
    expect(responsavelDoPrimeiroContato({ responsavelFinanceiro: responsavel })).toBe(responsavel);
    expect(responsavelDoPrimeiroContato({ responsavelFinanceiro: responsavel, vinculoColetivo: { tipo: 'CASAL' } })).toBeUndefined();
  });
});

describe('vínculo coletivo (§ 6.04)', () => {
  it('detecta casal, família e grupo pelo pedido', () => {
    expect(tipoColetivoDoPedido({ servicoKey: 'PSICOTERAPIA_CASAL' })).toBe('CASAL');
    expect(tipoColetivoDoPedido({ modalidade: 'FAMILIA_SOCIAL' })).toBe('FAMILIA');
    expect(tipoColetivoDoPedido({ paraQuemE: 'Grupo' })).toBe('GRUPO');
    expect(tipoColetivoDoPedido({ paraQuemE: 'Individual', modalidade: 'SOCIAL' })).toBeUndefined();
  });

  it('valida participantes, CPF repetido e o mínimo pedido', () => {
    const base = { tipo: 'CASAL', participantes: [{ nome: 'Pessoa Um', cpf: CPF_PACIENTE }, { nome: 'Pessoa Dois' }] };
    expect(validarVinculoColetivo(base, { minimoParticipantes: 2 })).toMatchObject({ ok: true });
    expect(validarVinculoColetivo({ ...base, participantes: [base.participantes[0]] }, { minimoParticipantes: 2 }).ok).toBe(false);
    expect(validarVinculoColetivo({ ...base, participantes: [base.participantes[0], { nome: 'Outra', cpf: CPF_PACIENTE }] }).ok).toBe(false);
  });
});

describe('histórico administrativo por vínculo (§§ 6.03, 6.04 e 6.09)', () => {
  const triagens = [
    { id: 'menor-1', protocolo: 'A', criadoEm: '2026-11-01T00:00:00Z', status: 'CONTATO_CONFIRMADO', nomePaciente: 'Menor Fictício',
      identificadoPeloResponsavel: true, responsavelFinanceiro: { cpf: CPF_RESPONSAVEL } },
    { id: 'menor-2', protocolo: 'B', criadoEm: '2026-11-10T00:00:00Z', status: 'PENDENTE_ATRIBUICAO', nomePaciente: 'menor ficticio',
      identificadoPeloResponsavel: true, responsavelFinanceiro: { cpf: CPF_RESPONSAVEL } },
    { id: 'responsavel', protocolo: 'C', criadoEm: '2026-11-05T00:00:00Z', status: 'CONTATO_CONFIRMADO', cpf: CPF_RESPONSAVEL },
    { id: 'casal', protocolo: 'D', criadoEm: '2026-11-06T00:00:00Z', status: 'CONTATO_CONFIRMADO',
      vinculoColetivo: { participantes: [{ cpf: CPF_RESPONSAVEL }, { cpf: CPF_PACIENTE }] } },
  ];

  it('não mistura o histórico do menor com o do responsável', () => {
    expect(historicoAdministrativoDoPedido(triagens, triagens[0]).map((item) => item.leadId)).toEqual(['menor-2', 'menor-1']);
  });

  it('mostra o vínculo coletivo no histórico de cada participante', () => {
    expect(historicoAdministrativoDoPedido(triagens, triagens[2]).map((item) => item.leadId)).toEqual(['casal', 'responsavel']);
  });
});

describe('alteração de preferências (§ 4.04)', () => {
  it('valida só os campos enviados', () => {
    expect(validarAlteracaoPreferencias({ preferencias: { turno: [] } }).ok).toBe(false);
    expect(validarAlteracaoPreferencias({ preferencias: { duracaoSessaoMinutos: 60 } }).ok).toBe(false);
    expect(validarAlteracaoPreferencias({ preferencias: { turno: ['NOITE', 'MANHA'], preferenciaGeneroPsicologo: 'SEM_PREFERENCIA' }, motivo: ' ok ' }))
      .toEqual({ ok: true, valores: { turno: 'MANHA,NOITE', preferenciaGeneroPsicologo: undefined }, motivo: 'ok' });
  });
});

describe('menor na solicitação do site (§ 6.03 e seção 15)', () => {
  const corpo = {
    nome: 'Menor Fictício', whatsapp: '(48) 98888-0000', genero: 'FEMININO', turno: 'TARDE',
    servicoKey: 'PSICOTERAPIA', modalidade: 'SOCIAL', paraQuemE: 'Infantil', cpf: CPF_PACIENTE,
  };
  const opcoes = { exigirCompatibilidadeVitrine: true, exigirResponsavelDeMenor: true };

  it('exige o responsável para criança ou adolescente', () => {
    expect(validarSubmissaoTriagem(corpo, opcoes)).toMatchObject({ ok: false, erro: expect.stringContaining('responsável') });
  });

  it('identifica o menor sem CPF pelo CPF do responsável', () => {
    const resultado = validarSubmissaoTriagem({
      ...corpo, cpf: '', menorSemCpf: true, responsavelFinanceiro: { nome: 'Responsável Fictício', cpf: CPF_RESPONSAVEL },
    }, opcoes);
    expect(resultado).toMatchObject({ ok: true, dados: { identificadoPeloResponsavel: true, responsavelFinanceiro: { cpf: CPF_RESPONSAVEL } } });
    if (resultado.ok) expect(resultado.dados.cpf).toBeUndefined();
  });

  it('recusa CPF do responsável igual ao do paciente e menor sem CPF para adulto', () => {
    expect(validarSubmissaoTriagem({ ...corpo, responsavelFinanceiro: { nome: 'Responsável Fictício', cpf: CPF_PACIENTE } }, opcoes).ok).toBe(false);
    expect(validarSubmissaoTriagem({ ...corpo, paraQuemE: 'Individual', menorSemCpf: true,
      responsavelFinanceiro: { nome: 'Responsável Fictício', cpf: CPF_RESPONSAVEL } }, opcoes).ok).toBe(false);
  });
});
