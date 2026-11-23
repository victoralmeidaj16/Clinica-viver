import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { emptySnapshot, type CadastroPsicologoRecord, type TriagemPacienteRecord } from './persistence';
import {
  alocarLeadEscolhido,
  encaminharParaProximo,
  motivoEscolhaDiretaPendente,
  varrerSla,
} from './viverMaisRodizio';
import { notificacoesDaGestao } from './notificacoes';

/**
 * Especificação final, seções 4.05, 5.04, 5.05 e 15: quando o paciente pede um
 * psicólogo específico e ele recusa, não está apto ou não responde em 24h, o
 * caso vai para a Gestão decidir — nunca para o rodízio automático.
 */

const criadoEm = '2026-10-15T10:00:00.000Z';

const psicologo = (id: string, nome: string, mudancas: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord => ({
  id,
  nomeCompleto: nome,
  crp: '00/00000',
  whatsapp: '5500000000000',
  status: 'APROVADO',
  criadoEm,
  turnosDisponiveis: ['MANHA'],
  modalidadesAtendidas: ['PARTICULAR'],
  limitePacientesAtivos: 5,
  ...mudancas,
});

const indicado = psicologo('psi-indicado', 'Profissional Indicado');
const outro = psicologo('psi-outro', 'Outro Profissional');

const leadBase: TriagemPacienteRecord = {
  id: 'lead-1',
  protocolo: 'VM-TESTE-1',
  nomePaciente: 'Paciente Fictício',
  telefone: '5500000000001',
  convenioSelecionado: 'Nenhum',
  origem: 'Vitrine',
  turno: 'MANHA',
  modalidade: 'PARTICULAR',
  status: 'PENDENTE_ATRIBUICAO',
  criadoEm,
};

const ofertaDireta: TriagemPacienteRecord = {
  ...leadBase,
  status: 'AGUARDANDO_CONTATO',
  psicologoAlocadoId: indicado.id,
  psicologoNome: indicado.nomeCompleto,
  alocadoEm: criadoEm,
  tipoAlocacao: 'ESCOLHA_DIRETA',
  psicologosJaTentados: [indicado.id],
};

function snapshot(lead: TriagemPacienteRecord, cadastros = [indicado, outro]) {
  return { ...emptySnapshot(), triagensPacientes: [lead], cadastrosPsicologos: cadastros };
}

describe('pedido para um psicólogo específico', () => {
  it('psicólogo indicado indisponível na entrada: a solicitação é registrada para a Gestão', () => {
    const pausado = { ...indicado, pausadoNoRodizio: true };
    const resultado = alocarLeadEscolhido(snapshot(leadBase, [pausado, outro]), leadBase, indicado.id);

    expect(resultado.psicologo).toBeUndefined();
    expect(resultado.lead).toMatchObject({
      status: 'PENDENTE_ATRIBUICAO',
      tipoAlocacao: 'ESCOLHA_DIRETA',
      psicologosJaTentados: [indicado.id],
    });
    expect(resultado.lead.psicologoAlocadoId).toBeUndefined();
    expect(resultado.snapshot.triagensPacientes![0].status).toBe('PENDENTE_ATRIBUICAO');
    expect(motivoEscolhaDiretaPendente(resultado.lead)).toBe('INDISPONIVEL');
  });

  it('recusa do psicólogo indicado vai para a Gestão, sem redistribuir pelo rodízio', () => {
    const resultado = encaminharParaProximo(snapshot(ofertaDireta), ofertaDireta.id, indicado.id);

    expect(resultado.situacao).toBe('devolvido_gestao');
    expect(resultado.psicologoNovo).toBeUndefined();
    const lead = resultado.snapshot.triagensPacientes![0];
    expect(lead).toMatchObject({ status: 'PENDENTE_ATRIBUICAO', tipoAlocacao: 'ESCOLHA_DIRETA' });
    expect(lead.psicologoAlocadoId).toBeUndefined();
    expect(motivoEscolhaDiretaPendente(lead)).toBe('RECUSOU');
  });

  it('recusa em solicitação comum continua indo ao próximo do rodízio', () => {
    const comum = { ...ofertaDireta, tipoAlocacao: 'RODIZIO' as const };
    const resultado = encaminharParaProximo(snapshot(comum), comum.id, indicado.id);

    expect(resultado.situacao).toBe('encaminhado');
    expect(resultado.psicologoNovo?.id).toBe(outro.id);
  });

  it('24h sem resposta do psicólogo indicado: a oferta expira e o caso vai para a Gestão', () => {
    const resultado = varrerSla(snapshot(ofertaDireta));

    expect(resultado.alterado).toBe(true);
    expect(resultado.transbordos).toEqual([]);
    const lead = resultado.snapshot.triagensPacientes![0];
    expect(lead).toMatchObject({ status: 'PENDENTE_ATRIBUICAO', slaExpirado: true });
    expect(lead.psicologoAlocadoId).toBeUndefined();
    expect(motivoEscolhaDiretaPendente(lead)).toBe('SEM_RESPOSTA');
  });

  it('avisa a Gestão dizendo quem foi indicado e o que aconteceu', () => {
    const { snapshot: estado } = encaminharParaProximo(snapshot(ofertaDireta), ofertaDireta.id, indicado.id);
    const itens = notificacoesDaGestao({
      triagensPacientes: estado.triagensPacientes ?? [],
      cadastrosPsicologos: estado.cadastrosPsicologos ?? [],
    } as never);
    const aviso = itens.find((item) => item.chave === `lead-sem-profissional:${ofertaDireta.id}`);

    expect(aviso?.titulo).toBe('Pedido para profissional específico aguarda decisão');
    expect(aviso?.descricao).toContain('Profissional Indicado');
    expect(aviso?.descricao).toContain('recusou');
  });
});

describe('Gestão devolve o caso ao rodízio', () => {
  it('oferece a outro profissional compatível, sem voltar a quem já recusou', async () => {
    const { devolverAoRodizio } = await import('./viverMaisRodizio');
    const { snapshot: estado } = encaminharParaProximo(snapshot(ofertaDireta), ofertaDireta.id, indicado.id);
    const resultado = devolverAoRodizio(estado, ofertaDireta.id);

    expect(resultado.situacao).toBe('alocado');
    expect(resultado.psicologo?.id).toBe(outro.id);
    expect(resultado.lead).toMatchObject({
      status: 'AGUARDANDO_CONTATO',
      psicologoAlocadoId: outro.id,
      tipoAlocacao: 'RODIZIO',
      slaExpirado: false,
    });
    expect(resultado.lead?.psicologosJaTentados).toEqual([indicado.id, outro.id]);
  });

  it('sem outro compatível, o caso continua com a Gestão', async () => {
    const { devolverAoRodizio } = await import('./viverMaisRodizio');
    const { snapshot: estado } = encaminharParaProximo(snapshot(ofertaDireta, [indicado]), ofertaDireta.id, indicado.id);
    const resultado = devolverAoRodizio(estado, ofertaDireta.id);

    expect(resultado.situacao).toBe('sem_candidato');
    expect(resultado.snapshot.triagensPacientes![0].status).toBe('PENDENTE_ATRIBUICAO');
  });

  it('só vale para caso aguardando decisão da Gestão', async () => {
    const { devolverAoRodizio } = await import('./viverMaisRodizio');
    expect(devolverAoRodizio(snapshot(ofertaDireta), ofertaDireta.id).situacao).toBe('nao_aplicavel');
    expect(devolverAoRodizio(snapshot(ofertaDireta), 'inexistente').situacao).toBe('nao_encontrado');
  });
});
