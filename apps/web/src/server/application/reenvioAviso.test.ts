import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  envio: null as unknown,
  marcou: true,
  enviar: vi.fn(),
  desmarcar: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/communication/avisosEnviosRepository', () => ({
  SITUACOES_NAO_ENTREGUES: ['falha', 'bloqueada_allowlist', 'provedor_desconfigurado', 'destinatario_invalido'],
  obterEnvioParaReenvio: vi.fn(async () => state.envio),
  marcarEnvioReenviado: vi.fn(async () => state.marcou),
  desmarcarEnvioReenviado: state.desmarcar,
}));
vi.mock('./viverMaisWhatsApp', () => ({ enviarTexto: state.enviar }));

import { reenviarAviso } from './reenvioAviso';

const autor = { usuarioRef: 'gestao-1', nome: 'Gestão fictícia' };

function envio(registro: Record<string, unknown>, conteudo: unknown = { destino: '5500000000000', texto: 'Texto fictício' }) {
  return {
    registro: { id: 'e1', finalidade: 'agenda_confirmacao_paciente', canal: 'whatsapp', situacao: 'falha',
      reenvioSeguro: true, referencia: 'agendamento:a1', ...registro },
    conteudo,
  };
}

describe('reenviarAviso', () => {
  beforeEach(() => {
    state.marcou = true;
    state.enviar.mockReset().mockResolvedValue({ situacao: 'enviada' });
    state.desmarcar.mockReset();
  });

  it('reenvia o mesmo texto com chave própria e autor, sem refazer a operação de origem', async () => {
    state.envio = envio({});
    await expect(reenviarAviso('e1', autor)).resolves.toEqual({ situacao: 'enviada' });
    expect(state.enviar).toHaveBeenCalledWith('5500000000000', 'Texto fictício', 'agenda_confirmacao_paciente',
      'reenvio:e1', false, { referencia: 'agendamento:a1', reenvio: { de: 'e1', autor } });
  });

  it('exige confirmação quando o provedor não confirmou nem recusou', async () => {
    state.envio = envio({ reenvioSeguro: false });
    await expect(reenviarAviso('e1', autor)).rejects.toMatchObject({ code: 'RESULTADO_INCERTO' });
    expect(state.enviar).not.toHaveBeenCalled();
    await expect(reenviarAviso('e1', autor, { confirmarResultadoIncerto: true })).resolves.toMatchObject({ situacao: 'enviada' });
  });

  it('recusa aviso já entregue, já reenviado ou sem texto guardado', async () => {
    state.envio = envio({ situacao: 'enviada' });
    await expect(reenviarAviso('e1', autor)).rejects.toMatchObject({ status: 409 });
    state.envio = envio({ reenviadoEm: '2026-11-24T10:00:00.000Z' });
    await expect(reenviarAviso('e1', autor)).rejects.toMatchObject({ status: 409 });
    state.envio = envio({}, null);
    await expect(reenviarAviso('e1', autor)).rejects.toMatchObject({ status: 400 });
    expect(state.enviar).not.toHaveBeenCalled();
  });

  it('dois cliques simultâneos: só o primeiro reenvia', async () => {
    state.envio = envio({});
    state.marcou = false;
    await expect(reenviarAviso('e1', autor)).rejects.toMatchObject({ status: 409 });
    expect(state.enviar).not.toHaveBeenCalled();
  });

  it('desfaz a marca se o envio lançar', async () => {
    state.envio = envio({});
    state.enviar.mockRejectedValueOnce(new Error('rede'));
    await expect(reenviarAviso('e1', autor)).rejects.toThrow('rede');
    expect(state.desmarcar).toHaveBeenCalledWith('e1');
  });
});
