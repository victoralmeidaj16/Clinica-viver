import 'server-only';
import { validarAcessibilidade } from '@/lib/psychologistAccessibility';

import { assertMudancasDeCadastroUnicas } from '@/server/application/psychologistUniqueness';
import { assertEmailsDeCadastroDisponiveis, syncIdentidadeDoCadastro } from '@/server/application/psychologistIdentityGuard';

import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { PreferenciaGeneroPsicologo } from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import {
  emptySnapshot,
  readSnapshot,
  type AceiteTermoAdesao,
  type AusenciaAgenda,
  type CadastroPsicologoRecord,
  type EnvioComprovanteTermo,
  type PersistedSnapshot,
  type StatusCadastroPsicologo,
  type StatusTriagem,
  type TriagemPacienteRecord,
} from '@/server/application/persistence';
import {
  fromSqlTimestamp,
  instituicaoId,
  rowId,
  toSqlDate,
  toSqlTimestamp,
} from './mappers';
import { comTurmasEncerradas } from '@/server/persistence/turmasEncerradas';

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
  nome_social?: string | null;
  telefone: string;
  data_nascimento?: string | Date | null;
  idade: string | null;
  email: string | null;
  cpf: string | null;
  cep: string | null;
  logradouro: string | null;
  possui_convenio: string | null;
  convenio_selecionado: string;
  origem: string;
  turno: string;
  servico: string | null;
  servico_key: string | null;
  modalidade: string | null;
  numero_residencia: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado_uf: string | null;
  para_quem_e: string | null;
  preferencia_genero_psicologo: string | null;
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
  aceito_em: string | null;
  confirmado_em: string | null;
  sla_expirado: number;
  transbordos: number;
  psicologos_ja_tentados: unknown;
  tipo_alocacao?: string | null;
  criado_em: string;
}

interface PsicologoRow extends RowDataPacket {
  reconfiguracao_atendimento_pendente?: number;
  ref_core: string;
  nome_completo: string;
  nome_social: string | null;
  crp: string;
  whatsapp: string;
  email: string | null;
  foto_url: string | null;
  acessibilidade?: unknown;
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
  tempos_atendimento: unknown;
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
  solicitacao_alteracao_gestao?: unknown;
  aceite_termo_adesao?: unknown;
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

function asNumberArray(value: unknown): number[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      parsed = [];
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is number => item === 50 || item === 90)
    : [];
}

function asJson(value: readonly unknown[] | undefined): string {
  return JSON.stringify(value ?? []);
}

function asNullableJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/**
 * Preferência de gênero como ela volta do banco.
 *
 * Só masculino e feminino sobrevivem; `NULL`, `'SEM_PREFERENCIA'` e qualquer
 * outro conteúdo viram ausência — que é como o rodízio lê "a fila inteira
 * serve". Leads gravados antes da coluna existir caem exatamente aqui.
 */
function preferenciaGeneroLida(valor: string | null): PreferenciaGeneroPsicologo | undefined {
  return valor === 'MASCULINO' || valor === 'FEMININO' ? valor : undefined;
}

function tipoAlocacaoLido(valor: string | null | undefined): TriagemPacienteRecord['tipoAlocacao'] {
  return valor === 'ESCOLHA_DIRETA' || valor === 'RODIZIO' ? valor : undefined;
}

function dataNascimentoLida(valor: string | Date | null | undefined): string | undefined {
  if (!valor) return undefined;
  const iso = valor instanceof Date ? valor.toISOString() : String(valor);
  return iso.slice(0, 10) || undefined;
}

function toLead(row: TriagemRow): TriagemPacienteRecord {
  return {
    id: row.ref_core,
    protocolo: row.protocolo,
    nomePaciente: row.nome_paciente,
    nomeSocial: row.nome_social?.trim() || undefined,
    telefone: row.telefone,
    dataNascimento: dataNascimentoLida(row.data_nascimento),
    idade: row.idade ?? undefined,
    email: row.email ?? undefined,
    cpf: row.cpf ?? undefined,
    cep: row.cep ?? undefined,
    logradouro: row.logradouro ?? undefined,
    possuiConvenio: row.possui_convenio ?? undefined,
    convenioSelecionado: row.convenio_selecionado,
    origem: row.origem,
    turno: row.turno,
    servico: row.servico ?? undefined,
    servicoKey: row.servico_key ?? undefined,
    modalidade: row.modalidade ?? undefined,
    numeroResidencia: row.numero_residencia ?? undefined,
    complemento: row.complemento ?? undefined,
    bairro: row.bairro ?? undefined,
    cidade: row.cidade ?? undefined,
    estadoUf: row.estado_uf ?? undefined,
    paraQuemE: row.para_quem_e ?? undefined,
    preferenciaGeneroPsicologo: preferenciaGeneroLida(row.preferencia_genero_psicologo),
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
    aceitoEm: fromSqlTimestamp(row.aceito_em),
    confirmadoEm: fromSqlTimestamp(row.confirmado_em),
    slaExpirado: Boolean(row.sla_expirado),
    transbordos: row.transbordos,
    psicologosJaTentados: asStringArray(row.psicologos_ja_tentados),
    tipoAlocacao: tipoAlocacaoLido(row.tipo_alocacao),
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
    acessibilidade: (() => {
      try {
        const value = typeof row.acessibilidade === 'string' ? JSON.parse(row.acessibilidade) : row.acessibilidade;
        const parsed = validarAcessibilidade(value);
        return parsed.ok ? parsed.data : undefined;
      } catch { return undefined; }
    })(),
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
    reconfiguracaoAtendimentoPendente: Boolean(row.reconfiguracao_atendimento_pendente),
    minibio: row.minibio ?? undefined,
    status: row.status,
    criadoEm: fromSqlTimestamp(row.criado_em) ?? new Date(0).toISOString(),
    turnosDisponiveis: asStringArray(row.turnos_disponiveis),
    modalidadesAtendidas: asStringArray(row.modalidades_atendidas),
    servicosHabilitados: asStringArray(row.servicos_habilitados),
    servicosPrestados: asStringArray(row.servicos_prestados),
    temposAtendimento: asNumberArray(row.tempos_atendimento),
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
    solicitacaoAlteracaoGestao: (() => {
      if (!row.solicitacao_alteracao_gestao) return undefined;
      try {
        return typeof row.solicitacao_alteracao_gestao === 'string'
          ? JSON.parse(row.solicitacao_alteracao_gestao)
          : (row.solicitacao_alteracao_gestao as CadastroPsicologoRecord['solicitacaoAlteracaoGestao']);
      } catch {
        return undefined;
      }
    })(),
    ...aceiteDaLinha(row.aceite_termo_adesao),
  };
}

function aceiteDaLinha(valor: unknown): Pick<
  CadastroPsicologoRecord,
  'aceiteTermoAdesao' | 'aceitouTermos' | 'aceitouTermosEm' | 'versaoTermos'
> {
  if (!valor) return {};
  try {
    const aceite = (typeof valor === 'string' ? JSON.parse(valor) : valor) as AceiteTermoAdesao;
    if (!aceite?.aceitoEm || !aceite.versao) return {};
    return {
      aceiteTermoAdesao: aceite,
      aceitouTermos: true,
      aceitouTermosEm: aceite.aceitoEm,
      versaoTermos: aceite.versao,
    };
  } catch {
    return {};
  }
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
    return this.mutateAtomic((state) => mutator(state));
  }

  async mutateAtomic<T>(mutator: (state: CaptureState, connection: PoolConnection) => Promise<CaptureResult<T>> | CaptureResult<T>, organizationId?: string): Promise<T> {
    if (organizationId && organizationId !== organizacaoRef()) throw new Error('Acesso negado: organização não corresponde à captação.');
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      // Serializa inclusive a primeira inscrição, quando ainda não há cadastro para travar.
      await connection.query(
        'SELECT id FROM clinica_organizacoes WHERE instituicao_id = ? AND ref_core = ? FOR UPDATE',
        [instituicaoId(), organizacaoRef()]
      );
      const current = await this.readState(connection, true);
      const migrated = await this.importLegacyIfNeeded(connection, current);
      const change = await mutator(migrated, connection);
      assertMudancasDeCadastroUnicas(migrated.cadastrosPsicologos, change.next.cadastrosPsicologos);
      await assertEmailsDeCadastroDisponiveis(connection, migrated.cadastrosPsicologos, change.next.cadastrosPsicologos);
      await syncIdentidadeDoCadastro(connection, migrated.cadastrosPsicologos, change.next.cadastrosPsicologos);
      await this.writeState(connection, change.next, migrated);
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

  /**
   * Anota na prova do aceite o que o provedor de e-mail respondeu ao envio do
   * comprovante. `JSON_SET` mexe só nessa chave: data, IP e hashes gravados no
   * credenciamento continuam intocados.
   */
  async registrarEnvioComprovanteTermo(
    cadastroId: string,
    envio: EnvioComprovanteTermo,
    campo: 'envioComprovante' | 'envioComprovanteConvite' = 'envioComprovante'
  ): Promise<void> {
    if (!(await this.supportsAceiteTermoColumn(this.pool))) return;
    await this.pool.execute(
      `UPDATE clinica_cadastros_psicologos
          SET aceite_termo_adesao = JSON_SET(aceite_termo_adesao, '$.${campo}', CAST(? AS JSON))
        WHERE id = ? AND aceite_termo_adesao IS NOT NULL`,
      [JSON.stringify(envio), rowId('cadastro_psicologo', cadastroId)]
    );
  }

  private static hasNomeSocialColumn: boolean | null = null;
  private static hasAceiteTermoColumn = false;
  private static hasNascimentoAlocacaoColumns = false;
  private static hasAcessibilidadeColumn = false;
  private static hasReconfiguracaoColumn = false;

  private async supportsReconfiguracaoColumn(connection: Pool | PoolConnection): Promise<boolean> {
    if (MysqlCaptureRepository.hasReconfiguracaoColumn) return true;
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE()
        AND table_name = 'clinica_cadastros_psicologos' AND column_name = 'reconfiguracao_atendimento_pendente' LIMIT 1`
    );
    MysqlCaptureRepository.hasReconfiguracaoColumn = rows.length > 0;
    return MysqlCaptureRepository.hasReconfiguracaoColumn;
  }

  private async supportsAcessibilidadeColumn(connection: Pool | PoolConnection): Promise<boolean> {
    if (MysqlCaptureRepository.hasAcessibilidadeColumn) return true;
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE()
        AND table_name = 'clinica_cadastros_psicologos' AND column_name = 'acessibilidade' LIMIT 1`
    );
    MysqlCaptureRepository.hasAcessibilidadeColumn = rows.length > 0;
    return MysqlCaptureRepository.hasAcessibilidadeColumn;
  }

  /**
   * A Vercel publica a cada push e pode rodar antes da migração chegar ao
   * banco. Sem a coluna, o cadastro segue funcionando e só a prova do aceite
   * deixa de ser lida e gravada, em vez de toda leitura da captação falhar.
   * Só o "sim" fica em cache: a coluna passa a ser usada assim que a migração
   * rodar, sem reiniciar o processo.
   */
  private async supportsAceiteTermoColumn(connection: Pool | PoolConnection): Promise<boolean> {
    if (MysqlCaptureRepository.hasAceiteTermoColumn) return true;
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'aceite_termo_adesao'
          LIMIT 1`
      );
      MysqlCaptureRepository.hasAceiteTermoColumn = rows.length > 0;
    } catch {
      return false;
    }
    return MysqlCaptureRepository.hasAceiteTermoColumn;
  }

  private async supportsNascimentoAlocacaoColumns(connection: Pool | PoolConnection): Promise<boolean> {
    if (MysqlCaptureRepository.hasNascimentoAlocacaoColumns) return true;
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'data_nascimento'
          LIMIT 1`
      );
      MysqlCaptureRepository.hasNascimentoAlocacaoColumns = rows.length > 0;
    } catch {
      return false;
    }
    return MysqlCaptureRepository.hasNascimentoAlocacaoColumns;
  }

  private async supportsNomeSocialColumn(connection: Pool | PoolConnection): Promise<boolean> {
    if (MysqlCaptureRepository.hasNomeSocialColumn !== null) return MysqlCaptureRepository.hasNomeSocialColumn;
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'nome_social'
          LIMIT 1`
      );
      MysqlCaptureRepository.hasNomeSocialColumn = rows.length > 0;
    } catch {
      MysqlCaptureRepository.hasNomeSocialColumn = false;
    }
    return MysqlCaptureRepository.hasNomeSocialColumn;
  }

  private async readState(
    connection: Pool | PoolConnection,
    lockRows: boolean
  ): Promise<CaptureState> {
    const lock = lockRows ? ' FOR UPDATE' : '';
    const temNomeSocial = await this.supportsNomeSocialColumn(connection);
    const temNascimentoAlocacao = await this.supportsNascimentoAlocacaoColumns(connection);
    const temAceiteTermo = await this.supportsAceiteTermoColumn(connection);
    const temAcessibilidade = await this.supportsAcessibilidadeColumn(connection);
    const temReconfiguracao = await this.supportsReconfiguracaoColumn(connection);
    const campoNomeSocial = temNomeSocial ? 'nome_social' : 'NULL AS nome_social';
    const [leadRows] = await connection.query<TriagemRow[]>(
      `SELECT ref_core, protocolo, nome_paciente, ${campoNomeSocial}, telefone,${temNascimentoAlocacao ? ' data_nascimento,' : ''} idade, email, cpf, cep,
              logradouro, numero_residencia, complemento, bairro, cidade, estado_uf,
              possui_convenio, convenio_selecionado, origem, turno, servico,
              servico_key, modalidade, para_quem_e, preferencia_genero_psicologo,
              especificar_necessidades,
              necessidades_paciente, necessidades_outro, opcao_avaliacao_psicologica,
              genero, genero_outro, status, psicologo_alocado_id,
              psicologo_nome, paciente_ref, alocado_em, aceito_em, confirmado_em, sla_expirado,
              transbordos, psicologos_ja_tentados,${temNascimentoAlocacao ? ' tipo_alocacao,' : ''} criado_em
         FROM clinica_triagens_pacientes
        WHERE instituicao_id = ? AND organizacao_ref = ?
        ORDER BY criado_em${lock}`,
      [instituicaoId(), organizacaoRef()]
    );
    const [psychRows] = await connection.query<PsicologoRow[]>(
      `SELECT ref_core, nome_completo, nome_social, crp, whatsapp, email, foto_url,${temAcessibilidade ? ' acessibilidade,' : ''}
              usuario_ref, profissional_ref, acesso_criado_em, boas_vindas_enviada_em,
              cidade_uf, estado_uf, cidade, logradouro, bairro,
              genero, genero_outro,
              especialidade, modalidade_atendimento, atendimento_preferencia, minibio, status,
              turnos_disponiveis, modalidades_atendidas, servicos_habilitados,
              servicos_prestados, tempos_atendimento, publico_alvo, publico_alvo_outro,
              especificar_necessidades, necessidades_atendidas, necessidades_outro,
              limite_pacientes_ativos, pacientes_ativos_count, exibir_na_vitrine,
              pausado_no_rodizio, motivo_pausa_rodizio, motivo_desativacao, ultimo_lead_recebido_em, turma_viver_mais,
              pos_graduacao_viver_mais, segunda_pos_graduacao_viver_mais,
              solicitacao_alteracao_gestao,${temReconfiguracao ? ' reconfiguracao_atendimento_pendente,' : ''}${temAceiteTermo ? ' aceite_termo_adesao,' : ''} criado_em
         FROM clinica_cadastros_psicologos
        WHERE instituicao_id = ? AND organizacao_ref = ?
        ORDER BY criado_em${lock}`,
      [instituicaoId(), organizacaoRef()]
    );
    return {
      triagensPacientes: leadRows.map(toLead),
      cadastrosPsicologos: await comTurmasEncerradas(
        await this.comAusencias(connection, psychRows.map(toPsychologist)),
        connection
      ),
    };
  }

  /**
   * Anexa as férias/folgas que cada profissional marcou na própria agenda.
   *
   * Uma consulta para a organização inteira, não uma por psicólogo: o roster do
   * rodízio é lido a cada alocação, e um N+1 aqui apareceria no caminho crítico
   * de todo encaminhamento.
   *
   * Só ausências que ainda não terminaram entram. É o que faz a pausa se
   * desfazer sozinha no fim das férias — sem job, sem alguém lembrando de
   * desmarcar.
   *
   * Falha em silêncio: a agenda é um módulo à parte, e uma indisponibilidade
   * dela não pode derrubar a leitura da fila de triagem. O custo do silêncio é
   * um profissional de férias continuar recebendo encaminhamento até a agenda
   * responder de novo — ruim, mas menos do que a captação inteira parar.
   */
  private async comAusencias(
    connection: Pool | PoolConnection,
    cadastros: CadastroPsicologoRecord[]
  ): Promise<CadastroPsicologoRecord[]> {
    if (cadastros.length === 0) return cadastros;
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT p.ref_core AS profissional_ref, b.inicio, b.fim, b.motivo, b.criado_em
           FROM clinica_agenda_bloqueios b
           JOIN clinica_profissionais p ON p.id = b.profissional_id
           JOIN clinica_organizacoes o ON o.id = p.organizacao_id
          WHERE b.instituicao_id = ? AND o.ref_core = ?
            AND b.tipo = 'dia' AND b.fim > UTC_TIMESTAMP(3)
          ORDER BY b.inicio`,
        [instituicaoId(), organizacaoRef()]
      );
      if (rows.length === 0) return cadastros;

      const porProfissional = new Map<string, AusenciaAgenda[]>();
      for (const row of rows) {
        const ref = String(row.profissional_ref);
        const lista = porProfissional.get(ref) ?? [];
        lista.push({
          inicio: new Date(row.inicio).toISOString(),
          fim: new Date(row.fim).toISOString(),
          motivo: row.motivo ? String(row.motivo) : undefined,
          criadoEm: fromSqlTimestamp(row.criado_em) ?? new Date(row.inicio).toISOString(),
        });
        porProfissional.set(ref, lista);
      }

      return cadastros.map((cadastro) => {
        const ausencias = cadastro.profissionalRef
          ? porProfissional.get(cadastro.profissionalRef)
          : undefined;
        return ausencias ? { ...cadastro, ausenciasAgenda: ausencias } : cadastro;
      });
    } catch (error) {
      console.error('Erro ao ler ausências da agenda para o roster:', error);
      return cadastros;
    }
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

  private static psychValues(psych: CadastroPsicologoRecord): Array<string | number | null> {
    return [
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
      asJson(psych.temposAtendimento),
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
      asNullableJson(psych.solicitacaoAlteracaoGestao),
      toSqlTimestamp(psych.criadoEm),
    ];
  }

  private static leadEntries(
    lead: TriagemPacienteRecord,
    temNomeSocial: boolean,
    temNascimentoAlocacao: boolean
  ): Array<[string, string | number | null, boolean]> {
    const entries: Array<[string, string | number | null, boolean]> = [
      ['id', rowId('triagem', lead.id), false],
      ['instituicao_id', instituicaoId(), false],
      ['organizacao_ref', organizacaoRef(), false],
      ['ref_core', lead.id, false],
      ['protocolo', lead.protocolo, true],
      ['nome_paciente', lead.nomePaciente, true],
    ];
    if (temNomeSocial) entries.push(['nome_social', lead.nomeSocial?.trim() || null, true]);
    entries.push(['telefone', lead.telefone, true]);
    if (temNascimentoAlocacao) entries.push(['data_nascimento', toSqlDate(lead.dataNascimento), true]);
    entries.push(
      ['idade', lead.idade ?? null, true],
      ['email', lead.email ?? null, true],
      ['cpf', lead.cpf ?? null, true],
      ['cep', lead.cep ?? null, true],
      ['logradouro', lead.logradouro ?? null, true],
      ['numero_residencia', lead.numeroResidencia ?? null, true],
      ['complemento', lead.complemento ?? null, true],
      ['bairro', lead.bairro ?? null, true],
      ['cidade', lead.cidade ?? null, true],
      ['estado_uf', lead.estadoUf ?? null, true],
      ['possui_convenio', lead.possuiConvenio ?? null, true],
      ['convenio_selecionado', lead.convenioSelecionado, true],
      ['origem', lead.origem, true],
      ['turno', lead.turno, true],
      ['servico', lead.servico ?? null, true],
      ['servico_key', lead.servicoKey ?? null, true],
      ['modalidade', lead.modalidade ?? null, true],
      ['para_quem_e', lead.paraQuemE ?? null, true],
      ['preferencia_genero_psicologo', lead.preferenciaGeneroPsicologo ?? null, true],
      ['especificar_necessidades', lead.especificarNecessidades ? 1 : 0, true],
      ['necessidades_paciente', asJson(lead.necessidadesPaciente), true],
      ['necessidades_outro', lead.necessidadesOutro ?? null, true],
      ['opcao_avaliacao_psicologica', lead.opcaoAvaliacaoPsicologica ?? null, true],
      ['genero', lead.genero ?? null, true],
      ['genero_outro', lead.generoOutro ?? null, true],
      ['status', lead.status, true],
      ['psicologo_alocado_id', lead.psicologoAlocadoId ?? null, true],
      ['psicologo_nome', lead.psicologoNome ?? null, true],
      ['paciente_ref', lead.pacienteRef ?? null, true],
      ['alocado_em', lead.alocadoEm ? toSqlTimestamp(lead.alocadoEm) : null, true],
      ['aceito_em', lead.aceitoEm ? toSqlTimestamp(lead.aceitoEm) : null, true],
      ['confirmado_em', lead.confirmadoEm ? toSqlTimestamp(lead.confirmadoEm) : null, true],
      ['sla_expirado', lead.slaExpirado ? 1 : 0, true],
      ['transbordos', lead.transbordos ?? 0, true],
      ['psicologos_ja_tentados', asJson(lead.psicologosJaTentados), true]
    );
    if (temNascimentoAlocacao) entries.push(['tipo_alocacao', lead.tipoAlocacao ?? null, true]);
    entries.push(['criado_em', toSqlTimestamp(lead.criadoEm), false]);
    return entries;
  }

  private async writeState(
    connection: Pool | PoolConnection,
    state: CaptureState,
    previous?: CaptureState
  ): Promise<void> {
    const prevPsychs = previous
      ? new Map(previous.cadastrosPsicologos.map((item) => [item.id, item]))
      : null;
    for (const psych of state.cadastrosPsicologos) {
      const params = MysqlCaptureRepository.psychValues(psych);
      const before = prevPsychs?.get(psych.id);
      const changed =
        !before ||
        JSON.stringify(psych.acessibilidade) !== JSON.stringify(before.acessibilidade) ||
        Boolean(psych.reconfiguracaoAtendimentoPendente) !== Boolean(before.reconfiguracaoAtendimentoPendente) ||
        JSON.stringify(params) !== JSON.stringify(MysqlCaptureRepository.psychValues(before)) ||
        Boolean(psych.aceiteTermoAdesao && !before.aceiteTermoAdesao);
      if (!changed) continue;
      const temAcessibilidade = await this.supportsAcessibilidadeColumn(connection);
      const temReconfiguracao = await this.supportsReconfiguracaoColumn(connection);
      if (psych.reconfiguracaoAtendimentoPendente && !temReconfiguracao) {
        throw new Error('A troca de pós-graduação requer a migration 078_psicologo_reconfiguracao_atendimento.sql.');
      }
      if (psych.acessibilidade && !temAcessibilidade) {
        throw new Error('A gravação da acessibilidade requer a migration 076_psicologo_acessibilidade.sql.');
      }
      await connection.execute(
        `INSERT INTO clinica_cadastros_psicologos
           (id, instituicao_id, organizacao_ref, ref_core, nome_completo, nome_social,
            crp, whatsapp, email, foto_url, usuario_ref, profissional_ref, acesso_criado_em,
            boas_vindas_enviada_em, cidade_uf, estado_uf, cidade, logradouro, bairro,
            genero, genero_outro,
            especialidade, modalidade_atendimento, atendimento_preferencia,
            minibio, status, turnos_disponiveis, modalidades_atendidas,
            servicos_habilitados, servicos_prestados, tempos_atendimento, publico_alvo, publico_alvo_outro,
            especificar_necessidades, necessidades_atendidas, necessidades_outro,
            limite_pacientes_ativos, pacientes_ativos_count,
            exibir_na_vitrine, pausado_no_rodizio, motivo_pausa_rodizio,
            motivo_desativacao, ultimo_lead_recebido_em,
            turma_viver_mais, pos_graduacao_viver_mais, segunda_pos_graduacao_viver_mais,
            solicitacao_alteracao_gestao, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
           tempos_atendimento = VALUES(tempos_atendimento),
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
           segunda_pos_graduacao_viver_mais = VALUES(segunda_pos_graduacao_viver_mais),
           solicitacao_alteracao_gestao = VALUES(solicitacao_alteracao_gestao)`,
        params
      );
      if (temReconfiguracao) {
        await connection.execute(
          'UPDATE clinica_cadastros_psicologos SET reconfiguracao_atendimento_pendente = ? WHERE id = ?',
          [psych.reconfiguracaoAtendimentoPendente ? 1 : 0, rowId('cadastro_psicologo', psych.id)]
        );
      }
      if (temAcessibilidade) {
        await connection.execute(
          'UPDATE clinica_cadastros_psicologos SET acessibilidade = ? WHERE id = ?',
          [asNullableJson(psych.acessibilidade), rowId('cadastro_psicologo', psych.id)]
        );
      }
      // A prova do aceite é gravada uma única vez: `IS NULL` impede que uma
      // edição posterior do cadastro troque a data, o IP ou o hash registrados.
      if (psych.aceiteTermoAdesao && (await this.supportsAceiteTermoColumn(connection))) {
        await connection.execute(
          `UPDATE clinica_cadastros_psicologos
              SET aceite_termo_adesao = ?
            WHERE id = ? AND aceite_termo_adesao IS NULL`,
          [JSON.stringify(psych.aceiteTermoAdesao), rowId('cadastro_psicologo', psych.id)]
        );
      }
    }

    const temNomeSocial = await this.supportsNomeSocialColumn(connection);
    const temNascimentoAlocacao = await this.supportsNascimentoAlocacaoColumns(connection);
    const prevLeads = previous
      ? new Map(previous.triagensPacientes.map((item) => [item.id, item]))
      : null;
    for (const lead of state.triagensPacientes) {
      const entries = MysqlCaptureRepository.leadEntries(lead, temNomeSocial, temNascimentoAlocacao);
      const before = prevLeads?.get(lead.id);
      if (
        before &&
        JSON.stringify(entries) ===
          JSON.stringify(MysqlCaptureRepository.leadEntries(before, temNomeSocial, temNascimentoAlocacao))
      ) {
        continue;
      }
      const columns = entries.map(([col]) => col);
      const placeholders = entries.map(() => '?').join(', ');
      const updates = entries
        .filter(([, , up]) => up)
        .map(([col]) => `${col} = VALUES(${col})`)
        .join(',\n             ');
      await connection.execute(
        `INSERT INTO clinica_triagens_pacientes
           (${columns.join(', ')})
         VALUES (${placeholders})
         ON DUPLICATE KEY UPDATE
           ${updates}`,
        entries.map(([, val]) => val)
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
