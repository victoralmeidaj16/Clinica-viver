import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { reconcileSessionReceivables } from '@thats-life/core';
import { fixture, org, seedAppointment, when } from './fixtures';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import type { RowDataPacket } from 'mysql2';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ store: {} as unknown, welcome: vi.fn() }));
vi.mock('@/server/application/store', () => ({ getApplicationStore: () => state.store, persistApplicationState: async () => {} }));
vi.mock('@/server/application/persistence', async (original) => ({
  ...await original<typeof import('@/server/application/persistence')>(), readSnapshot: () => null,
}));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  avisarConfirmacaoPaciente: state.welcome, responderPsicologo: vi.fn(),
  avisarTransbordo: vi.fn(), avisarCoordenacao: vi.fn(),
}));
vi.mock('@/server/application/patientPromotion', () => ({ reconciliarPacientes: vi.fn() }));
vi.mock('@/server/viverMaisGestaoAuth', () => ({ exigirGestao: async () => {}, NaoAutorizadoError: class extends Error {} }));
vi.mock('@/server/application/psychologistInvitation', () => ({ enviarConvitePsicologo: vi.fn() }));

import { MysqlIdentityRepository } from '@/server/persistence/mysql/identityRepository';
import { createPatient, reassignPatient, listPatientDirectory } from '@/server/application/patientDirectory';
import { bookAppointments } from '@/server/scheduling/agendaRepository';
import { registerManualPayment } from '@/server/application/manualPaymentService';
import { reconcileAsaasPayment } from '@/server/payments/paymentLinkRepository';

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede externa proibida nesta auditoria.'); }));
  state.welcome.mockReset().mockResolvedValue({ situacao: 'enviada' });
  f = await fixture();
  state.store = f.store;
});
afterAll(async () => { vi.unstubAllGlobals(); await f?.pool.end(); });

it('5 — recusa aprovação antiga quando o psicólogo já enviou outro pedido', async () => {
  const antigo = { status: 'PENDENTE' as const, solicitadoEm: '2026-10-27T12:00:00Z', servicosPrestados: ['Atendimento Psicológico'] };
  const novo = { ...antigo, solicitadoEm: when, servicosPrestados: ['Orientação Parental'] };
  const id = `cad-${f.pro}`;
  await f.capture.mutate((s) => ({ next: { ...s, cadastrosPsicologos: s.cadastrosPsicologos.map((p) =>
    p.id === id ? { ...p, solicitacaoAlteracaoGestao: novo } : p) }, result: null }));
  const { PATCH } = await import('@/app/api/application/credenciamento-psicologo/[id]/route');
  const response = await PATCH(new Request('http://audit.invalid', { method: 'PATCH',
    body: JSON.stringify({ solicitacaoAlteracaoGestao: { ...antigo, status: 'APROVADO' }, servicosPrestados: antigo.servicosPrestados }) }),
  { params: Promise.resolve({ id }) });
  expect.soft(response.status).toBe(409);
  const saved = (await f.capture.read()).cadastrosPsicologos.find((p) => p.id === id)!;
  expect(saved.solicitacaoAlteracaoGestao).toEqual(novo);
});

it('6 — oito cadastros simultâneos com a mesma chave geram um paciente e uma triagem', async () => {
  const digits = f.pro.replace(/\D/g, '').padEnd(9, '0').slice(0, 9).split('').map(Number);
  for (const length of [9, 10]) {
    const remainder = digits.reduce((sum, digit, index) => sum + digit * (length + 1 - index), 0) % 11;
    digits.push(remainder < 2 ? 0 : 11 - remainder);
  }
  const body = { nome: 'Paciente fictício', whatsapp: '(11) 99999-9999', cpf: digits.join(''),
    email: `${f.pro}@example.invalid`, genero: 'FEMININO',
    servicoKey: 'PSICOTERAPIA', modalidade: 'SOCIAL', turno: 'TARDE', cep: '01310100', logradouro: 'Rua fictícia',
    numeroResidencia: '1', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' };
  const results = await Promise.all(Array.from({ length: 8 }, () => createPatient(f.context, body)));
  const id = results[0].id;
  expect(new Set(results.map((p) => p.id)).size).toBe(1);
  const [rows] = await f.pool.query<RowDataPacket[]>('SELECT id FROM clinica_pacientes WHERE ref_core = ?', [id]);
  expect(rows).toHaveLength(1);
  expect((await f.capture.read()).triagensPacientes.filter((l) => l.pacienteRef === id)).toHaveLength(1);
  expect(state.welcome).toHaveBeenCalledOnce();
});

it('11 — encaminhamento atualiza as duas capacidades sem mover o agendamento', async () => {
  const id = await seedAppointment(f);
  await f.capture.mutate((s) => ({ next: { ...s, triagensPacientes: [...s.triagensPacientes, {
    id: `lead-${f.patient.id}`, protocolo: 'VM-FICTICIO', nomePaciente: 'Paciente fictício', telefone: '',
    convenioSelecionado: 'Nenhum', origem: 'manual', turno: 'TARDE', status: 'CONTATO_CONFIRMADO',
    pacienteRef: f.patient.id, psicologoAlocadoId: `cad-${f.pro}`, confirmadoEm: when, criadoEm: when,
  }] }, result: null }));
  await reassignPatient({ ...f.context, actor: { ...f.context.actor, roles: ['admin'] } }, {
    id: f.patient.id, professionalId: f.other, motivo: 'Encaminhamento fictício',
  });
  expect((await f.identities.getPatient(org, f.patient.id))?.primaryProfessionalId).toBe(f.other);
  const roster = (await f.capture.read()).cadastrosPsicologos;
  expect(roster.find((p) => p.profissionalRef === f.pro)?.pacientesAtivosCount).toBe(0);
  expect(roster.find((p) => p.profissionalRef === f.other)?.pacientesAtivosCount).toBe(1);
  expect((await f.appointments.getById(org, id))?.professionalId).toBe(f.pro);
  const directory = await listPatientDirectory({ ...f.context, actor: { ...f.context.actor, professionalProfileId: f.other } });
  expect(directory.find((p) => p.id === f.patient.id)?.nextAppointmentAt).toBeUndefined();
});

it('16 — duas conexões disputam o mesmo horário e apenas uma consegue reservar', async () => {
  await f.pool.execute(`INSERT INTO clinica_disponibilidades
    (id, instituicao_id, profissional_id, dia_semana, hora_inicio, hora_fim, duracao_min, modalidade)
    VALUES (?, ?, ?, 2, '09:00:00', '12:00:00', 60, 'presencial')`,
  [rowId('disp', f.pro), instituicaoId(), rowId('profissional', f.pro)]);
  const input = { patientRef: f.patient.id, patientRowId: rowId('paciente', f.patient.id), nome: 'Paciente fictício',
    organizationId: org, professionalId: f.pro, professionalRowId: rowId('profissional', f.pro),
    professionalName: 'Profissional fictício', sessionAmountCents: 10000 };
  const results = await Promise.all([1, 2].map(() => bookAppointments(input,
    ['2026-09-15T12:00:00.000Z'], new Date('2026-09-14T10:00:00Z'))));
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.filter((r) => !r.ok)).toHaveLength(1);
  expect(await f.appointments.list({ organizationId: org, professionalId: f.pro })).toHaveLength(1);
});

it('26 — pagamento manual e webhook concorrentes não duplicam o recebimento', async () => {
  const paymentId = `pay-${f.charge.id}`;
  await f.financial.saveCharge({ ...f.charge, providerReference: paymentId });
  const results = await Promise.allSettled([
    registerManualPayment({ ...f.context, actor: { ...f.context.actor, roles: ['admin'] } }, f.charge.id,
      { amountCents: 10000, expectedOutstandingCents: 10000, receivedAt: '2026-01-02', method: 'pix' }),
    reconcileAsaasPayment({ eventId: `evt-${paymentId}`, eventType: 'PAYMENT_RECEIVED', paymentId,
      amountCents: 10000, receivedAt: when, billingType: 'PIX' }),
  ]);
  expect(results[0]).toMatchObject({ status: 'rejected', reason: { status: 409 } });
  expect(results[1]).toEqual({ status: 'fulfilled', value: 'processed' });
  const ledger = await f.financial.getLedger({ organizationId: org, patientIds: [f.patient.id] });
  expect(ledger.payments).toHaveLength(1);
  expect(reconcileSessionReceivables(ledger)[0]).toMatchObject({ paidAmountCents: 10000, outstandingAmountCents: 0 });
});

it('23 — aceite do provedor seguido de falha na gravação não dispara reenvio após reinício', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: 'audit-message' } })));
  vi.stubGlobal('fetch', fetchMock);
  const execute = f.pool.execute.bind(f.pool);
  const injection = vi.spyOn(f.pool, 'execute').mockImplementation((...args: Parameters<typeof execute>) => {
    if (String(args[0]).includes('SET estado = ?, provedor_ref = ?')) {
      return Promise.reject(new Error('Falha simulada após aceite do provedor.'));
    }
    return execute(...args);
  });
  const input = { scope: 'audit', key: f.context.idempotencyKey!, number: '5511999999999', text: 'Mensagem fictícia',
    config: { url: 'https://provider.invalid', apiKey: 'audit-key', instancia: 'audit' } };
  await expect((await import('@/server/communication/whatsappDelivery')).deliverWhatsApp(input)).rejects.toThrow('Falha simulada');
  injection.mockRestore();
  vi.resetModules();
  const result = await (await import('@/server/communication/whatsappDelivery')).deliverWhatsApp(input);
  expect(result.state).toBe('sending');
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith('https://provider.invalid/message/sendText/audit', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ number: input.number, text: input.text }),
  }));
});

it.each([false, true])('25 — reentrega após reinício não confirma outro paciente (falha posterior: %s)', async (falharEnvio) => {
  const cadId = `cad-${f.pro}`;
  const phone = `55119${f.pro.replace(/\D/g, '').padEnd(8, '0').slice(-8)}`;
  await f.capture.mutate((s) => ({ next: { ...s,
    cadastrosPsicologos: s.cadastrosPsicologos.map((p) => p.id === cadId
      ? { ...p, status: 'APROVADO' as const, whatsapp: phone } : p),
    triagensPacientes: [...s.triagensPacientes, ...[1, 2].map((n) => ({
      id: `reply-${n}-${f.pro}`, protocolo: `VM-FICTICIO-${n}`, nomePaciente: 'Paciente fictício', telefone: '',
      convenioSelecionado: 'Nenhum', origem: 'manual', turno: 'TARDE', status: 'AGUARDANDO_CONTATO' as const,
      psicologoAlocadoId: cadId, criadoEm: when, alocadoEm: `2026-10-28T${n === 1 ? '10' : '11'}:00:00Z`,
    }))],
  }, result: null }));
  vi.stubEnv('EVOLUTION_WEBHOOK_TOKEN', 'audit-token');
  const request = () => new Request('http://audit.invalid', { method: 'POST', headers: { 'x-evolution-token': 'audit-token' },
    body: JSON.stringify({ event: 'messages.upsert', data: { key: { id: `msg-${f.pro}`, remoteJid: `${phone}@s.whatsapp.net` },
      message: { conversation: 'CONFIRMAR' } } }) });
  const first = await import('@/app/api/clinica/whatsapp/webhook/route');
  if (falharEnvio) {
    state.welcome.mockRejectedValueOnce(new Error('Falha simulada após confirmar contato.'));
    expect((await first.POST(request())).status).toBe(500);
  } else {
    const statuses = await Promise.all(Array.from({ length: 4 }, async () => (await first.POST(request())).status));
    expect(statuses).toEqual([200, 200, 200, 200]);
  }
  const confirmed = async () => (await f.capture.read()).triagensPacientes
    .filter((l) => l.psicologoAlocadoId === cadId && l.status === 'CONTATO_CONFIRMADO');
  expect(await confirmed()).toHaveLength(1);
  vi.resetModules();
  const restarted = await import('@/app/api/clinica/whatsapp/webhook/route');
  expect((await restarted.POST(request())).status).toBe(200);
  const statuses = await Promise.all(Array.from({ length: 4 }, async () => (await restarted.POST(request())).status));
  expect(statuses).toEqual([200, 200, 200, 200]);
  expect(await confirmed()).toHaveLength(1);
  expect(state.welcome).toHaveBeenCalledOnce();
});

it('28 — estorno integral de uma sessão individual aparece no financeiro', async () => {
  const paymentId = `pay-${f.charge.id}`;
  await f.financial.saveCharge({ ...f.charge, providerReference: paymentId });
  await reconcileAsaasPayment({ eventId: `received-${paymentId}`, eventType: 'PAYMENT_RECEIVED', paymentId,
    amountCents: 10000, receivedAt: when, billingType: 'PIX' });
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'audit-token');
  const { POST } = await import('@/app/api/financeiro/asaas/webhook/route');
  const response = await POST(new Request('http://audit.invalid', { method: 'POST', headers: { 'asaas-access-token': 'audit-token' },
    body: JSON.stringify({ id: `refund-${paymentId}`, event: 'PAYMENT_REFUNDED', payment: {
      id: paymentId, externalReference: 'VM-ficticio', refunds: [{ status: 'DONE', value: 100 }],
    } }) }));
  expect(response.status).toBe(200);
  const ledger = await f.financial.getLedger({ organizationId: org, patientIds: [f.patient.id] });
  expect(ledger.refunds).toHaveLength(1);
  expect(reconcileSessionReceivables(ledger)[0]).toMatchObject({ refundedAmountCents: 10000, reconciliationStatus: 'refunded' });
});

const countRows = async (table: string) => {
  const [rows] = await f.pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${table}`);
  return Number(rows[0].total);
};

it('6b — falha ao salvar o contato desfaz o paciente e a triagem e não envia WhatsApp', async () => {
  const digits = f.pro.replace(/\D/g, '').padEnd(9, '0').slice(0, 9).split('').map(Number);
  for (const length of [9, 10]) {
    const remainder = digits.reduce((sum, digit, index) => sum + digit * (length + 1 - index), 0) % 11;
    digits.push(remainder < 2 ? 0 : 11 - remainder);
  }
  const body = { nome: 'Paciente fictício', whatsapp: '(11) 99999-9999', cpf: digits.join(''),
    email: `${f.pro}@example.invalid`, genero: 'FEMININO', servicoKey: 'PSICOTERAPIA', modalidade: 'SOCIAL',
    turno: 'TARDE', cep: '01310100', logradouro: 'Rua fictícia', numeroResidencia: '1', bairro: 'Centro',
    cidade: 'São Paulo', uf: 'SP' };
  const pacientes = await countRows('clinica_pacientes');
  const triagens = (await f.capture.read()).triagensPacientes.length;
  vi.spyOn(MysqlIdentityRepository.prototype, 'savePatientContact').mockRejectedValue(new Error('contato indisponível'));
  await expect(createPatient({ ...f.context, idempotencyKey: `falha-${f.pro}` }, body)).rejects.toThrow('contato indisponível');
  expect(await countRows('clinica_pacientes')).toBe(pacientes);
  expect((await f.capture.read()).triagensPacientes).toHaveLength(triagens);
  expect(state.welcome).not.toHaveBeenCalled();
});

it('9 — encaminhamento repetido não conta o paciente de novo nem duplica a transferência', async () => {
  await f.capture.mutate((s) => ({ next: { ...s, triagensPacientes: [...s.triagensPacientes, {
    id: `lead-${f.patient.id}`, protocolo: 'VM-FICTICIO', nomePaciente: 'Paciente fictício', telefone: '',
    convenioSelecionado: 'Nenhum', origem: 'manual', turno: 'TARDE', status: 'CONTATO_CONFIRMADO',
    pacienteRef: f.patient.id, psicologoAlocadoId: `cad-${f.pro}`, confirmadoEm: when, criadoEm: when,
  }] }, result: null }));
  const admin = { ...f.context, actor: { ...f.context.actor, roles: ['admin' as const] } };
  const body = { id: f.patient.id, professionalId: f.other, motivo: 'Encaminhamento fictício' };
  await Promise.all([reassignPatient(admin, body), reassignPatient(admin, body)]);
  await reassignPatient(admin, body);
  const roster = (await f.capture.read()).cadastrosPsicologos;
  expect(roster.find((p) => p.profissionalRef === f.pro)?.pacientesAtivosCount).toBe(0);
  expect(roster.find((p) => p.profissionalRef === f.other)?.pacientesAtivosCount).toBe(1);
  const [links] = await f.pool.query<RowDataPacket[]>(
    'SELECT profissional_id FROM clinica_pacientes_profissionais WHERE paciente_id = ?', [rowId('paciente', f.patient.id)]);
  expect(links).toHaveLength(1);
  expect((await f.identities.getPatient(org, f.patient.id))?.primaryProfessionalId).toBe(f.other);
});

it('10 — destino inativo recusa o encaminhamento e preserva o responsável anterior', async () => {
  const destino = (await f.identities.getProfessional(org, f.other))!;
  await f.identities.saveProfessional({ ...destino, status: 'inactive' });
  const admin = { ...f.context, actor: { ...f.context.actor, roles: ['admin' as const] } };
  await expect(reassignPatient(admin, { id: f.patient.id, professionalId: f.other, motivo: 'Fictício' }))
    .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect((await f.identities.getPatient(org, f.patient.id))?.primaryProfessionalId).toBe(f.pro);
  const [links] = await f.pool.query<RowDataPacket[]>(
    'SELECT profissional_id FROM clinica_pacientes_profissionais WHERE paciente_id = ?', [rowId('paciente', f.patient.id)]);
  expect(links.map((l) => l.profissional_id)).not.toContain(rowId('profissional', f.other));
});
