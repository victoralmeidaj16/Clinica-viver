import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { emptySnapshot, type CadastroPsicologoRecord, type TriagemPacienteRecord } from './persistence';
import { aceitarPaciente, confirmarContato, encaminharParaProximo } from './viverMaisRodizio';

const alocadoEm = '2026-10-15T10:00:00.000Z';
const lead: TriagemPacienteRecord = {
  id: 'lead-1',
  protocolo: 'VM-1',
  nomePaciente: 'Maria',
  telefone: '5511999999999',
  convenioSelecionado: 'Nenhum',
  origem: 'Vitrine',
  turno: 'MANHA',
  status: 'AGUARDANDO_CONTATO',
  criadoEm: alocadoEm,
  alocadoEm,
  psicologoAlocadoId: 'psi-1',
  psicologoNome: 'Dra. Ana',
};

const psicologo: CadastroPsicologoRecord = {
  id: 'psi-1',
  nomeCompleto: 'Dra. Ana',
  whatsapp: '5511888888888',
  crp: '00/0000',
  status: 'APROVADO',
  criadoEm: alocadoEm,
  limitePacientesAtivos: 5,
};

function snapshot(comLead: TriagemPacienteRecord = lead) {
  return { ...emptySnapshot(), triagensPacientes: [comLead], cadastrosPsicologos: [psicologo] };
}

describe('aceite do paciente pelo psicólogo', () => {
  const agoraDaOferta = new Date('2026-10-15T12:00:00.000Z');
  const ofertaExtra = { ...lead, id: 'outra-oferta', modalidade: 'PARTICULAR' as const };
  const comUltimaVaga = {
    ...snapshot(), triagensPacientes: [lead, ofertaExtra],
    cadastrosPsicologos: [{ ...psicologo, limitePacientesAtivos: 1 }],
  };

  it('ocupa a última vaga uma vez e conserva o pedido excedente na Gestão', () => {
    const primeiro = aceitarPaciente(comUltimaVaga, lead.id, psicologo.id, agoraDaOferta);
    const segundo = aceitarPaciente(primeiro.next, ofertaExtra.id, psicologo.id, agoraDaOferta);
    expect(primeiro.result.kind).toBe('accepted');
    expect(segundo.result.kind).toBe('capacity_pending');
    expect(segundo.next.cadastrosPsicologos?.[0].pacientesAtivosCount).toBe(1);
    expect(segundo.next.triagensPacientes?.find((item) => item.id === ofertaExtra.id)).toMatchObject({
      status: 'PENDENTE_ATRIBUICAO', psicologosJaTentados: [psicologo.id],
    });
    expect(aceitarPaciente(segundo.next, lead.id, psicologo.id, agoraDaOferta).result.kind).toBe('already_accepted');
  });

  it.each(['RODIZIO', 'ESCOLHA_DIRETA'] as const)('respeita a origem %s quando a última vaga já foi ocupada', (tipoAlocacao) => {
    const outro = { ...psicologo, id: 'outro', turnosDisponiveis: ['MANHA'], modalidadesAtendidas: ['PARTICULAR'] };
    const fila = { ...comUltimaVaga, cadastrosPsicologos: [...comUltimaVaga.cadastrosPsicologos, outro],
      triagensPacientes: [{ ...lead, aceitoEm: alocadoEm }, { ...ofertaExtra, tipoAlocacao }] };
    const segundo = aceitarPaciente(fila, ofertaExtra.id, psicologo.id, agoraDaOferta);
    const encaminhado = segundo.next.triagensPacientes?.find((item) => item.id === ofertaExtra.id);
    expect(segundo.result.kind).toBe(tipoAlocacao === 'ESCOLHA_DIRETA' ? 'capacity_pending' : 'capacity_reallocated');
    expect(encaminhado?.psicologoAlocadoId).toBe(tipoAlocacao === 'ESCOLHA_DIRETA' ? undefined : outro.id);
    expect(encaminhado?.aceitoEm).toBeUndefined();
    expect(encaminhado?.psicologosJaTentados).toContain(psicologo.id);
  });

  it('mantém a exceção do Projeto Acolhe quando o profissional está lotado', () => {
    const fila = { ...comUltimaVaga, triagensPacientes: [{ ...lead, aceitoEm: alocadoEm }, { ...ofertaExtra, projetoAcolhe: true }] };
    const segundo = aceitarPaciente(fila, ofertaExtra.id, psicologo.id, agoraDaOferta);
    expect(segundo.result.kind).toBe('accepted');
    expect(segundo.next.cadastrosPsicologos?.[0].pacientesAtivosCount).toBe(1);
  });

  it.each(['DESISTENTE', 'FINALIZADO'] as const)('o link antigo não volta a ocupar uma vaga de um vínculo %s', (status) => {
    const estado = snapshot({ ...lead, status, aceitoEm: alocadoEm });
    expect(aceitarPaciente(estado, lead.id, psicologo.id, agoraDaOferta).result.kind).toBe('conflict');
    const contato = confirmarContato(estado, lead.id, psicologo.id, agoraDaOferta);
    expect(contato.result.kind).toBe('conflict');
    expect(contato.next.triagensPacientes?.[0].status).toBe(status);
    expect(contato.next.cadastrosPsicologos?.[0].pacientesAtivosCount).toBe(0);
  });

  it('persiste o aceite sem reiniciar o prazo e sem concluir o contato', () => {
    const agora = new Date('2026-10-15T12:00:00.000Z');
    const resultado = aceitarPaciente(snapshot(), 'lead-1', 'psi-1', agora);

    expect(resultado.result.kind).toBe('accepted');
    expect(resultado.next.triagensPacientes![0]).toMatchObject({
      aceitoEm: agora.toISOString(),
      alocadoEm,
      status: 'AGUARDANDO_CONTATO',
      psicologoAlocadoId: 'psi-1',
    });
    expect(resultado.next.triagensPacientes![0].confirmadoEm).toBeUndefined();
  });

  it('é idempotente quando o mesmo link é aberto e aceito novamente', () => {
    const aceitoEm = '2026-10-15T12:00:00.000Z';
    const resultado = aceitarPaciente(snapshot({ ...lead, aceitoEm }), 'lead-1', 'psi-1');
    expect(resultado.result.kind).toBe('already_accepted');
    expect(resultado.next.triagensPacientes![0].aceitoEm).toBe(aceitoEm);
  });

  it('rejeita o link quando o paciente já pertence a outro psicólogo', () => {
    const resultado = aceitarPaciente(snapshot({ ...lead, psicologoAlocadoId: 'psi-2' }), 'lead-1', 'psi-1');
    expect(resultado.result.kind).toBe('conflict');
  });

  it('não deixa o link encaminhar o paciente depois do aceite', () => {
    const aceitoEm = '2026-10-15T12:00:00.000Z';
    const resultado = encaminharParaProximo(snapshot({ ...lead, aceitoEm }), 'lead-1', 'psi-1');
    expect(resultado.situacao).toBe('ja_aceito');
    expect(resultado.snapshot.triagensPacientes![0]).toMatchObject({ psicologoAlocadoId: 'psi-1', aceitoEm });
  });
});

describe('paciente aceito fica com quem aceitou (especificação 5.03 e 7.03)', () => {
  it('a varredura de prazo não redistribui um paciente já aceito', async () => {
    const { varrerSla } = await import('./viverMaisRodizio');
    const completo: TriagemPacienteRecord = { ...lead, modalidade: 'PARTICULAR', aceitoEm: '2026-10-15T11:00:00.000Z' };
    const outro: CadastroPsicologoRecord = {
      ...psicologo, id: 'psi-2', nomeCompleto: 'Outro', turnosDisponiveis: ['MANHA'], modalidadesAtendidas: ['PARTICULAR'],
    };
    const resultado = varrerSla({
      ...emptySnapshot(),
      triagensPacientes: [completo],
      cadastrosPsicologos: [{ ...psicologo, turnosDisponiveis: ['MANHA'], modalidadesAtendidas: ['PARTICULAR'] }, outro],
    });

    expect(resultado.transbordos).toEqual([]);
    expect(resultado.alterado).toBe(false);
    expect(resultado.snapshot.triagensPacientes![0]).toMatchObject({
      psicologoAlocadoId: 'psi-1',
      aceitoEm: completo.aceitoEm,
    });
  });
});

describe('oferta vencida não pode ser aceita (especificação 5.05)', () => {
  const depoisDoPrazo = new Date('2026-10-16T10:30:00.000Z');

  it('recusa o aceite depois de 24h, mesmo antes de a varredura mover o caso', () => {
    const resultado = aceitarPaciente(snapshot(), 'lead-1', 'psi-1', depoisDoPrazo);
    expect(resultado.result.kind).toBe('expired');
    expect(resultado.next.triagensPacientes![0].aceitoEm).toBeUndefined();
  });

  it('recusa confirmar contato de oferta vencida e ainda não aceita', async () => {
    const { confirmarContato } = await import('./viverMaisRodizio');
    const resultado = confirmarContato(snapshot(), 'lead-1', 'psi-1', depoisDoPrazo);
    expect(resultado.result.kind).toBe('expired');
    expect(resultado.next.triagensPacientes![0].confirmadoEm).toBeUndefined();
  });

  it('quem aceitou no prazo confirma o contato depois das 24h normalmente', async () => {
    const { confirmarContato } = await import('./viverMaisRodizio');
    const aceito = { ...lead, aceitoEm: '2026-10-15T12:00:00.000Z' };
    const resultado = confirmarContato(snapshot(aceito), 'lead-1', 'psi-1', depoisDoPrazo);
    expect(resultado.result.kind).toBe('confirmed');
  });
});
