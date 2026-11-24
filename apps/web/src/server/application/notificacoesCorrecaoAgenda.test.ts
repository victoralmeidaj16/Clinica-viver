import { beforeEach, expect, it, vi } from 'vitest';
import type { AlteracaoAgendamentoComPaciente } from '@/lib/alteracoesAgendamento';
import { notificacoesDeCorrecaoDaGestao } from './notificacoesCorrecaoAgenda';
import { correcoesDaGestao, notificacoesDaSessao } from './notificacoesDaSessao';

const { configurado, membership, recentes } = vi.hoisted(() => ({
  configurado: vi.fn(), membership: vi.fn(), recentes: vi.fn(),
}));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ read: async () => ({}) }) }));
vi.mock('./psychologistSelf', () => ({ cadastroDaSessao: async () => null }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: configurado }));
vi.mock('./store', () => ({ getApplicationStore: () => ({ identities: { findMembershipByUser: membership } }) }));
vi.mock('@/server/persistence/mysql/agendamentoAlteracoesRepository', () => ({ alteracoesRecentesDoProfissional: recentes }));
const linha: AlteracaoAgendamentoComPaciente = {
  id: 'alt', agendamentoId: 'apt', profissionalRef: 'p', alteradoEm: '2026-11-11T14:00:00Z',
  pacienteNome: 'Paciente fictício', inicio: '2026-11-15T12:30:00Z',
  mudancas: [{ campo: 'formato', rotulo: 'Formato', de: 'On-line', para: 'Presencial' },
    { campo: 'situacao', rotulo: 'Situação', de: 'Agendado', para: 'Confirmado' }],
};
beforeEach(() => {
  vi.clearAllMocks();
  configurado.mockReturnValue(true);
  membership.mockResolvedValue({ professionalProfileId: 'p' });
  recentes.mockResolvedValue([linha]);
});
it('apresenta as mudanças e abre a sessão no foco certo', () => {
  expect(notificacoesDeCorrecaoDaGestao([linha])).toEqual([{
    chave: 'agenda-corrigida:apt:2026-11-11T14:00:00Z', tipo: 'agenda-corrigida',
    titulo: 'Atendimento alterado pela Gestão',
    descricao: 'Paciente fictício — 15/11/2026 às 09:30: Formato: On-line → Presencial; Situação: Agendado → Confirmado.',
    ocorridoEm: linha.alteradoEm, severidade: 'ATENCAO', href: '/agenda?foco=sessao-apt', pendente: false,
  }]);
});
it('distingue correções sucessivas no mesmo atendimento', () => {
  const avisos = notificacoesDeCorrecaoDaGestao([linha, { ...linha, alteradoEm: '2026-11-11T15:00:00Z' }]);
  expect(new Set(avisos.map((aviso) => aviso.chave)).size).toBe(2);
  expect(notificacoesDeCorrecaoDaGestao([])).toEqual([]);
});
it('consulta só os últimos 30 dias do psicólogo vinculado na organização', async () => {
  const agora = Date.now();
  expect(await correcoesDaGestao('org', 'user')).toHaveLength(1);
  expect(membership).toHaveBeenCalledWith('org', 'user');
  expect(recentes).toHaveBeenCalledWith('org', 'p', expect.any(Date));
  expect(Math.abs(recentes.mock.calls[0][2].getTime() - (agora - 30 * 86400000))).toBeLessThan(1000);
});
it('sem MySQL ou vínculo dispensa a consulta', async () => {
  configurado.mockReturnValueOnce(false);
  expect(await correcoesDaGestao('org', 'user')).toEqual([]);
  expect(membership).not.toHaveBeenCalled();
  membership.mockResolvedValue(null);
  expect(await correcoesDaGestao('org', 'user')).toEqual([]);
  expect(recentes).not.toHaveBeenCalled();
});
it('uma falha de consulta preserva os outros avisos e não expõe a exceção', async () => {
  recentes.mockRejectedValue(new Error('detalhe privado'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(await correcoesDaGestao('org', 'user')).toEqual([]);
    expect(log.mock.calls.flat().join(' ')).not.toContain('detalhe privado');
  } finally { log.mockRestore(); }
});

it('entrega o aviso ao psicólogo com perfil profissional mesmo sem cadastro de captação', async () => {
  const avisos = await notificacoesDaSessao({
    userId: 'user', organizationId: 'org', role: 'psicologo', issuedAt: Date.now(), expiresAt: Date.now() + 60000,
  }, new Date());
  expect(avisos).toEqual(notificacoesDeCorrecaoDaGestao([linha]));
});
