import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TriagemPacienteRecord } from './persistence';
vi.mock('server-only', () => ({}));
const enviar = vi.hoisted(() => vi.fn());
vi.mock('./viverMaisWhatsApp', () => ({ avisarRecebimentoPaciente: enviar }));
import { receberTriagemWhatsApp, verificarWhatsApp } from './triagemWhatsApp';
const lead = (id: string) => ({ id, telefone: '48999991234' }) as TriagemPacienteRecord;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('EVOLUTION_API_URL', 'https://evolution.example');
  vi.stubEnv('EVOLUTION_API_KEY', 'test');
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'instance');
  vi.stubEnv('WHATSAPP_ALLOW_ALL_RECIPIENTS', 'true');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it.each([true, false])('interpreta a existência %s sem enviar mensagem', async (exists) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ number: '5548999991234', exists }] });
  vi.stubGlobal('fetch', fetchMock);
  expect(await verificarWhatsApp('+55 (48) 99999-1234')).toBe(exists ? 'existe' : 'inexistente');
  expect(fetchMock.mock.calls[0][0]).toContain('/chat/whatsappNumbers/');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ numbers: ['5548999991234'] });
  expect(enviar).not.toHaveBeenCalled();
});
it.each([
  { ok: false },
  { ok: true, json: async () => ({ message: 'offline' }) },
  { ok: true, json: async () => [{ number: '5511999999999', exists: false }] },
])('não confunde resposta inconclusiva com número inexistente', async (response) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  expect(await verificarWhatsApp('48999991234')).toBe('indisponivel');
});
it('trata falha de rede e respeita a allowlist antes da consulta', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('timeout'));
  vi.stubGlobal('fetch', fetchMock);
  expect(await verificarWhatsApp('48999991234')).toBe('indisponivel');
  vi.stubEnv('WHATSAPP_ALLOW_ALL_RECIPIENTS', 'false');
  vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
  expect(await verificarWhatsApp('48999991234')).toBe('indisponivel');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('compartilha tentativa concorrente e não repete mensagem enviada', async () => {
  enviar.mockResolvedValue({ situacao: 'enviada' });
  const paciente = lead('concorrente');
  await Promise.all([receberTriagemWhatsApp(paciente), receberTriagemWhatsApp(paciente, true)]);
  await receberTriagemWhatsApp(paciente, true);
  expect(enviar).toHaveBeenCalledTimes(1);
});
it('repete apenas recusa explícita, depois de um minuto, sem repetir após sucesso', async () => {
  vi.useFakeTimers();
  enviar.mockResolvedValueOnce({ situacao: 'falha', reenvioSeguro: true }).mockResolvedValue({ situacao: 'enviada' });
  const paciente = lead('recusa');
  await receberTriagemWhatsApp(paciente);
  await receberTriagemWhatsApp(paciente, true);
  expect(enviar).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(60_001);
  await receberTriagemWhatsApp(paciente, true);
  await receberTriagemWhatsApp(paciente, true);
  expect(enviar).toHaveBeenCalledTimes(2);
});
it('não reenvia após resultado incerto ou quando não há histórico no processo', async () => {
  vi.useFakeTimers();
  enviar.mockRejectedValue(new Error('timeout'));
  const paciente = lead('incerto');
  await receberTriagemWhatsApp(paciente);
  vi.advanceTimersByTime(60_001);
  await receberTriagemWhatsApp(paciente, true);
  expect(await receberTriagemWhatsApp(lead('sem-historico'), true)).toBeNull();
  expect(enviar).toHaveBeenCalledTimes(1);
});
