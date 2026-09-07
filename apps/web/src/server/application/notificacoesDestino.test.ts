import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CaptureState } from '@/server/persistence/captureRepository';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import type { AgendamentoResumo } from '@/server/scheduling/agendaRepository';
import {
  notificacoesDaGestao,
  notificacoesDeAgendamentos,
  notificacoesDePagamento,
  notificacoesDePerfilAlterado,
  notificacoesDoPsicologo,
} from './notificacoes';

/**
 * O `href` de cada aviso é um contrato com a tela de destino: o `foco` que ele
 * carrega tem que ser exatamente o texto que a página escreve em `data-foco`.
 * Um aviso que aponta para o item errado leva quem clicou a agir sobre outro
 * paciente — por isso o destino é testado item a item, e não só a página.
 */

const AGORA = new Date('2026-09-07T18:00:00.000Z');

function destino(href: string) {
  const url = new URL(href, 'https://clinica.example');
  return {
    caminho: url.pathname,
    foco: url.searchParams.get('foco'),
    aba: url.searchParams.get('aba'),
    mes: url.searchParams.get('mes'),
  };
}

function lead(overrides: Partial<TriagemPacienteRecord> = {}): TriagemPacienteRecord {
  return {
    id: 'lead-1',
    protocolo: 'VM-0001',
    nomePaciente: 'Paciente Um',
    telefone: '11999990000',
    convenioSelecionado: 'Nenhum',
    origem: 'vitrine',
    turno: 'MANHA',
    status: 'AGUARDANDO_CONTATO',
    criadoEm: '2026-09-06T12:00:00.000Z',
    ...overrides,
  } as TriagemPacienteRecord;
}

function cadastro(overrides: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord {
  return {
    id: 'cad-1',
    nomeCompleto: 'Profissional Um',
    crp: '06/12345',
    whatsapp: '11988887777',
    status: 'APROVADO',
    criadoEm: '2026-08-01T12:00:00.000Z',
    modalidadesAtendidas: ['ONLINE'],
    turnosDisponiveis: ['MANHA'],
    ...overrides,
  } as CadastroPsicologoRecord;
}

function estado(overrides: Partial<CaptureState> = {}): CaptureState {
  return {
    triagensPacientes: [],
    cadastrosPsicologos: [],
    ...overrides,
  } as CaptureState;
}

describe('destino das notificações do psicólogo', () => {
  it('leva o contato confirmado ao paciente promovido', () => {
    const itens = notificacoesDoPsicologo(
      estado({
        triagensPacientes: [
          lead({
            status: 'CONTATO_CONFIRMADO',
            confirmadoEm: '2026-09-06T15:00:00.000Z',
            psicologoAlocadoId: 'cad-1',
            pacienteRef: 'pac-77',
          }),
        ],
      }),
      cadastro(),
      AGORA
    );

    const aviso = itens.find((item) => item.tipo === 'contato-confirmado');
    expect(destino(aviso!.href)).toMatchObject({
      caminho: '/pacientes',
      foco: 'paciente-pac-77',
    });
  });

  it('cai na lista inteira quando o lead ainda não virou paciente', () => {
    const itens = notificacoesDoPsicologo(
      estado({
        triagensPacientes: [
          lead({
            status: 'CONTATO_CONFIRMADO',
            confirmadoEm: '2026-09-06T15:00:00.000Z',
            psicologoAlocadoId: 'cad-1',
          }),
        ],
      }),
      cadastro(),
      AGORA
    );

    const aviso = itens.find((item) => item.tipo === 'contato-confirmado');
    expect(destino(aviso!.href).foco).toBe('secao-lista-pacientes');
  });

  it('leva o aviso de agenda à sessão citada', () => {
    const agendamento = {
      id: 'apt-9',
      pacienteNome: 'Paciente Um',
      inicio: '2026-09-05T13:00:00.000Z',
      fim: '2026-09-05T13:50:00.000Z',
      modalidade: 'online',
      status: 'agendado',
      origem: 'portal',
      criadoEm: '2026-09-01T10:00:00.000Z',
      linkPagamento: '/pagar/sessao/abc',
      custeadoPelaEmpresa: false,
      podeConfirmarRealizacao: true,
    } as AgendamentoResumo;

    const itens = notificacoesDeAgendamentos([agendamento], AGORA);

    expect(itens.map((item) => destino(item.href))).toEqual([
      { caminho: '/agenda', foco: 'sessao-apt-9', aba: null, mes: null },
      { caminho: '/agenda', foco: 'sessao-apt-9', aba: null, mes: null },
    ]);
    // A sessão já terminou: o aviso de confirmação precisa existir.
    expect(itens.map((item) => item.tipo)).toContain('confirmar-sessao');
  });

  it('abre o extrato na competência do pagamento, no fuso da clínica', () => {
    const [aviso] = notificacoesDePagamento([
      {
        // 31/08 às 22h em São Paulo é 01/09 em UTC: o extrato é agosto.
        ref: 'pag-5',
        patientName: 'Paciente Um',
        amountCents: 15_000,
        receivedAt: '2026-09-01T01:00:00.000Z',
        method: 'pix',
      },
    ]);

    expect(destino(aviso.href)).toMatchObject({
      caminho: '/meu-financeiro',
      foco: 'pagamento-pag-5',
      mes: '2026-08',
    });
  });

  it('separa o card de status do card da prática', () => {
    const incompleto = notificacoesDoPsicologo(
      estado(),
      cadastro({ modalidadesAtendidas: [], turnosDisponiveis: [] }),
      AGORA
    );
    expect(destino(incompleto.find((i) => i.tipo === 'cadastro-incompleto')!.href)).toMatchObject({
      caminho: '/meu-cadastro',
      foco: 'secao-minha-pratica',
    });
    expect(
      destino(incompleto.find((i) => i.tipo === 'credenciamento-aprovado')!.href).foco
    ).toBe('secao-status-credenciamento');

    const pausado = notificacoesDoPsicologo(
      estado(),
      cadastro({ pausadoNoRodizio: true }),
      AGORA
    );
    expect(destino(pausado.find((i) => i.tipo === 'rodizio-pausado')!.href).foco).toBe(
      'secao-status-credenciamento'
    );
  });
});

describe('destino das notificações da gestão', () => {
  it('leva os avisos da fila ao lead, na aba da fila', () => {
    const itens = notificacoesDaGestao(
      estado({
        triagensPacientes: [
          lead({ id: 'lead-sem', status: 'PENDENTE_ATRIBUICAO' }),
          lead({
            id: 'lead-atrasado',
            status: 'AGUARDANDO_CONTATO',
            alocadoEm: '2026-09-05T12:00:00.000Z',
            psicologoNome: 'Profissional Um',
          }),
        ],
      }),
      AGORA
    );

    const semProfissional = itens.find((i) => i.tipo === 'lead-sem-profissional');
    expect(destino(semProfissional!.href)).toMatchObject({
      caminho: '/gestao/cockpit',
      aba: 'fila',
      foco: 'lead-lead-sem',
    });

    const estourado = itens.find((i) => i.tipo === 'sla-estourado');
    expect(destino(estourado!.href)).toMatchObject({ aba: 'fila', foco: 'lead-lead-atrasado' });
  });

  it('abre a candidatura na aba de credenciamentos', () => {
    const itens = notificacoesDaGestao(
      estado({ cadastrosPsicologos: [cadastro({ id: 'cad-9', status: 'EM_ANALISE' })] }),
      AGORA
    );

    const aviso = itens.find((i) => i.tipo === 'credenciamento-em-analise');
    expect(destino(aviso!.href)).toMatchObject({
      caminho: '/gestao/cockpit',
      aba: 'credenciamentos',
      foco: 'credenciamento-cad-9',
    });
  });

  it('leva os avisos de perfil ao profissional na lista da gestão', () => {
    const semCriterios = notificacoesDaGestao(
      estado({
        cadastrosPsicologos: [
          cadastro({ id: 'cad-3', modalidadesAtendidas: [], turnosDisponiveis: [] }),
        ],
      }),
      AGORA
    );
    expect(destino(semCriterios.find((i) => i.tipo === 'aprovado-sem-criterios')!.href)).toMatchObject(
      { caminho: '/gestao/psicologos', foco: 'psicologo-cad-3' }
    );

    const [alterado] = notificacoesDePerfilAlterado([
      {
        cadastroRef: 'cad-4',
        psicologoNome: 'Profissional Dois',
        alteradoEm: '2026-09-06T10:00:00.000Z',
        mudancas: [
          { campo: 'turnosDisponiveis', rotulo: 'Turnos', de: 'manhã', para: 'manhã, noite' },
        ],
      },
    ]);
    expect(destino(alterado.href)).toMatchObject({
      caminho: '/gestao/psicologos',
      foco: 'psicologo-cad-4',
    });
  });
});
