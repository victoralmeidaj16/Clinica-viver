import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/server/http/publicRequest', () => ({
  rateLimited: vi.fn(() => false),
  validCpf: vi.fn((cpf: string) => cpf.replace(/\D/g, '').length === 11),
}));

vi.mock('@/server/scheduling/agendaRepository', () => ({
  identifyPatient: vi.fn(async (token: string, cpf: string) => {
    if (token === 'a'.repeat(32) && cpf === '12345678901') {
      return {
        patientRef: 'patient-1',
        patientRowId: '1',
        nome: 'Paciente Teste',
        organizationId: 'org-1',
        professionalId: 'prof-1',
        professionalRowId: '1',
        professionalName: 'Psicólogo Teste',
        sessionAmountCents: 15000,
      };
    }
    return null;
  }),
  rescheduleAppointmentPublic: vi.fn(async (_paciente, appointmentId: string, novoInicio: string) => {
    if (appointmentId === 'apt-expirado') {
      return { ok: false, motivo: 'PRAZO_EXPIRADO' as const };
    }
    if (appointmentId === 'apt-conflito') {
      return { ok: false, motivo: 'INDISPONIVEL' as const };
    }
    return {
      ok: true as const,
      agendamentoId: appointmentId,
      inicio: novoInicio,
      fim: new Date(new Date(novoInicio).getTime() + 50 * 60_000).toISOString(),
      modalidade: 'online',
      linkPagamento: '/pagar/sessao/tokenteste',
    };
  }),
}));

describe('POST /api/agenda/reagendar', () => {
  it('rejeita token inválido', async () => {
    const req = new Request('http://localhost/api/agenda/reagendar', {
      method: 'POST',
      body: JSON.stringify({ token: 'invalido', cpf: '12345678901', appointmentId: '1', inicio: '2026-10-10T10:00:00Z' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('rejeita CPF inválido', async () => {
    const req = new Request('http://localhost/api/agenda/reagendar', {
      method: 'POST',
      body: JSON.stringify({ token: 'a'.repeat(32), cpf: '123', appointmentId: '1', inicio: '2026-10-10T10:00:00Z' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejeita quando falta appointmentId', async () => {
    const req = new Request('http://localhost/api/agenda/reagendar', {
      method: 'POST',
      body: JSON.stringify({ token: 'a'.repeat(32), cpf: '12345678901', inicio: '2026-10-10T10:00:00Z' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Identificador do agendamento');
  });

  it('bloqueia quando prazo for menor que 2 horas (PRAZO_EXPIRADO)', async () => {
    const req = new Request('http://localhost/api/agenda/reagendar', {
      method: 'POST',
      body: JSON.stringify({ token: 'a'.repeat(32), cpf: '12345678901', appointmentId: 'apt-expirado', inicio: '2026-10-10T10:00:00Z' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('antecedência mínima de 2 horas');
  });

  it('retorna 409 quando o novo horário for conflitante', async () => {
    const req = new Request('http://localhost/api/agenda/reagendar', {
      method: 'POST',
      body: JSON.stringify({ token: 'a'.repeat(32), cpf: '12345678901', appointmentId: 'apt-conflito', inicio: '2026-10-10T10:00:00Z' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('reagenda com sucesso quando dados e regras forem atendidos', async () => {
    const req = new Request('http://localhost/api/agenda/reagendar', {
      method: 'POST',
      body: JSON.stringify({ token: 'a'.repeat(32), cpf: '12345678901', appointmentId: 'apt-valido', inicio: '2026-10-10T14:00:00.000Z' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mensagem).toBe('Sessão reagendada com sucesso!');
    expect(data.inicio).toBe('2026-10-10T14:00:00.000Z');
    expect(data.linkPagamento).toBe('/pagar/sessao/tokenteste');
  });
});
