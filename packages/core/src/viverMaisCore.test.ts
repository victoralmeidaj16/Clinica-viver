import { describe, expect, it } from 'vitest';
import {
  LeadTriagem,
  PsicologoPerfil,
  processarTriagemLead,
  selecionarPsicologoRoundRobin,
  ordenarPsicologosRoundRobin,
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

  it('considera qualquer período selecionado e mantém a ordem do rodízio', () => {
    const resultado = processarTriagemLead({ ...leadMock, turno: ['MANHA', 'NOITE'] }, psicologosMock);
    expect(resultado.psicologoAlocado?.id).toBe('psi-2');
    expect(resultado.leadAtualizado.turno).toEqual(['MANHA', 'NOITE']);
    expect(processarTriagemLead({ ...leadMock, turno: [] }, psicologosMock).sucesso).toBe(false);
    expect(processarTriagemLead({ ...leadMock, turno: ['NOITE'] }, [psicologosMock[0]]).sucesso).toBe(false);
  });

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
    expect(mensagem).toContain('https://vivermaispsicologia.com.br/cobranca/PAY-');
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
    expect(calcularSplit7030(0.45)).toEqual({ creditoAluno: 0.32, receitaClinica: 0.13 });
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
        { servicoDesejado: 'AVALIACAO' }
      );

      expect(escolhido?.id).toBe('psi-b');
    });

    it('mantém no rodízio quem não declarou serviços, porque a lista vazia é ausência de restrição', () => {
      const semDeclaracao = perfilBase({ id: 'psi-a', servicosHabilitados: [] });

      const escolhido = selecionarPsicologoRoundRobin([semDeclaracao], 'TARDE', 'ACESSIVEL_SOCIAL', {
        servicoDesejado: 'AVALIACAO',
      });

      expect(escolhido?.id).toBe('psi-a');
    });

    it('não aloca para quem a gestão pausou no rodízio', () => {
      const pausado = perfilBase({ id: 'psi-a', pausadoNoRodizio: true });

      expect(selecionarPsicologoRoundRobin([pausado], 'TARDE', 'ACESSIVEL_SOCIAL')).toBeNull();
    });

    /**
     * O outro sentido da separação, e o que ela existe para permitir: sair do
     * site público não é o mesmo que parar de atender. Antes um único booleano
     * respondia às duas perguntas, e tirar o perfil da vitrine cortava os
     * encaminhamentos junto.
     */
    it('continua alocando para quem saiu da vitrine mas não foi pausado', () => {
      const foraDaVitrine = perfilBase({
        id: 'psi-a',
        exibirNaVitrine: false,
        pausadoNoRodizio: false,
      });

      expect(selecionarPsicologoRoundRobin([foraDaVitrine], 'TARDE', 'ACESSIVEL_SOCIAL')?.id)
        .toBe('psi-a');
    });

    it('continua alocando para quem está na vitrine sem pausa declarada', () => {
      const normal = perfilBase({ id: 'psi-a' });

      expect(selecionarPsicologoRoundRobin([normal], 'TARDE', 'ACESSIVEL_SOCIAL')?.id).toBe('psi-a');
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

    describe('ordem do rodízio (especificação 5.01)', () => {
      it('prioriza quem tem menos pacientes ativos antes do tempo sem receber', () => {
        const comUm = perfilBase({ id: 'psi-um', pacientesAtivosCount: 1, ultimoLeadRecebidoEm: '2026-01-01T10:00:00.000Z' });
        const semNenhum = perfilBase({ id: 'psi-zero', pacientesAtivosCount: 0, ultimoLeadRecebidoEm: '2026-08-01T10:00:00.000Z' });
        const comDois = perfilBase({ id: 'psi-dois', pacientesAtivosCount: 2, ultimoLeadRecebidoEm: undefined });

        expect(selecionarPsicologoRoundRobin([comDois, comUm, semNenhum], 'TARDE', 'ACESSIVEL_SOCIAL')?.id)
          .toBe('psi-zero');
        expect(ordenarPsicologosRoundRobin([comDois, comUm, semNenhum]).map((p) => p.id))
          .toEqual(['psi-zero', 'psi-um', 'psi-dois']);
      });

      it('no empate de ativos, escolhe quem está há mais tempo sem receber', () => {
        const recente = perfilBase({ id: 'psi-recente', pacientesAtivosCount: 1, ultimoLeadRecebidoEm: '2026-08-01T10:00:00.000Z' });
        const antigo = perfilBase({ id: 'psi-antigo', pacientesAtivosCount: 1, ultimoLeadRecebidoEm: '2026-07-01T10:00:00.000Z' });

        expect(selecionarPsicologoRoundRobin([recente, antigo], 'TARDE', 'ACESSIVEL_SOCIAL')?.id)
          .toBe('psi-antigo');
      });

      it('sorteia somente entre os empatados em todos os critérios', () => {
        const data = '2026-07-01T10:00:00.000Z';
        const a = perfilBase({ id: 'psi-a', pacientesAtivosCount: 1, ultimoLeadRecebidoEm: data });
        const b = perfilBase({ id: 'psi-b', pacientesAtivosCount: 1, ultimoLeadRecebidoEm: data });
        const fora = perfilBase({ id: 'psi-fora', pacientesAtivosCount: 2, ultimoLeadRecebidoEm: undefined });
        const sorteios: number[] = [];
        const sortear = (quantidade: number) => { sorteios.push(quantidade); return quantidade - 1; };

        expect(selecionarPsicologoRoundRobin([a, b, fora], 'TARDE', 'ACESSIVEL_SOCIAL', { sortear })?.id)
          .toBe('psi-b');
        expect(sorteios).toEqual([2]);
      });

      it('não sorteia quando só um profissional lidera a ordem', () => {
        const sortear = () => { throw new Error('não deveria sortear'); };
        const unico = perfilBase({ id: 'psi-unico', pacientesAtivosCount: 0 });
        const outro = perfilBase({ id: 'psi-outro', pacientesAtivosCount: 3 });

        expect(selecionarPsicologoRoundRobin([outro, unico], 'TARDE', 'ACESSIVEL_SOCIAL', { sortear })?.id)
          .toBe('psi-unico');
      });
    });

    /**
     * O pedido do paciente vence a ordem da fila. É o único critério que pode
     * fazer alguém "furar" a vez de quem esperou mais — e é intencional: a
     * pessoa disse com quem quer se abrir.
     */
    describe('preferência de gênero do profissional', () => {
      const psicologo = perfilBase({
        id: 'psi-homem',
        genero: 'MASCULINO',
        ultimoLeadRecebidoEm: undefined,
      });
      const psicologa = perfilBase({
        id: 'psi-mulher',
        genero: 'FEMININO',
        ultimoLeadRecebidoEm: '2026-09-01T10:00:00.000Z',
      });

      it('escolhe quem atende à preferência mesmo estando atrás na fila', () => {
        const escolhido = selecionarPsicologoRoundRobin(
          [psicologo, psicologa],
          'TARDE',
          'ACESSIVEL_SOCIAL',
          { preferenciaGeneroPsicologo: 'FEMININO' }
        );

        expect(escolhido?.id).toBe('psi-mulher');
      });

      it('sem preferência declarada, volta a valer só a ordem da fila', () => {
        const semPreferencia = selecionarPsicologoRoundRobin(
          [psicologo, psicologa],
          'TARDE',
          'ACESSIVEL_SOCIAL',
          { preferenciaGeneroPsicologo: 'SEM_PREFERENCIA' }
        );
        const semOCampo = selecionarPsicologoRoundRobin(
          [psicologo, psicologa],
          'TARDE',
          'ACESSIVEL_SOCIAL'
        );

        expect(semPreferencia?.id).toBe('psi-homem');
        expect(semOCampo?.id).toBe('psi-homem');
      });

      /**
       * Falha fechada: sem ninguém do gênero pedido, o lead fica pendente para
       * a gestão em vez de ir para alguém que contraria o pedido.
       */
      it('devolve null quando ninguém atende à preferência', () => {
        expect(
          selecionarPsicologoRoundRobin([psicologo], 'TARDE', 'ACESSIVEL_SOCIAL', {
            preferenciaGeneroPsicologo: 'FEMININO',
          })
        ).toBeNull();
      });

      it('deixa de fora quem não declarou gênero enquanto há preferência', () => {
        const semGenero = perfilBase({ id: 'psi-sem-genero', genero: undefined });

        expect(
          selecionarPsicologoRoundRobin([semGenero], 'TARDE', 'ACESSIVEL_SOCIAL', {
            preferenciaGeneroPsicologo: 'FEMININO',
          })
        ).toBeNull();
        expect(selecionarPsicologoRoundRobin([semGenero], 'TARDE', 'ACESSIVEL_SOCIAL')?.id)
          .toBe('psi-sem-genero');
      });
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

    it('preserva formato, abordagem e duração ao escolher para quem transbordar', () => {
      const candidatoIncompativel = {
        ...psicologosMock[1],
        id: 'psi-incompativel',
        pacientesAtivosCount: 0,
        ultimoLeadRecebidoEm: undefined,
        modalidadeAtendimento: 'PRESENCIAL',
        posGraduacaoViverMais: 'Programa de Estudos e Pós-graduação em Psicanálise',
        temposAtendimento: [50],
      };
      const candidatoCompativel = {
        ...psicologosMock[1],
        id: 'psi-compativel',
        pacientesAtivosCount: 1,
        modalidadeAtendimento: 'ONLINE',
        posGraduacaoViverMais: 'Formação e Pós-graduação em Terapia Cognitivo-Comportamental',
        temposAtendimento: [50, 90],
      };

      const resultado = checarEExecutarTransbordoSla(
        {
          ...leadAlocado(25),
          formatoAtendimento: 'ONLINE',
          abordagemDesejada: 'TCC',
          duracaoDesejadaMinutos: 90,
        },
        [psicologosMock[0], candidatoIncompativel, candidatoCompativel]
      );

      expect(resultado.sucesso).toBe(true);
      expect(resultado.psicologoAlocado?.id).toBe('psi-compativel');
    });
  });

  describe('Critérios de formato, abordagem e duração (§§ 3.12, 4.03 e 5.01)', () => {
    const base = (sobrescrever: Partial<PsicologoPerfil>): PsicologoPerfil => ({
      id: 'psi-base',
      nome: 'Dra. Teste',
      crp: '07/00001',
      telefoneWhatsApp: '51999990000',
      email: 'teste@example.com',
      turnosDisponiveis: ['TARDE'],
      modalidadesAtendidas: ['ACESSIVEL_SOCIAL', 'PARTICULAR'],
      limitePacientesAtivos: 5,
      pacientesAtivosCount: 0,
      exibirNaVitrine: true,
      posicaoFilaRoundRobin: 1,
      saldoCreditoAbatimento: 0,
      ...sobrescrever,
    });

    it('filtra formato on-line, presencial e híbrido/ambos, mantendo indiferente livre', () => {
      const soOnline = base({ id: 'psi-online', modalidadeAtendimento: 'ONLINE' });
      const soPresencial = base({ id: 'psi-presencial', modalidadeAtendimento: 'PRESENCIAL' });
      const hibrido = base({ id: 'psi-hibrido', modalidadeAtendimento: 'Híbrido' });

      expect(
        selecionarPsicologoRoundRobin([soPresencial, soOnline], 'TARDE', 'PARTICULAR', {
          formatoDesejado: 'ONLINE',
        })?.id
      ).toBe('psi-online');
      expect(
        selecionarPsicologoRoundRobin([soOnline, soPresencial], 'TARDE', 'PARTICULAR', {
          formatoDesejado: 'PRESENCIAL',
        })?.id
      ).toBe('psi-presencial');
      expect(
        selecionarPsicologoRoundRobin([soOnline, hibrido], 'TARDE', 'PARTICULAR', {
          formatoDesejado: 'PRESENCIAL',
        })?.id
      ).toBe('psi-hibrido');
      expect(
        selecionarPsicologoRoundRobin([soPresencial], 'TARDE', 'PARTICULAR', {
          formatoDesejado: 'INDIFERENTE',
        })?.id
      ).toBe('psi-presencial');
    });

    it('filtra por abordagem considerando acentos, alias TCC e segunda pós', () => {
      const psicanalise = base({
        id: 'psi-psicanalise',
        posGraduacaoViverMais: 'Programa de Estudos e Pós-graduação em Psicanálise',
      });
      const tccSegundaPos = base({
        id: 'psi-tcc',
        posGraduacaoViverMais: 'Formação e Pós-graduação em Psicodrama',
        outrasPosGraduacoes: ['Formação e Pós-graduação em Terapia Cognitivo-Comportamental'],
      });
      const junguiana = base({ id: 'psi-jung', abordagem: 'Junguiana' });

      expect(
        selecionarPsicologoRoundRobin([psicanalise, tccSegundaPos], 'TARDE', 'PARTICULAR', {
          abordagemDesejada: 'TCC',
        })?.id
      ).toBe('psi-tcc');
      expect(
        selecionarPsicologoRoundRobin([junguiana, psicanalise], 'TARDE', 'PARTICULAR', {
          abordagemDesejada: 'Psicanalise',
        })?.id
      ).toBe('psi-psicanalise');
    });

    it('filtra por duração de 50 ou 90 minutos conforme serviço/público e isenta Avaliação', () => {
      const so50 = base({ id: 'psi-50', temposAtendimento: [50] });
      const so90 = base({ id: 'psi-90', temposAtendimento: [90] });
      const com90 = base({ id: 'psi-50-90', temposAtendimento: [50, 90] });
      const avaliacaoSemTempo = base({ id: 'psi-av', servicosHabilitados: ['AVALIACAO'], temposAtendimento: [] });

      expect(
        selecionarPsicologoRoundRobin([so50, com90], 'TARDE', 'PARTICULAR', {
          servicoDesejado: 'ORIENTACAO_PARENTAL',
          paraQuemE: 'Família',
        })?.id
      ).toBe('psi-50-90');
      expect(
        selecionarPsicologoRoundRobin([so90, so50], 'TARDE', 'PARTICULAR', {
          servicoDesejado: 'PSICOTERAPIA',
          paraQuemE: 'Adulto',
          duracaoDesejadaMinutos: 50,
        })?.id
      ).toBe('psi-50');
      expect(
        selecionarPsicologoRoundRobin([so50], 'TARDE', 'PARTICULAR', {
          servicoDesejado: 'PSICOTERAPIA_CASAL',
        })
      ).toBeNull();
      expect(
        selecionarPsicologoRoundRobin([avaliacaoSemTempo], 'TARDE', 'PARTICULAR', {
          servicoDesejado: 'AVALIACAO',
        })?.id
      ).toBe('psi-av');
    });
  });
});
