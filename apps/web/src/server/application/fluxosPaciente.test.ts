import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord, PersistedSnapshot, TriagemPacienteRecord } from './persistence';
import {
  aceitarPaciente,
  alocarLead,
  classificarSla,
  encaminharParaProximo,
  ofertaExpirada,
} from './viverMaisRodizio';
import {
  alterarListaDeEspera,
  colocarNaListaDeEspera,
  processarListaDeEspera,
  retirarDaListaDeEspera,
} from './listaEspera';
import { inativarVinculo, reativarVinculo } from './inativacaoVinculo';
import { alterarPreferenciasDoPedido } from './preferenciasPedido';
import { normalizarPedidoColetivo } from './pedidoColetivo';

const GESTAO = { usuarioRef: 'user-gestao', nome: 'Gestão Fictícia' };

function psi(id: string, extras: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord {
  return {
    id,
    nomeCompleto: `Profissional ${id}`,
    crp: '00/00001',
    whatsapp: '48999990000',
    status: 'APROVADO',
    criadoEm: '2026-10-01T10:00:00.000Z',
    turnosDisponiveis: ['TARDE'],
    modalidadesAtendidas: ['PARTICULAR'],
    servicosHabilitados: ['PSICOTERAPIA'],
    publicoAlvo: ['Adulto'],
    limitePacientesAtivos: 5,
    ...extras,
  };
}

function lead(id: string, extras: Partial<TriagemPacienteRecord> = {}): TriagemPacienteRecord {
  return {
    id,
    protocolo: `VM-${id}`,
    nomePaciente: `Paciente ${id}`,
    telefone: '48988880000',
    convenioSelecionado: 'Nenhum',
    origem: 'Site',
    turno: 'TARDE',
    modalidade: 'PARTICULAR',
    servicoKey: 'PSICOTERAPIA',
    paraQuemE: 'Adulto',
    status: 'PENDENTE_ATRIBUICAO',
    criadoEm: '2026-11-20T12:00:00.000Z',
    ...extras,
  };
}

function snapshot(
  cadastrosPsicologos: CadastroPsicologoRecord[],
  triagensPacientes: TriagemPacienteRecord[],
  extras: Partial<PersistedSnapshot> = {},
): PersistedSnapshot {
  return {
    version: 1,
    savedAt: '2026-11-23T12:00:00.000Z',
    appointments: [], sessions: [], records: [], timeline: [], notifications: [],
    ledger: { charges: [], discounts: [], payments: [], refunds: [], fees: [], transfers: [] },
    deliveredHandoffs: [], assessments: [], preferences: [], consents: [],
    cadastrosPsicologos,
    triagensPacientes,
    ...extras,
  };
}

/** Paciente que já ocupa vaga do psicólogo. */
function ativo(id: string, psicologoId: string): TriagemPacienteRecord {
  return lead(id, {
    status: 'CONTATO_CONFIRMADO', psicologoAlocadoId: psicologoId, pacienteRef: `paciente-${id}`,
    alocadoEm: '2026-11-01T12:00:00.000Z', aceitoEm: '2026-11-01T13:00:00.000Z', confirmadoEm: '2026-11-01T14:00:00.000Z',
  });
}

describe('prazo da oferta configurável pela Gestão (§ 5.02)', () => {
  it('grava na oferta o prazo vigente e mede o vencimento por ele', () => {
    const novo = lead('l1');
    const { lead: ofertado } = alocarLead(snapshot([psi('psi-1')], [novo], { prazoOfertaHoras: 48 }), novo);
    expect(ofertado.prazoRespostaHoras).toBe(48);

    const alocadoEm = Date.parse(ofertado.alocadoEm!);
    expect(ofertaExpirada(ofertado, new Date(alocadoEm + 30 * 3_600_000))).toBe(false);
    expect(ofertaExpirada(ofertado, new Date(alocadoEm + 49 * 3_600_000))).toBe(true);
  });

  it('mantém 24 horas para ofertas sem prazo gravado e não muda ofertas já enviadas', () => {
    const antiga = lead('l2', { status: 'AGUARDANDO_CONTATO', psicologoAlocadoId: 'psi-1', alocadoEm: '2026-11-23T00:00:00.000Z' });
    expect(ofertaExpirada(antiga, new Date('2026-11-23T23:00:00.000Z'))).toBe(false);
    expect(ofertaExpirada(antiga, new Date('2026-11-24T00:00:01.000Z'))).toBe(true);
    // Uma oferta de 12 horas continua de 12 horas mesmo com a configuração em 72.
    const curta = { ...antiga, prazoRespostaHoras: 12 };
    expect(ofertaExpirada(curta, new Date('2026-11-23T12:30:00.000Z'))).toBe(true);
  });

  it('pinta o semáforo pela metade do prazo da própria oferta', () => {
    const agora = new Date('2026-11-23T20:00:00.000Z');
    expect(classificarSla('2026-11-23T10:00:00.000Z', agora, 48)).toBe('VERDE');
    expect(classificarSla('2026-11-23T10:00:00.000Z', agora)).toBe('VERDE');
    expect(classificarSla('2026-11-22T18:00:00.000Z', agora)).toBe('VERMELHO');
    expect(classificarSla('2026-11-22T18:00:00.000Z', agora, 48)).toBe('AMARELO');
  });
});

describe('lista de espera (§§ 5.06 e 5.07)', () => {
  it('só aceita pedido que aguarda a Gestão e exige motivo para a prioridade', () => {
    const base = snapshot([], [lead('l1'), lead('l2', { status: 'CONTATO_CONFIRMADO' })]);
    expect(colocarNaListaDeEspera(base, 'l2', { modo: 'AUTOMATICO' }, GESTAO).situacao).toBe('nao_aplicavel');
    expect(colocarNaListaDeEspera(base, 'l1', { modo: 'MANUAL', prioritario: true }, GESTAO).situacao).toBe('motivo_obrigatorio');
    const entrou = colocarNaListaDeEspera(base, 'l1', { modo: 'MANUAL' }, GESTAO, new Date('2026-11-23T09:00:00.000Z'));
    expect(entrou.situacao).toBe('ok');
    if (entrou.situacao !== 'ok') return;
    expect(entrou.lead.listaEspera).toMatchObject({ modo: 'MANUAL', entradaEm: '2026-11-23T09:00:00.000Z' });
    expect(entrou.lead.listaEspera?.eventos[0]).toMatchObject({ tipo: 'ENTRADA', porNome: 'Gestão Fictícia' });
    expect(colocarNaListaDeEspera(entrou.snapshot, 'l1', { modo: 'MANUAL' }, GESTAO).situacao).toBe('ja_na_lista');
  });

  it('oferece a vaga pela data de entrada, salvo prioridade, e não oferece no modo manual', () => {
    const espera = (id: string, entradaEm: string, extras = {}) => lead(id, {
      listaEspera: { modo: 'AUTOMATICO', entradaEm, eventos: [], ...extras },
    });
    const estado = snapshot([psi('psi-1', { limitePacientesAtivos: 1 })], [
      espera('antigo', '2026-11-10T10:00:00.000Z'),
      espera('prioritario', '2026-11-20T10:00:00.000Z', { prioritario: true, motivoPrioridade: 'Risco social' }),
      lead('manual', { listaEspera: { modo: 'MANUAL', entradaEm: '2026-11-01T10:00:00.000Z', eventos: [] } }),
    ]);
    const { ofertas, snapshot: depois } = processarListaDeEspera(estado, new Date('2026-11-23T10:00:00.000Z'));
    // Uma vaga livre vira uma oferta só: as pendentes reservam a vaga na lista.
    expect(ofertas.map((oferta) => oferta.lead.id)).toEqual(['prioritario']);
    expect(depois.triagensPacientes?.find((item) => item.id === 'manual')?.status).toBe('PENDENTE_ATRIBUICAO');
    const ofertado = depois.triagensPacientes?.find((item) => item.id === 'prioritario');
    expect(ofertado).toMatchObject({ status: 'AGUARDANDO_CONTATO', psicologoAlocadoId: 'psi-1' });
    expect(ofertado?.listaEspera?.eventos.at(-1)?.tipo).toBe('OFERTA');
    // Sem vaga nova, nada muda na segunda passada.
    expect(processarListaDeEspera(depois, new Date('2026-11-23T10:05:00.000Z')).alterado).toBe(false);
  });

  it('não oferece a quem já está lotado nem bloqueia o rodízio de pedidos novos', () => {
    const lotado = psi('psi-1', { limitePacientesAtivos: 1 });
    const estado = snapshot([lotado], [
      ativo('ocupando', 'psi-1'),
      lead('espera', { listaEspera: { modo: 'AUTOMATICO', entradaEm: '2026-11-10T10:00:00.000Z', eventos: [] } }),
    ]);
    expect(processarListaDeEspera(estado).ofertas).toHaveLength(0);
  });

  it('sai da lista no aceite e volta a esperar quando a oferta é recusada sem substituto', () => {
    const estado = snapshot([psi('psi-1')], [
      lead('l1', { listaEspera: { modo: 'AUTOMATICO', entradaEm: '2026-11-10T10:00:00.000Z', eventos: [] } }),
    ]);
    const agora = new Date('2026-11-23T10:00:00.000Z');
    const { snapshot: comOferta } = processarListaDeEspera(estado, agora);

    const aceito = aceitarPaciente(comOferta, 'l1', 'psi-1', new Date('2026-11-23T11:00:00.000Z'));
    const aposAceite = aceito.next.triagensPacientes?.[0];
    expect(aposAceite?.listaEspera).toMatchObject({ saidaEm: '2026-11-23T11:00:00.000Z', motivoSaida: 'ACEITE' });

    const recusado = encaminharParaProximo(comOferta, 'l1', 'psi-1', new Date('2026-11-23T11:00:00.000Z'));
    expect(recusado.situacao).toBe('sem_candidato');
    expect(recusado.lead).toMatchObject({ status: 'PENDENTE_ATRIBUICAO', psicologoAlocadoId: undefined });
    expect(recusado.lead?.listaEspera?.saidaEm).toBeUndefined();
    expect(recusado.lead?.listaEspera?.eventos.at(-1)?.tipo).toBe('RETORNO');
  });

  it('altera modo e prioridade com registro e retira da lista', () => {
    const base = snapshot([], [lead('l1', { listaEspera: { modo: 'MANUAL', entradaEm: '2026-11-10T10:00:00.000Z', eventos: [] } })]);
    const alterado = alterarListaDeEspera(base, 'l1', { modo: 'AUTOMATICO' }, GESTAO);
    expect(alterado.situacao).toBe('ok');
    if (alterado.situacao !== 'ok') return;
    expect(alterado.lead.listaEspera?.eventos.at(-1)).toMatchObject({ tipo: 'MODO_ALTERADO', detalhe: 'Manual → Automático' });
    const retirado = retirarDaListaDeEspera(alterado.snapshot, 'l1', 'Paciente encaminhado por fora', GESTAO);
    expect(retirado.situacao).toBe('ok');
    if (retirado.situacao !== 'ok') return;
    expect(retirado.lead.listaEspera).toMatchObject({ motivoSaida: 'RETIRADA_GESTAO' });
  });
});

describe('inativação do vínculo (§ 6.05)', () => {
  it('libera a vaga na hora e guarda motivo, autor e data', () => {
    const estado = snapshot([psi('psi-1', { limitePacientesAtivos: 1 })], [ativo('l1', 'psi-1')]);
    const resultado = inativarVinculo(estado, 'l1', 'Paciente mudou de cidade', {
      usuarioRef: 'user-psi', nome: 'Psicóloga Fictícia', perfil: 'PSICOLOGO',
    }, new Date('2026-11-23T10:00:00.000Z'));
    expect(resultado.situacao).toBe('inativado');
    if (resultado.situacao !== 'inativado') return;
    expect(resultado.lead.status).toBe('INATIVO');
    expect(resultado.lead.inativacoes?.[0]).toMatchObject({
      motivo: 'Paciente mudou de cidade', perfil: 'PSICOLOGO', porNome: 'Psicóloga Fictícia',
      inativadoEm: '2026-11-23T10:00:00.000Z', psicologoId: 'psi-1',
    });
    expect(resultado.snapshot.cadastrosPsicologos?.[0].pacientesAtivosCount).toBe(0);
    expect(inativarVinculo(resultado.snapshot, 'l1', 'De novo', { ...GESTAO, perfil: 'GESTAO' }).situacao).toBe('nao_ativo');
  });

  it('reativa pela Gestão exigindo autorização e justificativa quando o psicólogo está lotado (§ 6.08)', () => {
    const inativado = { ...ativo('l1', 'psi-1'), status: 'INATIVO' as const, inativacoes: [{
      motivo: 'Pausa', inativadoEm: '2026-11-20T10:00:00.000Z', porUsuarioRef: 'user-psi', perfil: 'PSICOLOGO' as const,
    }] };
    const estado = snapshot([psi('psi-1', { limitePacientesAtivos: 1 })], [inativado, ativo('l2', 'psi-1')]);
    const autor = { ...GESTAO, perfil: 'GESTAO' as const };
    expect(reativarVinculo(estado, 'l1', {}, autor).situacao).toBe('limite_atingido');
    expect(reativarVinculo(estado, 'l1', { excederLimite: true }, autor).situacao).toBe('justificativa_obrigatoria');
    const ok = reativarVinculo(estado, 'l1', { excederLimite: true, justificativa: 'Retorno combinado' }, autor);
    expect(ok.situacao).toBe('reativado');
    if (ok.situacao !== 'reativado') return;
    expect(ok.lead.status).toBe('CONTATO_CONFIRMADO');
    expect(ok.lead.inativacoes?.[0]).toMatchObject({ justificativaReativacao: 'Retorno combinado', reativadoPorNome: 'Gestão Fictícia' });
    expect(ok.snapshot.cadastrosPsicologos?.[0].pacientesAtivosCount).toBe(2);
  });
});

describe('preferências originais e histórico (§ 4.04)', () => {
  it('altera os campos vivos, preserva a original e registra antes e depois', () => {
    const original = lead('l1', {
      formatoAtendimento: 'ONLINE',
      preferenciasOriginais: { registradoEm: '2026-11-20T12:00:00.000Z', origem: 'SITE', turno: 'TARDE', formatoAtendimento: 'ONLINE' },
    });
    const resultado = alterarPreferenciasDoPedido(
      snapshot([], [original]), 'l1', { turno: 'MANHA,TARDE', formatoAtendimento: 'PRESENCIAL' }, GESTAO, 'Pedido do paciente',
      new Date('2026-11-23T10:00:00.000Z'),
    );
    expect(resultado.situacao).toBe('alterado');
    if (resultado.situacao !== 'alterado') return;
    expect(resultado.lead).toMatchObject({ turno: 'MANHA,TARDE', formatoAtendimento: 'PRESENCIAL' });
    expect(resultado.lead.preferenciasOriginais).toEqual(original.preferenciasOriginais);
    expect(resultado.alteracao.campos).toEqual([
      { campo: 'formatoAtendimento', antes: 'ONLINE', depois: 'PRESENCIAL' },
      { campo: 'turno', antes: 'TARDE', depois: 'MANHA,TARDE' },
    ]);
    expect(resultado.alteracao).toMatchObject({ porNome: 'Gestão Fictícia', motivo: 'Pedido do paciente' });
  });

  it('fotografa a original de pedido antigo antes da primeira mudança e ignora o que não mudou', () => {
    const antigo = lead('l1', { turno: 'NOITE' });
    const semMudanca = alterarPreferenciasDoPedido(snapshot([], [antigo]), 'l1', { turno: 'NOITE' }, GESTAO, undefined);
    expect(semMudanca.situacao).toBe('sem_mudanca');
    const mudou = alterarPreferenciasDoPedido(snapshot([], [antigo]), 'l1', { turno: 'MANHA' }, GESTAO, undefined);
    if (mudou.situacao !== 'alterado') throw new Error('esperava alteração');
    expect(mudou.lead.preferenciasOriginais).toMatchObject({ origem: 'RECONSTRUIDA', turno: 'NOITE' });
  });

  it('recusa faixa de valor que não existe para o serviço', () => {
    const resultado = alterarPreferenciasDoPedido(snapshot([], [lead('l1')]), 'l1', { modalidade: 'CASAL_SOCIAL' }, GESTAO, undefined);
    expect(resultado.situacao).toBe('invalido');
  });
});

describe('vínculo coletivo na entrada (§ 6.04)', () => {
  it('tira o CPF do pedido e o leva ao primeiro participante e ao responsável', () => {
    const casal = normalizarPedidoColetivo(lead('l1', {
      servicoKey: 'PSICOTERAPIA_CASAL', modalidade: 'CASAL_PARTICULAR', paraQuemE: 'Casal',
      cpf: '52998224725', email: 'casal@example.com',
    }));
    expect(casal.cpf).toBeUndefined();
    expect(casal.vinculoColetivo).toEqual({ tipo: 'CASAL', participantes: [{ nome: 'Paciente l1', cpf: '52998224725' }] });
    expect(casal.responsavelFinanceiro).toMatchObject({ nome: 'Paciente l1', cpf: '52998224725', email: 'casal@example.com' });
    const individual = lead('l2', { cpf: '52998224725' });
    expect(normalizarPedidoColetivo(individual)).toBe(individual);
  });
});
