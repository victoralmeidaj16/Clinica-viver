import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import type { OrganizationRole } from '@thats-life/core';
import { fixture, org, when } from './fixtures';
import { rowId } from '@/server/persistence/mysql/mappers';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ store: {} as unknown, jar: new Map<string, string>() }));
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
  set: (name: string, value: string) => { if (value) state.jar.set(name, value); else state.jar.delete(name); },
}) }));
vi.mock('@/server/application/store', () => ({ getApplicationStore: () => state.store, persistApplicationState: async () => {} }));
vi.mock('@/server/application/persistence', async (original) => ({
  ...await original<typeof import('@/server/application/persistence')>(), readSnapshot: () => null,
}));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  enviarTexto: vi.fn().mockResolvedValue({ situacao: 'enviada' }), avisarConfirmacaoPaciente: vi.fn(),
  responderPsicologo: vi.fn(), avisarTransbordo: vi.fn(), avisarCoordenacao: vi.fn(), avisarAlocacao: vi.fn(),
}));

import { SESSION_COOKIE, startSession } from '@/server/auth';
import { createPsychologistPasswordReset } from '@/server/application/passwordReset';

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede externa proibida nesta auditoria.'); }));
  state.jar.clear();
  f = await fixture();
  state.store = f.store;
});
afterAll(async () => { vi.unstubAllGlobals(); await f?.pool.end(); });

async function conta(userId: string, roles: OrganizationRole[], professionalProfileId?: string) {
  await f.identities.saveUser({ id: userId, displayName: 'Usuário fictício', status: 'active',
    normalizedEmail: `${userId}@example.invalid`, createdAt: when, updatedAt: when });
  const membership = { id: `member-${userId}`, organizationId: org, userId, roles, status: 'active' as const,
    professionalProfileId, createdAt: when, updatedAt: when };
  await f.identities.saveMembership(membership);
  return membership;
}

async function entrar(userId: string, role: 'admin' | 'psicologo') {
  await startSession({ userId, organizationId: org, role });
  return state.jar.get(SESSION_COOKIE)!;
}

function chamar(cookie: string | undefined, url: string, init: RequestInit = {}) {
  if (cookie) state.jar.set(SESSION_COOKIE, cookie); else state.jar.delete(SESSION_COOKIE);
  return new Request(`http://audit.invalid${url}`, { ...init, headers: {
    'content-type': 'application/json', 'idempotency-key': `audit-${randomUUID()}`, ...init.headers } });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

it('2 — psicólogo não acessa paciente de outro profissional por chamada direta à API', async () => {
  await conta(`user-${f.pro}`, ['professional'], f.pro);
  await conta(`user-${f.other}`, ['professional'], f.other);
  const dono = await entrar(`user-${f.pro}`, 'psicologo');
  const intruso = await entrar(`user-${f.other}`, 'psicologo');
  const paciente = await import('@/app/api/application/patients/[id]/route');
  const documentos = await import('@/app/api/application/patients/[id]/documents/route');
  const timeline = await import('@/app/api/application/timeline/route');
  const diretorio = await import('@/app/api/application/patients/route');
  const agendamentos = await import('@/app/api/application/appointments/route');

  // Controle: o responsável abre o próprio paciente.
  expect((await paciente.GET(chamar(dono, `/x/${f.patient.id}`), params(f.patient.id))).status).toBe(200);

  const negadas = [
    await paciente.GET(chamar(intruso, `/x/${f.patient.id}`), params(f.patient.id)),
    await paciente.PATCH(chamar(intruso, `/x/${f.patient.id}`, { method: 'PATCH',
      body: JSON.stringify({ expectedUpdatedAt: null, expectedCpf: '' }) }), params(f.patient.id)),
    await documentos.GET(chamar(intruso, `/x/${f.patient.id}/documents`), params(f.patient.id)),
    await timeline.GET(chamar(intruso, `/api/application/timeline?patientId=${encodeURIComponent(f.patient.id)}`)),
  ];
  expect(negadas.map((r) => r.status).every((s) => s === 403 || s === 404)).toBe(true);
  for (const resposta of negadas) expect(JSON.stringify(await resposta.json())).not.toContain('Paciente fictício');

  const appointmentId = `appointment-${randomUUID()}`;
  const marcacao = await agendamentos.POST(chamar(intruso, '/api/application/appointments', { method: 'POST',
    body: JSON.stringify({ id: appointmentId, patientId: f.patient.id, professionalId: f.other,
      startsAt: '2030-06-01T12:00:00.000Z', endsAt: '2030-06-01T12:50:00.000Z', serviceKey: 'PSICOTERAPIA' }) }));
  expect(marcacao.status).toBeGreaterThanOrEqual(400);
  const [criados] = await f.pool.query<RowDataPacket[]>('SELECT id FROM clinica_agendamentos WHERE id = ?',
    [rowId('agendamento', appointmentId)]);
  expect(criados).toHaveLength(0);

  const lista = await (await diretorio.GET(chamar(intruso, '/api/application/patients'))).json();
  expect(JSON.stringify(lista)).not.toContain(f.patient.id);
});

it('11 — o cookie emitido antes da redefinição de senha deixa de valer', async () => {
  const userId = `user-${f.pro}`;
  await conta(userId, ['professional'], f.pro);
  await f.pool.execute("UPDATE clinica_usuarios SET senha_hash = 'x', senha_definida_em = '2026-01-01 00:00:00' WHERE ref_core = ?", [userId]);
  const antigo = await entrar(userId, 'psicologo');
  const me = await import('@/app/api/auth/me/route');
  expect((await (chamar(antigo, '/api/auth/me'), me.GET())).status).toBe(200);

  await new Promise((resolve) => setTimeout(resolve, 5));
  const { token } = await createPsychologistPasswordReset(`${userId}@example.invalid`);
  const { POST } = await import('@/app/api/auth/redefinir-senha/route');
  const redefinicao = await POST(chamar(undefined, '/api/auth/redefinir-senha', { method: 'POST',
    body: JSON.stringify({ token, password: 'SenhaFicticia123' }) }));
  expect(redefinicao.status).toBe(200);
  const novo = state.jar.get(SESSION_COOKIE)!;
  expect(novo).not.toBe(antigo);

  expect((await (chamar(antigo, '/api/auth/me'), me.GET())).status).toBe(401);
  const paciente = await import('@/app/api/application/patients/[id]/route');
  expect((await paciente.GET(chamar(antigo, `/x/${f.patient.id}`), params(f.patient.id))).status).toBe(401);
  expect((await (chamar(novo, '/api/auth/me'), me.GET())).status).toBe(200);
});

it.each([
  ['vínculo desativado', { status: 'disabled' as const }],
  ['papel de gestão removido', { roles: ['professional' as const] }],
])('12 — administrador com %s perde a gestão mesmo com cookie válido', async (_caso, revogacao) => {
  const userId = `admin-${randomUUID()}`;
  const membership = await conta(userId, ['admin']);
  const cookie = await entrar(userId, 'admin');
  const gestao = await import('@/app/api/application/gestao/pacientes/route');
  const triagem = await import('@/app/api/application/triagem/route');
  expect((await (chamar(cookie, '/api/application/triagem'), triagem.GET())).status).toBe(200);

  await f.identities.saveMembership({ ...membership, ...revogacao, updatedAt: new Date().toISOString() });
  const respostas = [
    await (chamar(cookie, '/api/application/gestao/pacientes'), gestao.GET()),
    await (chamar(cookie, '/api/application/triagem'), triagem.GET()),
  ];
  expect(respostas.map((r) => r.status).every((s) => s === 401 || s === 403)).toBe(true);
});
