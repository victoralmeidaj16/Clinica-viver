import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  Appointment,
  CarePlan,
  ClinicalRecord,
  ClinicalSession,
  ClinicalTimelineEntry,
  CommunicationConsent,
  CommunicationPreference,
  FinancialLedger,
  MoodCheckIn,
  NotificationMessage,
  PatientHandoff,
  PreSessionCheckIn,
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
  idade?: string;
  email?: string;
  cpf?: string;
  cep?: string;
  possuiConvenio?: string;
  convenioSelecionado: string;
  origem: string;
  turno: string;
  servico?: string;
  modalidade?: string;
  /** O formulário atual da vitrine ainda não coleta gênero. */
  genero?: string;
  status: string;
  criadoEm: string;
}

/** Psicólogo que se candidatou pelo formulário de credenciamento da vitrine. */
export interface CadastroPsicologoRecord {
  id: string;
  nomeCompleto: string;
  crp: string;
  whatsapp: string;
  email?: string;
  cidadeUf?: string;
  especialidade?: string;
  modalidadeAtendimento?: string;
  minibio?: string;
  status: string;
  criadoEm: string;
}

export interface PersistedSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAt: string;
  appointments: readonly Appointment[];
  sessions: readonly ClinicalSession[];
  records: readonly ClinicalRecord[];
  timeline: readonly ClinicalTimelineEntry[];
  checkIns: readonly PreSessionCheckIn[];
  notifications: readonly NotificationMessage[];
  ledger: FinancialLedger;
  carePlans: readonly CarePlan[];
  moodLogs: readonly MoodCheckIn[];
  deliveredHandoffs: readonly PatientHandoff[];
  assessments: readonly AssessmentRecord[];
  preferences: readonly CommunicationPreference[];
  consents: readonly CommunicationConsent[];
  /**
   * Opcionais porque só as rotas da vitrine escrevem estas coleções, e um
   * snapshot gravado pelo store da aplicação não as contém.
   */
  triagensPacientes?: readonly TriagemPacienteRecord[];
  cadastrosPsicologos?: readonly CadastroPsicologoRecord[];
}

/**
 * Snapshot vazio, para as rotas que precisam gravar antes de existir estado em
 * disco. Centralizado porque cada cópia manual do literal já divergiu do tipo:
 * o `ledger` escrito à mão trazia `transactions`/`payoutSplits`, campos que
 * `FinancialLedger` não tem, e o snapshot resultante quebrava a reidratação.
 */
export function emptySnapshot(): PersistedSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    appointments: [],
    sessions: [],
    records: [],
    timeline: [],
    checkIns: [],
    notifications: [],
    ledger: {
      charges: [],
      discounts: [],
      payments: [],
      refunds: [],
      fees: [],
      transfers: [],
    },
    carePlans: [],
    moodLogs: [],
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
