import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { emptySnapshot, type CadastroPsicologoRecord, type TriagemPacienteRecord } from './persistence';
import { alocarLeadEscolhido, ausenciaVigente, paraPsicologoPerfil } from './viverMaisRodizio';

/** Férias de 10/09 a 24/09 no fuso da clínica; o fim gravado é exclusivo. */
const FERIAS = {
  inicio: '2026-09-10T03:00:00.000Z',
  fim: '2026-09-25T03:00:00.000Z',
  motivo: 'Férias',
  criadoEm: '2026-08-20T14:00:00.000Z',
};

const DURANTE = new Date('2026-09-15T13:00:00.000Z');
const ANTES = new Date('2026-09-01T13:00:00.000Z');
const DEPOIS = new Date('2026-09-25T03:00:00.000Z');

const cadastro = (mudancas: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord => ({
  id: 'psi-1',
  nomeCompleto: 'Joliana Souza',
  crp: '12/29788',
  whatsapp: '5548999999999',
  status: 'APROVADO',
  criadoEm: '2026-08-01T12:00:00.000Z',
  pausadoNoRodizio: false,
  exibirNaVitrine: true,
  ...mudancas,
});

describe('férias marcadas na agenda tiram do rodízio', () => {
  it('pausa enquanto a ausência está em curso', () => {
    const perfil = paraPsicologoPerfil(cadastro({ ausenciasAgenda: [FERIAS] }), DURANTE);
    expect(perfil.pausadoNoRodizio).toBe(true);
  });

  it('não pausa antes de as férias começarem', () => {
    const perfil = paraPsicologoPerfil(cadastro({ ausenciasAgenda: [FERIAS] }), ANTES);
    expect(perfil.pausadoNoRodizio).toBe(false);
  });

  it('volta à fila sozinho no fim do período', () => {
    // A garantia que dispensa um job de "desmarcar férias": passado o instante
    // final, a mesma leitura devolve a pessoa ao rodízio.
    const perfil = paraPsicologoPerfil(cadastro({ ausenciasAgenda: [FERIAS] }), DEPOIS);
    expect(perfil.pausadoNoRodizio).toBe(false);
  });

  it('mantém visível na vitrine para os pacientes atuais', () => {
    // Férias param de trazer paciente novo; não escondem o profissional de
    // quem já é dele.
    const perfil = paraPsicologoPerfil(cadastro({ ausenciasAgenda: [FERIAS] }), DURANTE);
    expect(perfil.exibirNaVitrine).toBe(true);
  });

  it('não desfaz a pausa manual da gestão quando as férias terminam', () => {
    const perfil = paraPsicologoPerfil(
      cadastro({ pausadoNoRodizio: true, ausenciasAgenda: [FERIAS] }),
      DEPOIS
    );
    expect(perfil.pausadoNoRodizio).toBe(true);
  });

  it('segue no rodízio quem não marcou ausência alguma', () => {
    expect(paraPsicologoPerfil(cadastro(), DURANTE).pausadoNoRodizio).toBe(false);
  });
});

describe('ausenciaVigente', () => {
  it('devolve a ausência que cobre o instante, com motivo', () => {
    expect(ausenciaVigente(cadastro({ ausenciasAgenda: [FERIAS] }), DURANTE)).toEqual(FERIAS);
  });

  it('escolhe a ausência certa quando há várias marcadas', () => {
    const outubro = { ...FERIAS, inicio: '2026-10-01T03:00:00.000Z', fim: '2026-10-03T03:00:00.000Z' };
    const record = cadastro({ ausenciasAgenda: [FERIAS, outubro] });
    expect(ausenciaVigente(record, new Date('2026-10-02T12:00:00.000Z'))).toEqual(outubro);
  });
});

describe('escolha explícita no catálogo', () => {
  const elegivel = (id: string, mudancas: Partial<CadastroPsicologoRecord> = {}) => cadastro({
    id,
    turnosDisponiveis: ['MANHA'],
    modalidadesAtendidas: ['ACESSIVEL_SOCIAL'],
    servicosHabilitados: ['PSICOTERAPIA'],
    limitePacientesAtivos: 5,
    pacientesAtivosCount: 0,
    ...mudancas,
  });
  const lead: TriagemPacienteRecord = {
    id: 'lead-1',
    protocolo: 'VM-123456',
    nomePaciente: 'Ana Lima',
    telefone: '5551999999999',
    convenioSelecionado: 'Nenhum',
    origem: 'Vitrine',
    turno: 'MANHA',
    servicoKey: 'PSICOTERAPIA',
    modalidade: 'SOCIAL',
    status: 'PENDENTE_ATRIBUICAO',
    criadoEm: '2026-08-27T12:00:00.000Z',
  };

  it('mantém o profissional escolhido, mesmo que ele não seja o primeiro da fila', () => {
    const snapshot = {
      ...emptySnapshot(),
      triagensPacientes: [lead],
      cadastrosPsicologos: [elegivel('psi-1'), elegivel('psi-2')],
    };
    const resultado = alocarLeadEscolhido(snapshot, lead, 'psi-2', new Date('2026-08-27T13:00:00.000Z'));
    expect(resultado.psicologo?.id).toBe('psi-2');
    expect(resultado.lead.status).toBe('AGUARDANDO_CONTATO');
    expect(resultado.lead.psicologoAlocadoId).toBe('psi-2');
  });

  it('não substitui silenciosamente uma escolha que ficou indisponível', () => {
    const snapshot = {
      ...emptySnapshot(),
      triagensPacientes: [lead],
      cadastrosPsicologos: [elegivel('psi-1'), elegivel('psi-2', { pausadoNoRodizio: true })],
    };
    const resultado = alocarLeadEscolhido(snapshot, lead, 'psi-2');
    expect(resultado.psicologo).toBeUndefined();
    expect(resultado.lead.psicologoAlocadoId).toBeUndefined();
  });
});
