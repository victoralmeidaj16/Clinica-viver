import 'server-only';

import type {
  Appointment,
  AppointmentMode,
  AppointmentStatus,
  IdentityUser,
  Organization,
  OrganizationMembership,
  OrganizationRole,
  PatientProfile,
  PatientResponsibleLink,
  ProfessionalProfile,
  ResponsibleParty,
} from '@thats-life/core';
import { instituicaoIdPadrao, organizationSlug, uuidDeterministico } from '@/server/oci/identidade';

/**
 * Tradução entre as linhas do MySQL e os agregados do core.
 *
 * A regra que organiza este arquivo: o domínio não sabe que existe um banco.
 * Nada aqui volta para `packages/core` — quando um campo do core não tem coluna
 * correspondente, quem se adapta é o mapper.
 */

/** Id da instituição, presente em toda tabela. */
export const instituicaoId = instituicaoIdPadrao;

/**
 * PK CHAR(36) derivada do id do agregado. A mesma chave produz sempre o mesmo
 * uuid; a volta é feita pela coluna `ref_core`, porque hash não se inverte.
 */
export function rowId(entidade: string, refCore: string): string {
  return uuidDeterministico(`${entidade}:${organizationSlug()}:${refCore}`);
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/**
 * A sessão do pool roda em UTC e o driver devolve TIMESTAMP como texto, então
 * `2026-08-03 12:00:00.000` é um instante absoluto — não um horário local.
 */
export function fromSqlTimestamp(value: string | Date | null): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  const normalized = value.includes('.') ? value : `${value}.000`;
  return `${normalized.replace(' ', 'T')}Z`;
}

export function toSqlTimestamp(iso: string): string {
  return new Date(iso).toISOString().slice(0, 23).replace('T', ' ');
}

export function toSqlDate(iso: string | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

// ---------------------------------------------------------------------------
// Organização
// ---------------------------------------------------------------------------

export interface OrganizacaoRow {
  ref_core: string;
  tipo: Organization['type'];
  nome_exibicao: string;
  razao_social: string | null;
  timezone: string;
  status: Organization['status'];
  criado_em: string;
  atualizado_em: string;
}

export function toOrganization(row: OrganizacaoRow): Organization {
  return {
    id: row.ref_core,
    type: row.tipo,
    displayName: row.nome_exibicao,
    legalName: row.razao_social ?? undefined,
    timezone: row.timezone,
    status: row.status,
    createdAt: fromSqlTimestamp(row.criado_em)!,
    updatedAt: fromSqlTimestamp(row.atualizado_em)!,
  };
}

// ---------------------------------------------------------------------------
// Usuário e vínculo
// ---------------------------------------------------------------------------

export interface UsuarioRow {
  ref_core: string;
  nome_exibicao: string;
  email_normalizado: string | null;
  status: IdentityUser['status'];
  criado_em: string;
  atualizado_em: string;
}

export function toIdentityUser(row: UsuarioRow): IdentityUser {
  return {
    id: row.ref_core,
    displayName: row.nome_exibicao,
    normalizedEmail: row.email_normalizado ?? undefined,
    status: row.status,
    createdAt: fromSqlTimestamp(row.criado_em)!,
    updatedAt: fromSqlTimestamp(row.atualizado_em)!,
  };
}

export interface MembroRow {
  ref_core: string;
  organizacao_ref: string;
  usuario_ref: string;
  papeis: string;
  status: OrganizationMembership['status'];
  profissional_ref: string | null;
  convidado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function toMembership(row: MembroRow): OrganizationMembership {
  return {
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    userId: row.usuario_ref,
    // SET do MySQL chega como lista separada por vírgula; vazio vira [].
    roles: row.papeis ? (row.papeis.split(',') as OrganizationRole[]) : [],
    status: row.status,
    professionalProfileId: row.profissional_ref ?? undefined,
    invitedBy: row.convidado_por ?? undefined,
    createdAt: fromSqlTimestamp(row.criado_em)!,
    updatedAt: fromSqlTimestamp(row.atualizado_em)!,
  };
}

// ---------------------------------------------------------------------------
// Profissional
// ---------------------------------------------------------------------------

export interface ProfissionalRow {
  ref_core: string;
  organizacao_ref: string;
  usuario_ref: string;
  nome: string;
  crp: string | null;
  ativo: number;
  especialidades: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function toProfessionalProfile(row: ProfissionalRow): ProfessionalProfile {
  return {
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    userId: row.usuario_ref,
    displayName: row.nome,
    councilType: 'CRP',
    councilRegistration: row.crp ?? '',
    specialties: row.especialidades ? row.especialidades.split(',') : [],
    status: row.ativo ? 'active' : 'inactive',
    createdAt: fromSqlTimestamp(row.criado_em)!,
    updatedAt: fromSqlTimestamp(row.atualizado_em)!,
  };
}

// ---------------------------------------------------------------------------
// Paciente
// ---------------------------------------------------------------------------

/**
 * O `status` do 004 descreve a posição do paciente na operação da clínica; o do
 * core descreve o tratamento. `fila` e `inativo` não têm equivalente exato —
 * quem está na fila de espera não tem tratamento em curso, e "inativo" na
 * recepção é alta do ponto de vista clínico. A conversão é assimétrica de
 * propósito: ela nunca escreve `fila` nem `inativo` de volta.
 */
const PACIENTE_STATUS_LEITURA: Record<string, PatientProfile['status']> = {
  ativo: 'active',
  fila: 'paused',
  pausado: 'paused',
  alta: 'discharged',
  inativo: 'discharged',
};

const PACIENTE_STATUS_ESCRITA: Record<PatientProfile['status'], string> = {
  active: 'ativo',
  paused: 'pausado',
  discharged: 'alta',
};

export function toPacienteStatus(status: PatientProfile['status']): string {
  return PACIENTE_STATUS_ESCRITA[status];
}

export interface PacienteRow {
  ref_core: string;
  organizacao_ref: string;
  usuario_ref: string | null;
  referencia_externa: string | null;
  nome: string;
  nome_social: string | null;
  data_nascimento: string | null;
  status: string;
  profissional_ref: string | null;
  atribuidos: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function toPatientProfile(row: PacienteRow): PatientProfile {
  const assigned = row.atribuidos ? row.atribuidos.split(',').filter(Boolean) : [];
  return {
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    userId: row.usuario_ref ?? undefined,
    externalReference: row.referencia_externa ?? undefined,
    // O nome social prevalece quando existe: é o nome pelo qual a pessoa é
    // chamada, e é ele que aparece na agenda e no cockpit.
    displayName: row.nome_social || row.nome,
    birthDate: row.data_nascimento ?? undefined,
    status: PACIENTE_STATUS_LEITURA[row.status] ?? 'active',
    primaryProfessionalId: row.profissional_ref ?? undefined,
    assignedProfessionalIds: assigned,
    createdAt: fromSqlTimestamp(row.criado_em)!,
    updatedAt: fromSqlTimestamp(row.atualizado_em)!,
  };
}

// ---------------------------------------------------------------------------
// Responsável
// ---------------------------------------------------------------------------

export interface ResponsavelRow {
  ref_core: string;
  organizacao_ref: string;
  usuario_ref: string | null;
  nome_exibicao: string;
  relacao: string;
  status: ResponsibleParty['status'];
  criado_em: string;
  atualizado_em: string;
}

export function toResponsibleParty(row: ResponsavelRow): ResponsibleParty {
  return {
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    userId: row.usuario_ref ?? undefined,
    displayName: row.nome_exibicao,
    relationshipLabel: row.relacao,
    status: row.status,
    createdAt: fromSqlTimestamp(row.criado_em)!,
    updatedAt: fromSqlTimestamp(row.atualizado_em)!,
  };
}

export interface PacienteResponsavelRow {
  ref_core: string;
  organizacao_ref: string;
  paciente_ref: string;
  responsavel_ref: string;
  autoridade: PatientResponsibleLink['authority'];
  pode_gerir_agenda: number;
  pode_ver_financeiro: number;
  pode_acessar_conteudo_clinico: number;
  pode_gerir_tarefas: number;
  pode_gerir_avaliacoes: number;
  vigente_de: string;
  vigente_ate: string | null;
  criado_em: string;
}

export function toPatientResponsibleLink(row: PacienteResponsavelRow): PatientResponsibleLink {
  return {
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    patientId: row.paciente_ref,
    responsiblePartyId: row.responsavel_ref,
    authority: row.autoridade,
    canManageAppointments: Boolean(row.pode_gerir_agenda),
    canViewBilling: Boolean(row.pode_ver_financeiro),
    canAccessSharedClinicalContent: Boolean(row.pode_acessar_conteudo_clinico),
    canManageTasks: Boolean(row.pode_gerir_tarefas),
    canManageAssessments: Boolean(row.pode_gerir_avaliacoes),
    activeFrom: fromSqlTimestamp(row.vigente_de)!,
    activeUntil: fromSqlTimestamp(row.vigente_ate),
    createdAt: fromSqlTimestamp(row.criado_em)!,
  };
}

// ---------------------------------------------------------------------------
// Agendamento
// ---------------------------------------------------------------------------

const AGENDAMENTO_STATUS_LEITURA: Record<string, AppointmentStatus> = {
  agendado: 'scheduled',
  confirmado: 'confirmed',
  cancelado: 'cancelled',
  faltou: 'no_show',
  realizado: 'completed',
};

const AGENDAMENTO_STATUS_ESCRITA: Record<AppointmentStatus, string> = {
  scheduled: 'agendado',
  confirmed: 'confirmado',
  cancelled: 'cancelado',
  no_show: 'faltou',
  completed: 'realizado',
};

const MODALIDADE_LEITURA: Record<string, AppointmentMode> = {
  presencial: 'in_person',
  online: 'video',
  telefone: 'phone',
};

const MODALIDADE_ESCRITA: Record<AppointmentMode, string> = {
  in_person: 'presencial',
  video: 'online',
  phone: 'telefone',
};

export const toAgendamentoStatus = (status: AppointmentStatus) => AGENDAMENTO_STATUS_ESCRITA[status];
export const toModalidade = (mode: AppointmentMode) => MODALIDADE_ESCRITA[mode];

export interface AgendamentoRow {
  ref_core: string;
  organizacao_ref: string;
  paciente_ref: string;
  profissional_ref: string;
  inicio: string;
  fim: string | null;
  duracao_min: number;
  timezone: string;
  modalidade: string;
  status: string;
  recorrencia: string | Record<string, unknown> | null;
  cancelado_codigo: string | null;
  sessao_clinica_ref: string | null;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

export interface LembreteRow {
  agendamento_ref: string;
  ref_core: string;
  canal: 'email' | 'whatsapp' | 'push';
  minutos_antes: number;
}

export function toAppointment(row: AgendamentoRow, lembretes: readonly LembreteRow[]): Appointment {
  const startsAt = fromSqlTimestamp(row.inicio)!;
  // `fim` é a fonte; `duracao_min` só entra como fallback para linhas criadas
  // pelo Sponteiro, que não preenche a coluna nova.
  const endsAt =
    fromSqlTimestamp(row.fim) ??
    new Date(Date.parse(startsAt) + row.duracao_min * 60_000).toISOString();

  const recurrence =
    typeof row.recorrencia === 'string' ? JSON.parse(row.recorrencia) : row.recorrencia;

  return {
    schemaVersion: 1,
    id: row.ref_core,
    organizationId: row.organizacao_ref,
    patientId: row.paciente_ref,
    professionalId: row.profissional_ref,
    startsAt,
    endsAt,
    timezone: row.timezone,
    mode: MODALIDADE_LEITURA[row.modalidade] ?? 'in_person',
    status: AGENDAMENTO_STATUS_LEITURA[row.status] ?? 'scheduled',
    reminders: lembretes
      .filter((item) => item.agendamento_ref === row.ref_core)
      .map((item) => ({ id: item.ref_core, channel: item.canal, minutesBefore: item.minutos_antes })),
    recurrence: recurrence ?? undefined,
    clinicalSessionId: row.sessao_clinica_ref ?? undefined,
    cancellationReasonCode: row.cancelado_codigo ?? undefined,
    version: row.versao,
    createdAt: fromSqlTimestamp(row.criado_em)!,
    updatedAt: fromSqlTimestamp(row.atualizado_em)!,
  };
}
