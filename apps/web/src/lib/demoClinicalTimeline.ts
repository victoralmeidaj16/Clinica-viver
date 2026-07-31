import {
  createClinicalTimelineEntry,
  type ClinicalTimelineCategory,
  type ClinicalTimelineEntry,
  type ClinicalTimelineImportance,
  type TimelineEvidenceReference,
} from '@thats-life/core';

const organizationId = 'demo-org-01';
const patientId = 'pac_01';
const authorizedProfessionalIds = ['psi-demo-01'];

function entry(input: {
  id: string;
  category: ClinicalTimelineCategory;
  importance?: ClinicalTimelineImportance;
  occurredAt: string;
  title: string;
  summary: string;
  excerpt?: string;
  tags: readonly string[];
  evidence: TimelineEvidenceReference;
}): ClinicalTimelineEntry {
  return createClinicalTimelineEntry({
    organizationId,
    patientId,
    authorizedProfessionalIds,
    recordedAt: input.occurredAt,
    importance: input.importance ?? 'routine',
    evidenceExcerpt: input.excerpt,
    ...input,
  });
}

export const DEMO_CLINICAL_TIMELINE: readonly ClinicalTimelineEntry[] = [
  entry({
    id: 'timeline-pre-session-jul-29',
    category: 'pre_session',
    occurredAt: '2026-07-29T18:20:00.000Z',
    title: 'Assunto informado antes da sessão',
    summary: 'Texto opcional enviado pela paciente para preparação do atendimento.',
    excerpt: 'Tenho dormido mal e gostaria de conversar sobre a sobrecarga no trabalho.',
    tags: ['pré-sessão', 'trabalho', 'sono'],
    evidence: {
      sourceType: 'pre_session_check_in',
      sourceId: 'demo-pre-session-pac-01',
      sourceVersion: 2,
      sourceField: 'response.topicsToDiscuss',
    },
  }),
  entry({
    id: 'timeline-mood-jul-27',
    category: 'mood',
    importance: 'attention',
    occurredAt: '2026-07-27T22:10:00.000Z',
    title: 'Humor registrado: 2/5',
    summary: 'Emoções selecionadas: ansiedade, cansaço e frustração.',
    excerpt: 'Semana de fechamento de metas no trabalho.',
    tags: ['humor', 'ansiedade', 'trabalho'],
    evidence: {
      sourceType: 'mood_check_in',
      sourceId: 'mood-jul-27',
      sourceField: 'note',
    },
  }),
  entry({
    id: 'timeline-gad7-jul-22',
    category: 'assessment',
    occurredAt: '2026-07-22T19:05:00.000Z',
    title: 'GAD-7 concluído',
    summary: '12 pontos • Gravidade moderada.',
    tags: ['GAD-7', 'ansiedade', 'moderada'],
    evidence: {
      sourceType: 'assessment_response',
      sourceId: 'gad7-response-jul-22',
      sourceVersion: 1,
      sourceField: 'score',
    },
  }),
  entry({
    id: 'timeline-habit-jul-18',
    category: 'habit',
    importance: 'milestone',
    occurredAt: '2026-07-18T11:30:00.000Z',
    title: 'Hábito mantido por cinco dias',
    summary: 'Respiração diafragmática antes do início do expediente.',
    excerpt: '5 de 7 dias concluídos.',
    tags: ['hábito', 'respiração', 'adesão'],
    evidence: {
      sourceType: 'habit_observation',
      sourceId: 'habit-breathing-week-29',
      sourceVersion: 1,
      sourceField: 'status',
    },
  }),
  entry({
    id: 'timeline-task-jul-12',
    category: 'task',
    importance: 'milestone',
    occurredAt: '2026-07-12T20:40:00.000Z',
    title: 'Tarefa terapêutica concluída',
    summary: 'Registro de situações de sobrecarga e pensamentos automáticos.',
    excerpt: 'Foram registrados quatro episódios ligados a cobranças da liderança.',
    tags: ['tarefa', 'concluída', 'liderança'],
    evidence: {
      sourceType: 'care_plan',
      sourceId: 'care-plan-pac-01',
      sourceVersion: 7,
      sourceField: 'tasks.task-rpd-work',
    },
  }),
  entry({
    id: 'timeline-record-jul-08',
    category: 'clinical_record',
    importance: 'milestone',
    occurredAt: '2026-07-08T18:00:00.000Z',
    title: 'Evolução SOAP aprovada — Subjetivo',
    summary: 'Revisão 1 aprovada pela profissional responsável.',
    excerpt: 'Paciente relata dificuldade em estabelecer limites com a gerência no trabalho.',
    tags: ['SOAP', 'subjetivo', 'trabalho', 'limites'],
    evidence: {
      sourceType: 'clinical_record_revision',
      sourceId: 'record-jul-08',
      sourceVersion: 2,
      sourceRevisionId: 'revision-jul-08-1',
      sourceField: 'content.subjective',
      contentHashSha256: '8c71a48e7b554de0f00b0a6a22d7d37efc83ecf26ab8b9ef683fca92b4d8e77a',
    },
  }),
  entry({
    id: 'timeline-appointment-jul-01',
    category: 'appointment',
    occurredAt: '2026-07-01T13:10:00.000Z',
    title: 'Consulta remarcada',
    summary: 'Atendimento transferido de quarta para quinta-feira.',
    tags: ['agenda', 'remarcação'],
    evidence: {
      sourceType: 'appointment_event',
      sourceId: 'appointment-event-jul-01',
      sourceField: 'type',
    },
  }),
  entry({
    id: 'timeline-alert-jun-24',
    category: 'alert',
    importance: 'milestone',
    occurredAt: '2026-06-24T14:45:00.000Z',
    title: 'Alerta revisado pela profissional',
    summary: 'Oscilação de humor revisada; acompanhamento mantido sem ação automática.',
    tags: ['alerta', 'revisado', 'humor'],
    evidence: {
      sourceType: 'care_alert',
      sourceId: 'alert-jun-24',
      sourceField: 'status',
    },
  }),
  entry({
    id: 'timeline-mood-jun-22',
    category: 'mood',
    importance: 'attention',
    occurredAt: '2026-06-22T22:00:00.000Z',
    title: 'Humor registrado: 1/5',
    summary: 'Queda pontual que abriu revisão humana no painel clínico.',
    excerpt: 'Dia especialmente difícil após reunião com a nova liderança.',
    tags: ['humor', 'atenção', 'liderança'],
    evidence: {
      sourceType: 'mood_check_in',
      sourceId: 'mood-jun-22',
      sourceField: 'note',
    },
  }),
  entry({
    id: 'timeline-goal-jun-15',
    category: 'goal',
    occurredAt: '2026-06-15T17:30:00.000Z',
    title: 'Meta terapêutica definida',
    summary: 'Construir limites profissionais sustentáveis e reduzir sobrecarga.',
    excerpt: 'Meta ativa no plano terapêutico.',
    tags: ['meta', 'limites', 'sobrecarga'],
    evidence: {
      sourceType: 'care_plan',
      sourceId: 'care-plan-pac-01',
      sourceVersion: 3,
      sourceField: 'goals.goal-work-boundaries',
    },
  }),
  entry({
    id: 'timeline-record-jun-03',
    category: 'clinical_record',
    importance: 'milestone',
    occurredAt: '2026-06-03T18:00:00.000Z',
    title: 'Evolução SOAP aprovada — Subjetivo',
    summary: 'Primeira evidência verificável encontrada para o tema trabalho.',
    excerpt: 'Paciente relata dificuldades no trabalho desde a mudança de liderança.',
    tags: ['SOAP', 'subjetivo', 'trabalho', 'liderança'],
    evidence: {
      sourceType: 'clinical_record_revision',
      sourceId: 'record-jun-03',
      sourceVersion: 2,
      sourceRevisionId: 'revision-jun-03-1',
      sourceField: 'content.subjective',
      contentHashSha256: '4e57862d886557d1d3ccf9ec142234f530381de29ee39a8f1b66ee613b89d607',
    },
  }),
  entry({
    id: 'timeline-session-may-28',
    category: 'session',
    occurredAt: '2026-05-28T18:50:00.000Z',
    title: 'Sessão concluída',
    summary: 'Atendimento finalizado com revisão humana do registro.',
    tags: ['sessão', 'concluída'],
    evidence: {
      sourceType: 'clinical_session_event',
      sourceId: 'session-event-may-28',
      sourceField: 'type',
    },
  }),
];
