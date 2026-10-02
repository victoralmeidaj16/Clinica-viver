import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IssuedPsychologicalDocument, PsychologicalDocumentInput } from '@thats-life/core';
import type { RequestContext } from '@/server/application/context';

vi.mock('server-only', () => ({}));
const store = vi.hoisted(() => ({ identities: { getPatient: vi.fn(), getProfessional: vi.fn(), getOrganization: vi.fn() }, appointments: { list: vi.fn() } }));
vi.mock('@/server/application/store', () => ({ getApplicationStore: () => store }));
import { createDocumentService } from './documentService';
import { parseDocumentInput } from './documentInput';

const context: RequestContext = { actor: { actorType: 'staff', organizationId: 'org', userId: 'user', membershipId: 'member', membershipStatus: 'active', roles: ['professional'], professionalProfileId: 'psi' }, correlationId: 'test', idempotencyKey: 'emission-test-123456' };
const input: PsychologicalDocumentInput = { kind: 'attendance', location: 'Curitiba/PR', purpose: 'Comprovação de comparecimento', appointmentId: 'appointment' };
const appointment = { id: 'appointment', patientId: 'patient', professionalId: 'psi', status: 'completed', startsAt: '2026-01-02T15:00:00Z', endsAt: '2026-01-02T15:50:00Z' };
const repository = { get: vi.fn(), list: vi.fn(), save: vi.fn() };
const service = createDocumentService(repository);

beforeEach(() => {
  vi.resetAllMocks();
  store.identities.getPatient.mockResolvedValue({ id: 'patient', displayName: 'Pessoa de teste', assignedProfessionalIds: ['psi'] });
  store.identities.getProfessional.mockResolvedValue({ id: 'psi', userId: 'user', status: 'active', displayName: 'Profissional de teste', councilRegistration: '08/12345' });
  store.identities.getOrganization.mockResolvedValue({ displayName: 'Clínica de teste' });
  store.appointments.list.mockResolvedValue([appointment]);
  repository.get.mockResolvedValue(null);
  repository.list.mockResolvedValue([]);
  repository.save.mockImplementation(async (_scope, document: IssuedPsychologicalDocument) => document);
});

describe('documentos psicológicos', () => {
  it('gera horários no fuso da clínica e não inclui campos clínicos injetados', async () => {
    const clean = parseDocumentInput({ ...input, analysis: 'diagnóstico indevido', professionalName: 'Outro autor' });
    const { content } = await service.preview(context, 'patient', clean);
    expect(content.sections[0].text).toContain('12:00 às 12:50');
    expect(JSON.stringify(content)).not.toContain('diagnóstico indevido');
    expect(content.professionalName).toBe('Profissional de teste');
  });

  it.each(['preview', 'options', 'list', 'get'] as const)('nega %s de paciente não atribuído', async (operation) => {
    store.identities.getPatient.mockResolvedValue({ assignedProfessionalIds: ['outro'] });
    const request = operation === 'preview' ? service.preview(context, 'patient', input) : operation === 'get' ? service.get(context, 'patient', 'id') : service[operation](context, 'patient');
    await expect(request).rejects.toMatchObject({ status: 403 });
    expect(repository.get).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('nega emissão por administrador sem perfil profissional e por vínculo inativo', async () => {
    await expect(service.issue({ ...context, actor: { ...context.actor, roles: ['admin'] } }, 'patient', { ...input, reviewed: true })).rejects.toMatchObject({ status: 403 });
    await expect(service.options({ ...context, actor: { ...context.actor, membershipStatus: 'disabled' } }, 'patient')).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    { status: 'scheduled' }, { status: 'cancelled' }, { status: 'no_show' },
    { professionalId: 'outro' }, { patientId: 'outro' }, { endsAt: '2099-01-01T15:50:00Z' },
  ])('exclui atendimento inelegível: %j', async (change) => {
    store.appointments.list.mockResolvedValue([{ ...appointment, ...change }]);
    await expect(service.preview(context, 'patient', input)).rejects.toMatchObject({ status: 422 });
  });

  it('apura acompanhamento somente dentro do período solicitado', async () => {
    store.appointments.list.mockResolvedValue([appointment, { ...appointment, id: 'later', startsAt: '2026-02-02T15:00:00Z' }]);
    const { content } = await service.preview(context, 'patient', { ...input, kind: 'followup', startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(content.appointmentIds).toEqual(['appointment']);
    expect(content.sections[0].text).toContain('1 atendimento(s)');
  });

  it('exige revisão e rejeita prévia desatualizada', async () => {
    await expect(service.issue(context, 'patient', input as unknown as Record<string, unknown>)).rejects.toMatchObject({ code: 'REVIEW_REQUIRED' });
    const draft = await service.preview(context, 'patient', input);
    store.identities.getProfessional.mockResolvedValue({ id: 'psi', userId: 'user', status: 'active', displayName: 'Nome atualizado', councilRegistration: '08/12345' });
    await expect(service.issue(context, 'patient', { ...input, reviewed: true, previewHash: draft.previewHash })).rejects.toMatchObject({ code: 'PREVIEW_CHANGED' });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('preserva o snapshot em repetição e recusa reaproveitar a chave com outro conteúdo', async () => {
    const draft = await service.preview(context, 'patient', input);
    const body = { ...input, reviewed: true, previewHash: draft.previewHash };
    const document = await service.issue(context, 'patient', body);
    repository.get.mockResolvedValue(document);
    const replay = await service.issue(context, 'patient', body);
    expect(replay).toEqual(document);
    expect(repository.save).toHaveBeenCalledTimes(1);
    await expect(service.issue(context, 'patient', { ...body, location: 'Outra cidade' })).rejects.toMatchObject({ status: 409 });
  });

  it('requer todas as seções clínicas do encaminhamento e valida datas reais', () => {
    expect(() => parseDocumentInput({ kind: 'referral', location: 'Curitiba' })).toThrow('destinatário');
    expect(() => parseDocumentInput({ ...input, kind: 'followup', startDate: '2026-02-30', endDate: '2026-03-01' })).toThrow('data válida');
    expect(() => parseDocumentInput({ ...input, purpose: 'CID de teste' })).toThrow('finalidade válida');
  });

  it('monta encaminhamento com seções preenchidas pelo psicólogo', async () => {
    const referral = parseDocumentInput({ kind: 'referral', location: 'Curitiba', recipient: 'Serviço de referência', requester: 'Paciente Exemplo', demand: 'Demanda informada', procedures: 'Entrevistas', analysis: 'Análise do profissional', conclusion: 'Solicito avaliação' });
    const { content } = await service.preview(context, 'patient', referral);
    expect(content.sections).toHaveLength(5);
    expect(content.sections[4].text).toBe('Solicito avaliação');
    expect(content.appointmentIds).toEqual([]);
  });
});
