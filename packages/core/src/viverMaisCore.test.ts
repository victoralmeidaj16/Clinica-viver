import { describe, expect, it } from 'vitest';
import {
  LeadTriagem,
  PsicologoPerfil,
  processarTriagemLead,
  checarEExecutarTransbordoSla,
  calcularSplit7030,
  gerarLinkCobrancaAsaas,
  processarWebhookPagamentoAsaas,
  confirmarContatoPsicologo,
  validarAcessoExclusivoPsicologo,
  calcularVencimentoCobranca,
  gerarMensagemCobrancaAtrasadaWhatsApp,
} from './index';

describe('Domínio Clínica Viver Mais Psicologia (Core Engine & Regras Giuliana)', () => {
  const psicologosMock: PsicologoPerfil[] = [
    {
      id: 'psi-1',
      nome: 'Dr. Lucas Silva',
      crp: '07/12345',
      telefoneWhatsApp: '51999990001',
      email: 'lucas@vivermais.com.br',
      turnosDisponiveis: ['MANHA', 'TARDE'],
      modalidadesAtendidas: ['ACESSIVEL_SOCIAL', 'PARTICULAR'],
      limitePacientesAtivos: 33,
      pacientesAtivosCount: 10,
      exibirNaVitrine: true,
      posicaoFilaRoundRobin: 1,
      ultimoLeadRecebidoEm: '2026-08-01T10:00:00.000Z',
      saldoCreditoAbatimento: 0,
    },
    {
      id: 'psi-2',
      nome: 'Dra. Mariana Costa',
      crp: '07/67890',
      telefoneWhatsApp: '51999990002',
      email: 'mariana@vivermais.com.br',
      turnosDisponiveis: ['TARDE', 'NOITE'],
      modalidadesAtendidas: ['ACESSIVEL_SOCIAL'],
      limitePacientesAtivos: 33,
      pacientesAtivosCount: 5,
      exibirNaVitrine: true,
      posicaoFilaRoundRobin: 2,
      ultimoLeadRecebidoEm: '2026-07-25T10:00:00.000Z',
      saldoCreditoAbatimento: 150.00,
    },
  ];

  const leadMock: LeadTriagem = {
    id: 'lead-101',
    nomePaciente: 'João Pedro',
    telefoneWhatsApp: '51988887777',
    cpf: '123.456.789-00',
    endereco: {
      logradouro: 'Rua das Flores',
      numero: '100',
      bairro: 'Centro',
      cidade: 'Porto Alegre',
      uf: 'RS',
      cep: '90000-000',
    },
    modalidade: 'ACESSIVEL_SOCIAL',
    turno: 'TARDE',
    origemLead: 'Site Viver Mais',
    criadoEm: '2026-08-05T08:00:00.000Z',
    status: 'AGUARDANDO_CONTATO',
    slaExpirado: false,
  };

  it('valida o sigilo estrito de dados entre psicólogos (Row-Level Access)', () => {
    // Dr. Lucas (psi-1) tentando acessar paciente do Dr. Lucas -> Permitido
    expect(validarAcessoExclusivoPsicologo('psi-1', 'psi-1')).toBe(true);

    // Dr. Lucas (psi-1) tentando acessar paciente da Dra. Mariana (psi-2) -> Negado!
    expect(validarAcessoExclusivoPsicologo('psi-1', 'psi-2')).toBe(false);

    // Gestora Giuliana (eGestor: true) -> Acesso total permitido
    expect(validarAcessoExclusivoPsicologo('psi-1', 'psi-2', true)).toBe(true);
  });

  it('calcula o vencimento da cobrança para 24h antes da consulta', () => {
    const dataSessao = '2026-08-10T14:00:00.000Z';
    const vencimento24h = calcularVencimentoCobranca(dataSessao, 'PRE_SESSAO_24H');

    const dataEsperada = new Date('2026-08-09T14:00:00.000Z').getTime();
    expect(new Date(vencimento24h).getTime()).toBe(dataEsperada);
  });

  it('gera mensagem automatizada da régua de cobrança em atraso via WhatsApp', () => {
    const cobranca = gerarLinkCobrancaAsaas({
      leadId: leadMock.id,
      pacienteNome: leadMock.nomePaciente,
      psicologo: psicologosMock[0],
      valorTotal: 75.00,
    });

    const mensagem = gerarMensagemCobrancaAtrasadaWhatsApp(leadMock.nomePaciente, cobranca);

    expect(mensagem).toContain('João Pedro');
    expect(mensagem).toContain('Dr. Lucas Silva');
    expect(mensagem).toContain('R$ 75,00');
    expect(mensagem).toContain('https://vivermais.com.br/p/PAY-');
  });

  it('aloca o lead na Fila Circular (Round-Robin) para o psicólogo com maior tempo de espera', () => {
    const resultado = processarTriagemLead(leadMock, psicologosMock);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.psicologoAlocado?.id).toBe('psi-2');
    expect(resultado.leadAtualizado.psicologoAlocadoId).toBe('psi-2');
  });

  it('calcula o split 70% / 30% corretamente para cobranças via Asaas', () => {
    const split = calcularSplit7030(100.00);

    expect(split.creditoAluno).toBe(70.00);
    expect(split.receitaClinica).toBe(30.00);
  });
});
