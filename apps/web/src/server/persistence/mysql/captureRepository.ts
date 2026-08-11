import 'server-only';

import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMysqlPool } from '@/server/oci/runtime';
import {
  emptySnapshot,
  readSnapshot,
  type CadastroPsicologoRecord,
  type PersistedSnapshot,
  type StatusCadastroPsicologo,
  type StatusTriagem,
  type TriagemPacienteRecord,
} from '@/server/application/persistence';
import {
  fromSqlTimestamp,
  instituicaoId,
  rowId,
  toSqlTimestamp,
} from './mappers';

export interface CaptureState {
  triagensPacientes: readonly TriagemPacienteRecord[];
  cadastrosPsicologos: readonly CadastroPsicologoRecord[];
}

interface CaptureResult<T> {
  next: CaptureState;
  result: T;
}

interface TriagemRow extends RowDataPacket {
  ref_core: string;
  protocolo: string;
  nome_paciente: string;
  telefone: string;
  idade: string | null;
  email: string | null;
  cpf: string | null;
  cep: string | null;
  possui_convenio: string | null;
  convenio_selecionado: string;
  origem: string;
  turno: string;
  servico: string | null;
  servico_key: string | null;
  modalidade: string | null;
  numero_residencia: string | null;
  para_quem_e: string | null;
  especificar_necessidades: number;
  necessidades_paciente: unknown;
  necessidades_outro: string | null;
  opcao_avaliacao_psicologica: string | null;
  genero: string | null;
  genero_outro: string | null;
  status: StatusTriagem;
  psicologo_alocado_id: string | null;
  psicologo_nome: string | null;
  paciente_ref: string | null;
  alocado_em: string | null;
  confirmado_em: string | null;
  sla_expirado: number;
  transbordos: number;
  psicologos_ja_tentados: unknown;
  criado_em: string;
}

interface PsicologoRow extends RowDataPacket {
  ref_core: string;
  nome_completo: string;
  nome_social: string | null;
  crp: string;
  whatsapp: string;
  email: string | null;
  foto_url: string | null;
  usuario_ref: string | null;
  profissional_ref: string | null;
  acesso_criado_em: string | null;
  boas_vindas_enviada_em: string | null;
  cidade_uf: string | null;
  estado_uf: string | null;
  cidade: string | null;
  logradouro: string | null;
  bairro: string | null;
  genero: string | null;
  genero_outro: string | null;
  especialidade: string | null;
  modalidade_atendimento: string | null;
  atendimento_preferencia: 'PARTICULAR' | 'SOCIAL' | 'AMBOS' | null;
  minibio: string | null;
  status: StatusCadastroPsicologo;
  turnos_disponiveis: unknown;
  modalidades_atendidas: unknown;
  servicos_habilitados: unknown;
  servicos_prestados: unknown;
  publico_alvo: unknown;
  publico_alvo_outro: string | null;
  especificar_necessidades: number;
  necessidades_atendidas: unknown;
  necessidades_outro: string | null;
  limite_pacientes_ativos: number | null;
  pacientes_ativos_count: number;
  exibir_na_vitrine: number;
  pausado_no_rodizio: number;
  motivo_pausa_rodizio: string | null;
  motivo_desativacao: string | null;
  ultimo_lead_recebido_em: string | null;
  turma_viver_mais: string | null;
  pos_graduacao_viver_mais: string | null;
  segunda_pos_graduacao_viver_mais: string | null;
  criado_em: string;
}

function organizacaoRef(): string {
  return (
    process.env.ORGANIZATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() ||
    'org-viver-mais'
  );
}

function asStringArray(value: unknown): string[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      parsed = [];
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string')
    : [];
}

function asJson(value: readonly string[] | undefined): string {
  return JSON.stringify(value ?? []);
}

function toLead(row: TriagemRow): TriagemPacienteRecord {
  return {
    id: row.ref_core,
    protocolo: row.protocolo,
    nomePaciente: row.nome_paciente,
    telefone: row.telefone,
    idade: row.idade ?? undefined,
    email: row.email ?? undefined,
    cpf: row.cpf ?? undefined,
    cep: row.cep ?? undefined,
    possuiConvenio: row.possui_convenio ?? undefined,
    convenioSelecionado: row.convenio_selecionado,
    origem: row.origem,
    turno: row.turno,
    servico: row.servico ?? undefined,
    servicoKey: row.servico_key ?? undefined,
    modalidade: row.modalidade ?? undefined,
    numeroResidencia: row.numero_residencia ?? undefined,
    paraQuemE: row.para_quem_e ?? undefined,
    especificarNecessidades: Boolean(row.especificar_necessidades),
    necessidadesPaciente: asStringArray(row.necessidades_paciente),
    necessidadesOutro: row.necessidades_outro ?? undefined,
    opcaoAvaliacaoPsicologica: row.opcao_avaliacao_psicologica ?? undefined,
    genero: row.genero ?? undefined,
    generoOutro: row.genero_outro ?? undefined,
    status: row.status,
    criadoEm: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
    psicologoAlocadoId: row.psicologo_alocado_id ?? undefined,
    psicologoNome: row.psicologo_nome ?? undefined,
    pacienteRef: row.paciente_ref ?? undefined,
    alocadoEm: fromSqlTimestamp(row.alocado_em),
    confirmadoEm: fromSqlTimestamp(row.confirmado_em),
    slaExpirado: Boolean(row.sla_expirado),
    transbordos: row.transbordos,
    psicologosJaTentados: asStringArray(row.psicologos_ja_tentados),
  };
}

function toPsychologist(row: PsicologoRow): CadastroPsicologoRecord {
  return {
    id: row.ref_core,
    nomeCompleto: row.nome_completo,
    nomeSocial: row.nome_social ?? undefined,
    crp: row.crp,
    whatsapp: row.whatsapp,
    email: row.email ?? undefined,
    fotoUrl: row.foto_url ?? undefined,
    usuarioRef: row.usuario_ref ?? undefined,
    profissionalRef: row.profissional_ref ?? undefined,
    acessoCriadoEm: fromSqlTimestamp(row.acesso_criado_em),
    boasVindasEnviadaEm: fromSqlTimestamp(row.boas_vindas_enviada_em),
    estadoUf: row.estado_uf ?? undefined,
    cidade: row.cidade ?? undefined,
    logradouro: row.logradouro ?? undefined,
    bairro: row.bairro ?? undefined,
    genero: row.genero ?? undefined,
    generoOutro: row.genero_outro ?? undefined,
    cidadeUf: row.cidade_uf ?? (row.cidade && row.estado_uf ? `${row.cidade}/${row.estado_uf}` : undefined),
    especialidade: row.especialidade ?? undefined,
    modalidadeAtendimento: row.modalidade_atendimento ?? undefined,
    atendimentoPreferencia: row.atendimento_preferencia ?? undefined,
    minibio: row.minibio ?? undefined,
    status: row.status,
    criadoEm: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
    turnosDisponiveis: asStringArray(row.turnos_disponiveis),
    modalidadesAtendidas: asStringArray(row.modalidades_atendidas),
    servicosHabilitados: asStringArray(row.servicos_habilitados),
    servicosPrestados: asStringArray(row.servicos_prestados),
    publicoAlvo: asStringArray(row.publico_alvo),
    publicoAlvoOutro: row.publico_alvo_outro ?? undefined,
    especificarNecessidades: Boolean(row.especificar_necessidades),
    necessidadesAtendidas: asStringArray(row.necessidades_atendidas),
    necessidadesOutro: row.necessidades_outro ?? undefined,
    limitePacientesAtivos: row.limite_pacientes_ativos ?? undefined,
    pacientesAtivosCount: row.pacientes_ativos_count,
    exibirNaVitrine: Boolean(row.exibir_na_vitrine),
    pausadoNoRodizio: Boolean(row.pausado_no_rodizio),
    motivoPausaRodizio: row.motivo_pausa_rodizio ?? undefined,
    motivoDesativacao: row.motivo_desativacao ?? undefined,
    ultimoLeadRecebidoEm: fromSqlTimestamp(row.ultimo_lead_recebido_em),
    turmaViverMais: row.turma_viver_mais ?? undefined,
    posGraduacaoViverMais: row.pos_graduacao_viver_mais ?? undefined,
    segundaPosGraduacao: row.segunda_pos_graduacao_viver_mais ?? undefined,
  };
}

function stateFromSnapshot(snapshot: PersistedSnapshot): CaptureState {
  return {
    triagensPacientes: [...(snapshot.triagensPacientes ?? [])],
    cadastrosPsicologos: [...(snapshot.cadastrosPsicologos ?? [])],
  };
}

export class MysqlCaptureRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  /**
   * Executa a transformação no mesmo lock/transação que lê e grava a fila.
   * Isso evita que dois formulários simultâneos sobrescrevam o rodízio um do
   * outro.
   */
  async mutate<T>(mutator: (state: CaptureState) => CaptureResult<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const current = await this.readState(connection, true);
      const migrated = await this.importLegacyIfNeeded(connection, current);
      const change = mutator(migrated);
      await this.writeState(connection, change.next);
      await connection.commit();
      return change.result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Leitura simples, sem transação e sem lock.
   *
   * Antes isto era `mutate(state => ({next: state, result: state}))`, o que
   * fazia toda listagem travar as duas tabelas com `FOR UPDATE` e reescrever
   * cada linha — uma tela aberta serializava contra qualquer formulário sendo
   * enviado. A troca aceita que uma leitura possa não enxergar uma escrita
   * concorrente que ainda não commitou; para listagem, isso é indistinguível de
   * ter carregado a página um instante antes.
   *
   * A importação do legado é a exceção: quando as duas tabelas estão vazias e
   * existe snapshot em disco, a leitura delega ao `mutate` para que a migração
   * de modo demonstração para banco aconteça na primeira tela aberta, e não
   * apenas no primeiro formulário enviado. O custo fica restrito ao banco
   * vazio, que é onde não há o que travar.
   */
  async read(): Promise<CaptureState> {
    const state = await this.readState(this.pool, false);
    const vazio = state.triagensPacientes.length === 0 && state.cadastrosPsicologos.length === 0;
    if (vazio && readSnapshot()) {
      return this.mutate((atual) => ({ next: atual, result: atual }));
    }
    return state;
  }

  private async readState(
    connection: Pool | PoolConnection,
    lockRows: boolean
  ): Promise<CaptureState> {
    const lock = lockRows ? ' FOR UPDATE' : '';
    const [leadRows] = await connection.query<TriagemRow[]>(
      `SELECT ref_core, protocolo, nome_paciente, telefone, idade, email, cpf, cep,
              numero_residencia, possui_convenio, convenio_selecionado, origem, turno, servico,
              servico_key, modalidade, para_quem_e, especificar_necessidades,
              necessidades_paciente, necessidades_outro, opcao_avaliacao_psicologica,
              genero, genero_outro, status, psicologo_alocado_id,
              psicologo_nome, paciente_ref, alocado_em, confirmado_em, sla_expirado,
              transbordos, psicologos_ja_tentados, criado_em
         FROM clinica_triagens_pacientes
        WHERE instituicao_id = ? AND organizacao_ref = ?
        ORDER BY criado_em${lock}`,
      [instituicaoId(), organizacaoRef()]
    );
    const [psychRows] = await connection.query<PsicologoRow[]>(
      `SELECT ref_core, nome_completo, nome_social, crp, whatsapp, email, foto_url,
              usuario_ref, profissional_ref, acesso_criado_em, boas_vindas_enviada_em,
              cidade_uf, estado_uf, cidade, logradouro, bairro,
              genero, genero_outro,
              especialidade, modalidade_atendimento, atendimento_preferencia, minibio, status,
              turnos_disponiveis, modalidades_atendidas, servicos_habilitados,
              servicos_prestados, publico_alvo, publico_alvo_outro,
              especificar_necessidades, necessidades_atendidas, necessidades_outro,
              limite_pacientes_ativos, pacientes_ativos_count, exibir_na_vitrine,
              pausado_no_rodizio, motivo_pausa_rodizio, motivo_desativacao, ultimo_lead_recebido_em, turma_viver_mais,
              pos_graduacao_viver_mais, segunda_pos_graduacao_viver_mais, criado_em
         FROM clinica_cadastros_psicologos
        WHERE instituicao_id = ? AND organizacao_ref = ?
        ORDER BY criado_em${lock}`,
      [instituicaoId(), organizacaoRef()]
    );
    return {
      triagensPacientes: leadRows.map(toLead),
      cadastrosPsicologos: psychRows.map(toPsychologist),
    };
  }

  /** Migra o conteúdo antigo apenas quando a tabela correspondente ainda está vazia. */
  private async importLegacyIfNeeded(
    connection: Pool | PoolConnection,
    state: CaptureState
  ): Promise<CaptureState> {
    const legacy = readSnapshot();
    if (!legacy) return state;

    const next: CaptureState = {
      triagensPacientes:
        state.triagensPacientes.length === 0 && legacy.triagensPacientes?.length
          ? [...legacy.triagensPacientes]
          : state.triagensPacientes,
      cadastrosPsicologos:
        state.cadastrosPsicologos.length === 0 && legacy.cadastrosPsicologos?.length
          ? [...legacy.cadastrosPsicologos]
          : state.cadastrosPsicologos,
    };

    if (
      next.triagensPacientes.length !== state.triagensPacientes.length ||
      next.cadastrosPsicologos.length !== state.cadastrosPsicologos.length
    ) {
      await this.writeState(connection, next);
    }
    return next;
  }

  private async writeState(
    connection: Pool | PoolConnection,
    state: CaptureState
  ): Promise<void> {
    for (const psych of state.cadastrosPsicologos) {
      await connection.execute(
        `INSERT INTO clinica_cadastros_psicologos
           (id, instituicao_id, organizacao_ref, ref_core, nome_completo, nome_social,
            crp, whatsapp, email, foto_url, usuario_ref, profissional_ref, acesso_criado_em,
            boas_vindas_enviada_em, cidade_uf, estado_uf, cidade, logradouro, bairro,
            genero, genero_outro,
            especialidade, modalidade_atendimento, atendimento_preferencia,
            minibio, status, turnos_disponiveis, modalidades_atendidas,
            servicos_habilitados, servicos_prestados, publico_alvo, publico_alvo_outro,
            especificar_necessidades, necessidades_atendidas, necessidades_outro,
            limite_pacientes_ativos, pacientes_ativos_count,
            exibir_na_vitrine, pausado_no_rodizio, motivo_pausa_rodizio,
            motivo_desativacao, ultimo_lead_recebido_em,
            turma_viver_mais, pos_graduacao_viver_mais, segunda_pos_graduacao_viver_mais, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nome_completo = VALUES(nome_completo), nome_social = VALUES(nome_social),
           crp = VALUES(crp), whatsapp = VALUES(whatsapp), email = VALUES(email),
           foto_url = VALUES(foto_url),
           usuario_ref = VALUES(usuario_ref), profissional_ref = VALUES(profissional_ref),
           acesso_criado_em = VALUES(acesso_criado_em),
           boas_vindas_enviada_em = VALUES(boas_vindas_enviada_em),
           cidade_uf = VALUES(cidade_uf), estado_uf = VALUES(estado_uf), cidade = VALUES(cidade),
           logradouro = VALUES(logradouro), bairro = VALUES(bairro),
           genero = VALUES(genero), genero_outro = VALUES(genero_outro),
           especialidade = VALUES(especialidade),
           modalidade_atendimento = VALUES(modalidade_atendimento),
           atendimento_preferencia = VALUES(atendimento_preferencia), minibio = VALUES(minibio),
           status = VALUES(status), turnos_disponiveis = VALUES(turnos_disponiveis),
           modalidades_atendidas = VALUES(modalidades_atendidas),
           servicos_habilitados = VALUES(servicos_habilitados),
           servicos_prestados = VALUES(servicos_prestados),
           publico_alvo = VALUES(publico_alvo), publico_alvo_outro = VALUES(publico_alvo_outro),
           especificar_necessidades = VALUES(especificar_necessidades),
           necessidades_atendidas = VALUES(necessidades_atendidas),
           necessidades_outro = VALUES(necessidades_outro),
           limite_pacientes_ativos = VALUES(limite_pacientes_ativos),
           pacientes_ativos_count = VALUES(pacientes_ativos_count),
           exibir_na_vitrine = VALUES(exibir_na_vitrine),
           pausado_no_rodizio = VALUES(pausado_no_rodizio),
           motivo_pausa_rodizio = VALUES(motivo_pausa_rodizio),
           motivo_desativacao = VALUES(motivo_desativacao),
           ultimo_lead_recebido_em = VALUES(ultimo_lead_recebido_em),
           turma_viver_mais = VALUES(turma_viver_mais),
           pos_graduacao_viver_mais = VALUES(pos_graduacao_viver_mais),
           segunda_pos_graduacao_viver_mais = VALUES(segunda_pos_graduacao_viver_mais)`,
        [
          rowId('cadastro_psicologo', psych.id),
          instituicaoId(),
          organizacaoRef(),
          psych.id,
          psych.nomeCompleto,
          psych.nomeSocial ?? null,
          psych.crp,
          psych.whatsapp,
          psych.email ?? null,
          psych.fotoUrl ?? null,
          psych.usuarioRef ?? null,
          psych.profissionalRef ?? null,
          psych.acessoCriadoEm ? toSqlTimestamp(psych.acessoCriadoEm) : null,
          psych.boasVindasEnviadaEm ? toSqlTimestamp(psych.boasVindasEnviadaEm) : null,
          psych.cidadeUf ?? (psych.cidade && psych.estadoUf ? `${psych.cidade}/${psych.estadoUf}` : null),
          psych.estadoUf ?? null,
          psych.cidade ?? null,
          psych.logradouro ?? null,
          psych.bairro ?? null,
          psych.genero ?? null,
          psych.generoOutro ?? null,
          psych.especialidade ?? null,
          psych.modalidadeAtendimento ?? null,
          psych.atendimentoPreferencia ?? null,
          psych.minibio ?? null,
          psych.status,
          asJson(psych.turnosDisponiveis),
          asJson(psych.modalidadesAtendidas),
          asJson(psych.servicosHabilitados),
          asJson(psych.servicosPrestados),
          asJson(psych.publicoAlvo),
          psych.publicoAlvoOutro ?? null,
          psych.especificarNecessidades ? 1 : 0,
          asJson(psych.necessidadesAtendidas),
          psych.necessidadesOutro ?? null,
          psych.limitePacientesAtivos ?? null,
          psych.pacientesAtivosCount ?? 0,
          psych.exibirNaVitrine === false ? 0 : 1,
          psych.pausadoNoRodizio ? 1 : 0,
          psych.motivoPausaRodizio ?? null,
          psych.motivoDesativacao ?? null,
          psych.ultimoLeadRecebidoEm ? toSqlTimestamp(psych.ultimoLeadRecebidoEm) : null,
          psych.turmaViverMais ?? null,
          psych.posGraduacaoViverMais ?? null,
          psych.segundaPosGraduacao ?? null,
          toSqlTimestamp(psych.criadoEm),
        ]
      );
    }

    for (const lead of state.triagensPacientes) {
      await connection.execute(
        `INSERT INTO clinica_triagens_pacientes
           (id, instituicao_id, organizacao_ref, ref_core, protocolo, nome_paciente,
            telefone, idade, email, cpf, cep, numero_residencia, possui_convenio,
            convenio_selecionado, origem, turno, servico, servico_key, modalidade,
            para_quem_e, especificar_necessidades, necessidades_paciente,
            necessidades_outro, opcao_avaliacao_psicologica, genero, genero_outro, status,
            psicologo_alocado_id, psicologo_nome, paciente_ref, alocado_em, confirmado_em,
            sla_expirado, transbordos, psicologos_ja_tentados, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           protocolo = VALUES(protocolo), nome_paciente = VALUES(nome_paciente),
           telefone = VALUES(telefone), idade = VALUES(idade), email = VALUES(email),
           cpf = VALUES(cpf), cep = VALUES(cep), numero_residencia = VALUES(numero_residencia),
           possui_convenio = VALUES(possui_convenio),
           convenio_selecionado = VALUES(convenio_selecionado), origem = VALUES(origem),
           turno = VALUES(turno), servico = VALUES(servico), servico_key = VALUES(servico_key),
           modalidade = VALUES(modalidade), para_quem_e = VALUES(para_quem_e),
           especificar_necessidades = VALUES(especificar_necessidades),
           necessidades_paciente = VALUES(necessidades_paciente),
           necessidades_outro = VALUES(necessidades_outro),
           opcao_avaliacao_psicologica = VALUES(opcao_avaliacao_psicologica),
           genero = VALUES(genero), genero_outro = VALUES(genero_outro),
           status = VALUES(status),
           psicologo_alocado_id = VALUES(psicologo_alocado_id), psicologo_nome = VALUES(psicologo_nome),
           paciente_ref = VALUES(paciente_ref),
           alocado_em = VALUES(alocado_em), confirmado_em = VALUES(confirmado_em),
           sla_expirado = VALUES(sla_expirado), transbordos = VALUES(transbordos),
           psicologos_ja_tentados = VALUES(psicologos_ja_tentados)`,
        [
          rowId('triagem', lead.id),
          instituicaoId(),
          organizacaoRef(),
          lead.id,
          lead.protocolo,
          lead.nomePaciente,
          lead.telefone,
          lead.idade ?? null,
          lead.email ?? null,
          lead.cpf ?? null,
          lead.cep ?? null,
          lead.numeroResidencia ?? null,
          lead.possuiConvenio ?? null,
          lead.convenioSelecionado,
          lead.origem,
          lead.turno,
          lead.servico ?? null,
          lead.servicoKey ?? null,
          lead.modalidade ?? null,
          lead.paraQuemE ?? null,
          lead.especificarNecessidades ? 1 : 0,
          asJson(lead.necessidadesPaciente),
          lead.necessidadesOutro ?? null,
          lead.opcaoAvaliacaoPsicologica ?? null,
          lead.genero ?? null,
          lead.generoOutro ?? null,
          lead.status,
          lead.psicologoAlocadoId ?? null,
          lead.psicologoNome ?? null,
          lead.pacienteRef ?? null,
          lead.alocadoEm ? toSqlTimestamp(lead.alocadoEm) : null,
          lead.confirmadoEm ? toSqlTimestamp(lead.confirmadoEm) : null,
          lead.slaExpirado ? 1 : 0,
          lead.transbordos ?? 0,
          asJson(lead.psicologosJaTentados),
          toSqlTimestamp(lead.criadoEm),
        ]
      );
    }
  }
}

export function captureStateAsSnapshot(state: CaptureState): PersistedSnapshot {
  return {
    ...emptySnapshot(),
    triagensPacientes: state.triagensPacientes,
    cadastrosPsicologos: state.cadastrosPsicologos,
  };
}

export function captureStateFromSnapshot(snapshot: PersistedSnapshot): CaptureState {
  return stateFromSnapshot(snapshot);
}
