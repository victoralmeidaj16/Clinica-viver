import 'server-only';
import { createHash } from 'node:crypto';
import {
  buildPsychologicalDocument, documentDate,
  type PsychologicalDocumentInput, type IssuedPsychologicalDocument,
} from '@thats-life/core';
import type { RequestContext } from '@/server/application/context';
import { ApplicationError } from '@/server/application/http';
import { getApplicationStore } from '@/server/application/store';
import { MysqlDocumentRepository, type DocumentRepository } from './documentRepository';
import { parseDocumentInput } from './documentInput';
import { isDocumentDemo } from './demoMode';
import { DemoDocumentRepository } from './demoDocumentRepository';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createDocumentService(repository: DocumentRepository = isDocumentDemo() ? new DemoDocumentRepository() : new MysqlDocumentRepository()) {
  async function access(context: RequestContext, patientId: string) {
    const actor = context.actor;
    if (actor.membershipStatus !== 'active' || !actor.roles.includes('professional') || !actor.professionalProfileId) {
      throw new ApplicationError('FORBIDDEN', 'Somente psicólogos podem acessar documentos de pacientes.', 403);
    }
    const store = getApplicationStore();
    const patient = await store.identities.getPatient(actor.organizationId, patientId);
    if (!patient || !patient.assignedProfessionalIds.includes(actor.professionalProfileId)) {
      throw new ApplicationError('FORBIDDEN', 'Paciente indisponível para este profissional.', 403);
    }
    const professional = await store.identities.getProfessional(actor.organizationId, actor.professionalProfileId);
    if (!professional || professional.status !== 'active' || professional.userId !== actor.userId) {
      throw new ApplicationError('FORBIDDEN', 'Cadastro profissional ativo não encontrado.', 403);
    }
    return { store, patient, professional, scope: { organizationId: actor.organizationId, patientId, professionalId: professional.id } };
  }

  async function options(context: RequestContext, patientId: string) {
    const { store, patient, professional, scope } = await access(context, patientId);
    const appointments = await store.appointments.list({ ...scope, statuses: ['completed'] });
    return {
      patientName: patient.displayName, professionalName: professional.displayName, crp: professional.councilRegistration,
      appointments: appointments.filter((a) => a.status === 'completed' && a.professionalId === professional.id && a.patientId === patientId && new Date(a.endsAt).getTime() <= Date.now())
        .map(({ id, startsAt, endsAt }) => ({ id, startsAt, endsAt })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    };
  }

  async function preview(context: RequestContext, patientId: string, input: PsychologicalDocumentInput) {
    const { store, patient, professional, scope } = await access(context, patientId);
    if (!professional.councilRegistration.trim()) throw new ApplicationError('INVALID_STATE', 'Complete o CRP no cadastro profissional antes de emitir.', 422);
    const organization = await store.identities.getOrganization(scope.organizationId);
    if (!organization) throw new ApplicationError('INVALID_STATE', 'Clínica não encontrada.', 422);
    const today = documentDate(new Date().toISOString());
    if (input.kind === 'followup' && input.endDate! > today) throw new ApplicationError('INVALID_INPUT', 'O período não pode incluir datas futuras.', 400);
    const appointments = input.kind === 'referral' ? [] : (await options(context, patientId)).appointments.filter((a) =>
      input.kind === 'attendance' ? a.id === input.appointmentId : documentDate(a.startsAt) >= input.startDate! && documentDate(a.startsAt) <= input.endDate!);
    if (input.kind !== 'referral' && !appointments.length) throw new ApplicationError('INVALID_STATE', 'Nenhum atendimento concluído foi encontrado para esta seleção.', 422);
    const content = buildPsychologicalDocument(input, {
      patientName: patient.displayName, professionalName: professional.displayName,
      crp: professional.councilRegistration, organizationName: organization.displayName,
      date: today, location: input.location,
    }, appointments);
    if (isDocumentDemo()) content.demo = true;
    return { content, previewHash: hash(content) };
  }

  async function issue(context: RequestContext, patientId: string, body: Record<string, unknown>) {
    const { scope } = await access(context, patientId);
    if (!context.idempotencyKey || !/^[a-zA-Z0-9-]{16,128}$/.test(context.idempotencyKey)) throw new ApplicationError('INVALID_INPUT', 'Chave de emissão inválida.', 400);
    if (body.reviewed !== true) throw new ApplicationError('REVIEW_REQUIRED', 'Revise e confirme o conteúdo antes de emitir.', 400);
    const input = parseDocumentInput(body);
    const requestHash = hash(input);
    const id = hash([scope, context.actor.userId, context.idempotencyKey]);
    const existing = await repository.get(scope, id);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ApplicationError('CONFLICT', 'Esta chave já foi usada para outro conteúdo.', 409);
      return existing;
    }
    const draft = await preview(context, patientId, input);
    if (body.previewHash !== draft.previewHash) throw new ApplicationError('PREVIEW_CHANGED', 'Os dados mudaram. Atualize a prévia e revise novamente.', 409);
    const document: IssuedPsychologicalDocument = {
      id, ...scope, issuedBy: context.actor.userId, issuedAt: new Date().toISOString(), requestHash, content: draft.content,
    };
    const saved = await repository.save(scope, document);
    if (saved.requestHash !== requestHash) throw new ApplicationError('CONFLICT', 'Esta chave já foi usada para outro conteúdo.', 409);
    return saved;
  }

  async function list(context: RequestContext, patientId: string) {
    const { scope } = await access(context, patientId);
    return (await repository.list(scope)).map(({ id, issuedAt, content }) => ({ id, issuedAt, kind: content.kind }));
  }

  async function get(context: RequestContext, patientId: string, id: string) {
    const { scope } = await access(context, patientId);
    const document = await repository.get(scope, id);
    if (!document) throw new ApplicationError('NOT_FOUND', 'Documento não encontrado.', 404);
    return document;
  }

  return { options, preview, issue, list, get };
}

export const documentService = createDocumentService();
