import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ valores: new Map<string, unknown>() }));

vi.mock('server-only', () => ({}));
vi.mock('@/server/application/configuracaoGestao', () => ({
  organizacaoPadrao: () => 'org-teste',
  lerConfiguracaoGestao: vi.fn(async (_org: string, chave: string) => ({
    valor: state.valores.get(chave), historico: [], editavel: true,
  })),
  gravarConfiguracaoGestao: vi.fn(),
}));
vi.mock('./avisosEnviosRepository', () => ({ registrarEnvioDeAviso: vi.fn() }));

import { limparCacheDosModelos } from '@/server/application/modelosAvisos';
import { prepararAviso } from './avisoEnvio';

describe('prepararAviso', () => {
  beforeEach(() => {
    state.valores.clear();
    limparCacheDosModelos();
  });

  it('sem versão gravada, envia o texto padrão como versão 0', async () => {
    await expect(prepararAviso('agenda_cancelamento_paciente', 'padrão', { variaveis: { nome_paciente: 'Ana' } }))
      .resolves.toEqual({ texto: 'padrão', versao: 0, desligado: false });
  });

  it('aplica a versão da Gestão com os campos do chamador', async () => {
    state.valores.set('modelo_aviso:agenda_cancelamento_paciente', { versao: 3, texto: 'Oi {{nome_paciente}}, cancelada: {{dia_horario}}', canal: 'whatsapp' });
    await expect(prepararAviso('agenda_cancelamento_paciente', 'padrão', { variaveis: { nome_paciente: 'Ana', dia_horario: 'sexta' } }))
      .resolves.toEqual({ texto: 'Oi Ana, cancelada: sexta', versao: 3, desligado: false });
  });

  it('sem os campos do chamador, cai no padrão em vez de enviar campos vazios', async () => {
    state.valores.set('modelo_aviso:agenda_cancelamento_paciente', { versao: 3, texto: 'Oi {{nome_paciente}}', canal: 'whatsapp' });
    await expect(prepararAviso('agenda_cancelamento_paciente', 'padrão', {}))
      .resolves.toEqual({ texto: 'padrão', versao: 0, desligado: false });
  });

  it('canal só e-mail desliga o WhatsApp do aviso', async () => {
    state.valores.set('modelo_aviso:alocacao_psicologo', { versao: 1, texto: null, canal: 'email' });
    await expect(prepararAviso('alocacao_psicologo', 'padrão', {})).resolves.toMatchObject({ desligado: true });
  });

  it('complementar desligado não sai; ativado sai', async () => {
    await expect(prepararAviso('lembrete_sessao_paciente', 'x', {})).resolves.toMatchObject({ desligado: true });
    state.valores.set('modelo_aviso:lembrete_sessao_paciente', { versao: 1, texto: null, canal: 'whatsapp', ativo: true });
    limparCacheDosModelos();
    await expect(prepararAviso('lembrete_sessao_paciente', 'x', {})).resolves.toMatchObject({ desligado: false });
  });

  it('reenvio usa o texto guardado sem reaplicar modelo nem canal', async () => {
    state.valores.set('modelo_aviso:alocacao_psicologo', { versao: 1, texto: null, canal: 'email' });
    await expect(prepararAviso('alocacao_psicologo', 'guardado', { reenvio: { de: 'e1', autor: { usuarioRef: 'u1' } } }))
      .resolves.toEqual({ texto: 'guardado', versao: 0, desligado: false });
  });

  it('finalidade fora do catálogo segue com o texto recebido', async () => {
    await expect(prepararAviso('alerta_coordenacao', 'alerta', {})).resolves.toEqual({ texto: 'alerta', versao: 0, desligado: false });
  });
});
