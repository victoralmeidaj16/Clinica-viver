import { describe, expect, it } from 'vitest';
import {
  LeadTriagem,
  PsicologoPerfil,
  processarTriagemLead,
  selecionarPsicologoRoundRobin,
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

  describe('Elegibilidade do rodízio', () => {
    /** Base de um psicólogo elegível; cada teste desliga só o que quer provar. */
    const perfilBase = (sobrescrever: Partial<PsicologoPerfil>): PsicologoPerfil => ({
      id: 'psi-base',
      nome: 'Dra. Mariana Costa',
      crp: '07/67890',
      telefoneWhatsApp: '51999990002',
      email: 'mariana@vivermais.com.br',
      turnosDisponiveis: ['TARDE'],
      modalidadesAtendidas: ['ACESSIVEL_SOCIAL'],
      limitePacientesAtivos: 33,
      pacientesAtivosCount: 0,
      exibirNaVitrine: true,
      posicaoFilaRoundRobin: 1,
      saldoCreditoAbatimento: 0,
      ...sobrescrever,
    });

    it('pula quem não é habilitado no serviço pedido', () => {
      const psicoterapeuta = perfilBase({ id: 'psi-a', servicosHabilitados: ['PSICOTERAPIA'] });
      const avaliador = perfilBase({ id: 'psi-b', servicosHabilitados: ['AVALIACAO'] });

      const escolhido = selecionarPsicologoRoundRobin(
        [psicoterapeuta, avaliador],
        'TARDE',
        'ACESSIVEL_SOCIAL',
        undefined,
        'AVALIACAO'
      );

      expect(escolhido?.id).toBe('psi-b');
    });

    it('mantém no rodízio quem não declarou serviços, porque a lista vazia é ausência de restrição', () => {
      const semDeclaracao = perfilBase({ id: 'psi-a', servicosHabilitados: [] });

      const escolhido = selecionarPsicologoRoundRobin(
        [semDeclaracao],
        'TARDE',
        'ACESSIVEL_SOCIAL',
        undefined,
        'AVALIACAO'
      );

      expect(escolhido?.id).toBe('psi-a');
    });

    it('não aloca para perfil desativado pela gestão', () => {
      const desativado = perfilBase({ id: 'psi-a', exibirNaVitrine: false });

      expect(selecionarPsicologoRoundRobin([desativado], 'TARDE', 'ACESSIVEL_SOCIAL')).toBeNull();
    });

    it('não aloca para quem atingiu o teto de pacientes ativos', () => {
      const noTeto = perfilBase({ id: 'psi-a', limitePacientesAtivos: 5, pacientesAtivosCount: 5 });

      expect(selecionarPsicologoRoundRobin([noTeto], 'TARDE', 'ACESSIVEL_SOCIAL')).toBeNull();
    });

    it('coloca quem nunca recebeu ninguém à frente de quem já recebeu', () => {
      const veterano = perfilBase({ id: 'psi-veterano', ultimoLeadRecebidoEm: '2026-08-01T10:00:00.000Z' });
      const estreante = perfilBase({ id: 'psi-estreante', ultimoLeadRecebidoEm: undefined });

      // Nas duas ordens de entrada, para provar que é a regra decidindo e não a
      // posição no array.
      expect(selecionarPsicologoRoundRobin([veterano, estreante], 'TARDE', 'ACESSIVEL_SOCIAL')?.id)
        .toBe('psi-estreante');
      expect(selecionarPsicologoRoundRobin([estreante, veterano], 'TARDE', 'ACESSIVEL_SOCIAL')?.id)
        .toBe('psi-estreante');
    });
  });

  describe('SLA de 24h e transbordo', () => {
    const horasAtras = (horas: number): string =>
      new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();

    const leadAlocado = (horas: number): LeadTriagem => ({
      ...leadMock,
      psicologoAlocadoId: 'psi-1',
      dataAlocacao: horasAtras(horas),
      status: 'AGUARDANDO_CONTATO',
    });

    it('não transborda lead ainda dentro do prazo', () => {
      const resultado = checarEExecutarTransbordoSla(leadAlocado(23), psicologosMock);

      expect(resultado.sucesso).toBe(false);
      expect(resultado.leadAtualizado.psicologoAlocadoId).toBe('psi-1');
      expect(resultado.leadAtualizado.slaExpirado).toBe(false);
    });

    it('passa o lead para outro profissional depois de 24h, nunca de volta para o mesmo', () => {
      const resultado = checarEExecutarTransbordoSla(leadAlocado(25), psicologosMock);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.leadAtualizado.psicologoAlocadoId).toBe('psi-2');
      expect(resultado.leadAtualizado.slaExpirado).toBe(true);
      // Prazo novo para quem acabou de receber.
      expect(resultado.leadAtualizado.status).toBe('AGUARDANDO_CONTATO');
    });

    it('não devolve o lead a quem já teve a chance nele', () => {
      const resultado = checarEExecutarTransbordoSla(leadAlocado(25), psicologosMock, 24, {
        psicologosJaTentados: ['psi-1', 'psi-2'],
      });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.psicologoAlocado).toBeUndefined();
    });

    it('sem ninguém para receber, o lead continua aguardando contato e marcado como estourado', () => {
      const resultado = checarEExecutarTransbordoSla(leadAlocado(25), [psicologosMock[0]]);

      expect(resultado.sucesso).toBe(false);
      // Continua na fila para a gestão ver — não some para um estado terminal.
      expect(resultado.leadAtualizado.status).toBe('AGUARDANDO_CONTATO');
      expect(resultado.leadAtualizado.psicologoAlocadoId).toBe('psi-1');
      expect(resultado.leadAtualizado.slaExpirado).toBe(true);
    });

    it('respeita o serviço pedido ao escolher para quem transbordar', () => {
      const psicologos: PsicologoPerfil[] = [
        { ...psicologosMock[0], servicosHabilitados: ['PSICOTERAPIA'] },
        { ...psicologosMock[1], servicosHabilitados: ['PSICOTERAPIA'] },
      ];

      const resultado = checarEExecutarTransbordoSla(leadAlocado(25), psicologos, 24, {
        servicoDesejado: 'AVALIACAO',
      });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.psicologoAlocado).toBeUndefined();
    });
  });
});
