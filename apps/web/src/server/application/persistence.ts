import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  Appointment,
  ClinicalRecord,
  ClinicalSession,
  ClinicalTimelineEntry,
  CommunicationConsent,
  CommunicationPreference,
  FinancialLedger,
  NotificationMessage,
  PatientHandoff,
} from '@thats-life/core';

/**
 * Persistência local do estado de demonstração.
 *
 * Substitui o comportamento anterior, em que todo o estado vivia em
 * `globalThis` e desaparecia a cada restart do servidor. O arquivo não é um
 * banco: não há transações entre agregados, nem concorrência entre processos.
 * O que ele garante é continuidade — o que você fez numa demonstração continua
 * lá na próxima.
 *
 * É também o ensaio do adaptador real: quem for implementar `Firestore` escreve
 * contra as mesmas portas de repositório e substitui apenas este arquivo.
 *
 * A gravação usa arquivo temporário + rename atômico, para que um processo
 * interrompido no meio da escrita não deixe um snapshot truncado no lugar do
 * anterior.
 */

const SNAPSHOT_VERSION = 1 as const;

export interface AssessmentRecord {
  id: string;
  organizationId: string;
  patientId: string;
  type: string;
  answers: Record<string, number>;
  score: number;
  completedAt: string;
}

/**
 * Situação do lead na fila de alocação.
 *
 * `PENDENTE_ATRIBUICAO` é o estado de quem chegou e não achou profissional
 * elegível: fica visível para a gestão decidir, em vez de sumir.
 */
export type StatusTriagem =
  | 'PENDENTE_ATRIBUICAO'
  | 'AGUARDANDO_CONTATO'
  | 'CONTATO_CONFIRMADO'
  | 'DESISTENTE'
  | 'FINALIZADO';

/**
 * Lead capturado pelo formulário público da vitrine, antes de virar paciente.
 *
 * Os campos opcionais são os que o formulário pode deixar em branco: as rotas
 * gravam `body.<campo>` sem valor padrão, então o registro nasce sem eles.
 */
export interface TriagemPacienteRecord {
  id: string;
  protocolo: string;
  nomePaciente: string;
  telefone: string;
  dataNascimento?: string;
  idade?: string;
  email?: string;
  cpf?: string;
  cep?: string;
  numeroResidencia?: string;
  possuiConvenio?: string;
  convenioSelecionado: string;
  origem: string;
  turno: string;
  /** Título legível do serviço, como aparece na vitrine. */
  servico?: string;
  /** Chave do serviço (`PSICOTERAPIA`, `AVALIACAO`, …), que o rodízio compara. */
  servicoKey?: string;
  modalidade?: string;
  paraQuemE?: string;
  especificarNecessidades?: boolean;
  necessidadesPaciente?: readonly string[];
  necessidadesOutro?: string;
  opcaoAvaliacaoPsicologica?: string;
  genero?: string;
  generoOutro?: string;
  status: StatusTriagem;
  criadoEm: string;

  /**
   * Estado da alocação. Opcionais porque um lead que chegou sem profissional
   * elegível nunca chega a ter nenhum deles — e porque leads gravados antes
   * destes campos existirem continuam válidos.
   */
  psicologoAlocadoId?: string;
  psicologoNome?: string;
  /**
   * Paciente criado a partir deste lead, quando o contato foi confirmado.
   * Ausente enquanto a promoção não aconteceu — é o que a reconciliação
   * procura para reprocessar leads confirmados que ficaram sem paciente.
   */
  pacienteRef?: string;
  /** Início da contagem do SLA de 24h. O relógio é sempre derivado daqui. */
  alocadoEm?: string;
  confirmadoEm?: string;
  slaExpirado?: boolean;
  transbordos?: number;
  /** Quem já teve a chance neste lead, para o transbordo não voltar ao mesmo. */
  psicologosJaTentados?: readonly string[];
}

/** Situação do psicólogo no credenciamento. `APROVADO` significa "no rodízio". */
export type StatusCadastroPsicologo = 'EM_ANALISE' | 'APROVADO' | 'RECUSADO';

/**
 * Psicólogo que se candidatou pelo formulário de credenciamento da vitrine.
 *
 * É também o cadastro que alimenta o rodízio: um profissional `APROVADO` é um
 * profissional na roda. Ter uma segunda lista de "quem atende" seria ter duas
 * verdades sobre a mesma pessoa.
 *
 * Os campos de rodízio são opcionais porque a candidatura pública não os
 * coleta — quem os preenche é a gestão, ao aprovar. Sem eles o profissional
 * simplesmente não casa com nenhum lead, que é o comportamento correto para um
 * cadastro incompleto.
 */
export interface CadastroPsicologoRecord {
  id: string;
  nomeCompleto: string;
  nomeSocial?: string;
  crp: string;
  whatsapp: string;
  email?: string;
  fotoUrl?: string;
  usuarioRef?: string;
  profissionalRef?: string;
  acessoCriadoEm?: string;
  boasVindasEnviadaEm?: string;
  cidadeUf?: string;
  estadoUf?: string;
  cidade?: string;
  logradouro?: string;
  bairro?: string;
  genero?: string;
  generoOutro?: string;
  especialidade?: string;
  modalidadeAtendimento?: string;
  atendimentoPreferencia?: 'PARTICULAR' | 'SOCIAL' | 'AMBOS';
  minibio?: string;
  status: StatusCadastroPsicologo;
  criadoEm: string;

  /** Critérios que o rodízio cruza. Ver `viverMaisRodizio.ts`. */
  turnosDisponiveis?: readonly string[];
  modalidadesAtendidas?: readonly string[];
  servicosHabilitados?: readonly string[];
  servicosPrestados?: readonly string[];
  publicoAlvo?: readonly string[];
  publicoAlvoOutro?: string;
  especificarNecessidades?: boolean;
  necessidadesAtendidas?: readonly string[];
  necessidadesOutro?: string;
  limitePacientesAtivos?: number;
  pacientesAtivosCount?: number;
  /**
   * Aparece no site público. Responde só por visibilidade — desde a separação,
   * quem decide se a pessoa recebe encaminhamento é `pausadoNoRodizio`.
   */
  exibirNaVitrine?: boolean;
  motivoDesativacao?: string;
  /**
   * Fora da fila de encaminhamento, sem sumir da vitrine.
   *
   * Existe porque as duas situações se separaram na operação: quem está de
   * férias precisa parar de receber e continuar visível para os próprios
   * pacientes; um perfil sem foto sai do site e segue atendendo quem já é seu.
   */
  pausadoNoRodizio?: boolean;
  motivoPausaRodizio?: string;
  /** Atualizado a cada alocação; é o que faz o rodízio girar. */
  ultimoLeadRecebidoEm?: string;
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
}

export interface LancamentoLedgerAluno {
  id: string;
  psicologoId: string;
  psicologoNome: string;
  pacienteNome: string;
  sessaoId?: string;
  valorTotal: number;
  valorCreditoAluno: number; // 70%
  valorReceitaClinica: number; // 30%
  status: 'PENDENTE' | 'CREDITADO';
  dataLancamento: string;
}

export interface AuditoriaDesistenciaRecord {
  id: string;
  pacienteId?: string;
  pacienteNome: string;
  psicologoId?: string;
  psicologoNome: string;
  motivo: 'FINANCEIRO' | 'INSATISFACAO_CONDUTA' | 'TROCA_ABORDAGEM' | 'MOTIVOS_PESSOAIS' | 'OUTRO';
  descricaoDetalhada?: string;
  acaoSugestao?: string;
  dataDesistencia: string;
  reengajado: boolean;
  observacoesReengajamento?: string;
  permitirTrocaPsicologo?: boolean;
}

export interface PersistedSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAt: string;
  appointments: readonly Appointment[];
  sessions: readonly ClinicalSession[];
  records: readonly ClinicalRecord[];
  timeline: readonly ClinicalTimelineEntry[];
  notifications: readonly NotificationMessage[];
  ledger: FinancialLedger;
  deliveredHandoffs: readonly PatientHandoff[];
  assessments: readonly AssessmentRecord[];
  preferences: readonly CommunicationPreference[];
  consents: readonly CommunicationConsent[];
  triagensPacientes?: readonly TriagemPacienteRecord[];
  cadastrosPsicologos?: readonly CadastroPsicologoRecord[];
  ledgerAlunos?: readonly LancamentoLedgerAluno[];
  auditoriaDesistencias?: readonly AuditoriaDesistenciaRecord[];
}

export function emptySnapshot(): PersistedSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    appointments: [],
    sessions: [],
    records: [],
    timeline: [],
    notifications: [],
    ledger: {
      charges: [],
      discounts: [],
      payments: [],
      refunds: [],
      fees: [],
      transfers: [],
    },
    deliveredHandoffs: [],
    assessments: [],
    preferences: [],
    consents: [],
    triagensPacientes: [],
    cadastrosPsicologos: [],
  };
}

function snapshotPath(): string {
  const configured = process.env.DEMO_STATE_FILE?.trim();
  if (configured) return configured;
  return join(process.cwd(), '.demo-state', 'application-state.json');
}

/**
 * Leitura síncrona, deliberadamente. O store é resolvido de forma síncrona por
 * todas as rotas; tornar a hidratação assíncrona propagaria `async` por toda a
 * camada de aplicação em troca de nada — isto acontece uma única vez, na
 * primeira requisição após o boot.
 */
export function readSnapshot(): PersistedSnapshot | null {
  try {
    const raw = readFileSync(snapshotPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;

    // Um snapshot de outra versão de esquema é descartado em silêncio: recair
    // no seed é preferível a reidratar o estado com um formato que já mudou.
    if (parsed.version !== SNAPSHOT_VERSION) {
      return null;
    }
    return parsed as PersistedSnapshot;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return null;
    }
    console.warn('[persistência] Snapshot ilegível, retomando a partir do seed:', err);
    return null;
  }
}

let pendingWrite: Promise<void> = Promise.resolve();

export function writeSnapshot(snapshot: PersistedSnapshot): Promise<void> {
  // As escritas são encadeadas para que dois requests concorrentes não
  // disputem o mesmo arquivo temporário.
  pendingWrite = pendingWrite.then(async () => {
    const target = snapshotPath();
    const temporary = `${target}.tmp`;
    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(temporary, JSON.stringify(snapshot, null, 2), 'utf8');
      await rename(temporary, target);
    } catch (err) {
      // Falha ao persistir não pode derrubar a requisição em curso: o estado
      // em memória continua correto e a próxima escrita tenta de novo.
      console.warn('[persistência] Não foi possível gravar o snapshot:', err);
    }
  });
  return pendingWrite;
}

export async function flushPendingWrites(): Promise<void> {
  await pendingWrite;
}
