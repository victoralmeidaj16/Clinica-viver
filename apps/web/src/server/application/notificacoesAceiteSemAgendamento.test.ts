import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import { notificacoesDaGestao, notificacoesDeAceiteSemAgendamento } from './notificacoes';

/**
 * Especificação final, 7.03: 48h depois do aceite sem primeiro agendamento, a
 * Gestão é avisada. O paciente continua ativo e não é redistribuído.
 */

const ACEITO_EM = '2026-11-10T12:00:00.000Z';
const DEPOIS_DE_48H = new Date('2026-11-12T12:30:00.000Z');
const ANTES_DE_48H = new Date('2026-11-12T11:00:00.000Z');

const psicologo: CadastroPsicologoRecord = {
  id: 'psi-1',
  nomeCompleto: 'Profissional Fictício',
  crp: '00/00000',
  whatsapp: '',
  status: 'APROVADO',
  criadoEm: '2026-01-01T00:00:00.000Z',
  profissionalRef: 'prof-1',
};

const aceito: TriagemPacienteRecord = {
  id: 'lead-1',
  protocolo: 'VM-TESTE-48',
  nomePaciente: 'Paciente Fictício',
  telefone: '5500000000000',
  convenioSelecionado: 'Nenhum',
  origem: 'Vitrine',
  turno: 'MANHA',
  status: 'AGUARDANDO_CONTATO',
  criadoEm: '2026-11-10T10:00:00.000Z',
  alocadoEm: '2026-11-10T10:00:00.000Z',
  aceitoEm: ACEITO_EM,
  psicologoAlocadoId: 'psi-1',
  psicologoNome: 'Profissional Fictício',
  pacienteRef: 'pac-1',
};

const estado = (lead: TriagemPacienteRecord = aceito) => ({ triagensPacientes: [lead], cadastrosPsicologos: [psicologo] });

describe('aviso de aceite sem primeiro agendamento', () => {
  it('avisa a Gestão quando passam 48h do aceite sem agendamento', () => {
    const itens = notificacoesDeAceiteSemAgendamento(estado(), [], DEPOIS_DE_48H);

    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({
      chave: `aceite-sem-agendamento:lead-1:${ACEITO_EM}`,
      tipo: 'aceite-sem-agendamento',
      titulo: 'Paciente aceito sem primeiro agendamento',
      pendente: true,
    });
    expect(itens[0].descricao).toContain('Profissional Fictício');
  });

  it('não avisa antes de 48h', () => {
    expect(notificacoesDeAceiteSemAgendamento(estado(), [], ANTES_DE_48H)).toEqual([]);
  });

  it('não avisa quando o profissional do vínculo já agendou depois do aceite', () => {
    const agendamentos = [{ pacienteRef: 'pac-1', profissionalRef: 'prof-1', criadoEm: '2026-11-11T09:00:00.000Z' }];
    expect(notificacoesDeAceiteSemAgendamento(estado(), agendamentos, DEPOIS_DE_48H)).toEqual([]);
  });

  it('agendamento antigo ou de outro profissional não conta como primeiro agendamento deste vínculo', () => {
    const agendamentos = [
      { pacienteRef: 'pac-1', profissionalRef: 'prof-1', criadoEm: '2026-10-01T09:00:00.000Z' },
      { pacienteRef: 'pac-1', profissionalRef: 'prof-outro', criadoEm: '2026-11-11T09:00:00.000Z' },
    ];
    expect(notificacoesDeAceiteSemAgendamento(estado(), agendamentos, DEPOIS_DE_48H)).toHaveLength(1);
  });

  it('não avisa sobre vínculo encerrado', () => {
    const desistente = { ...aceito, status: 'DESISTENTE' as const };
    expect(notificacoesDeAceiteSemAgendamento(estado(desistente), [], DEPOIS_DE_48H)).toEqual([]);
  });

  it('o prazo da oferta deixa de aparecer como vencido depois do aceite', () => {
    const itens = notificacoesDaGestao(estado(), DEPOIS_DE_48H);
    expect(itens.some((item) => item.tipo === 'sla-estourado' || item.tipo === 'sla-em-risco')).toBe(false);
  });
});

describe('sino do psicólogo depois do aceite', () => {
  it('não cobra mais o prazo de 24h da oferta', async () => {
    const { notificacoesDoPsicologo } = await import('./notificacoes');
    const [item] = notificacoesDoPsicologo(estado(), psicologo, DEPOIS_DE_48H)
      .filter((aviso) => aviso.tipo === 'paciente-atribuido');

    expect(item.severidade).toBe('INFO');
    expect(item.descricao).not.toContain('prazo');
    expect(item.descricao).toContain('primeiro horário');
  });
});
