import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { NoShowDialog } from './NoShowDialog';
import { UpcomingSessions, type AgendamentoResumo } from './UpcomingSessions';

const SESSAO: AgendamentoResumo = { id: 'a', pacienteNome: 'Paciente fictício',
  inicio: '2020-01-02T12:00:00Z', fim: '2020-01-02T12:50:00Z', modalidade: 'online',
  status: 'agendado', origem: 'portal', criadoEm: '2020-01-01T12:00:00Z', linkPagamento: '/pagar/sessao/x',
  custeadoPelaEmpresa: false, podeConfirmarRealizacao: true };

function lista(sessao: Partial<AgendamentoResumo>, comFalta = true) {
  return renderToStaticMarkup(<UpcomingSessions onCancelar={vi.fn()} onConfirmarRealizacao={vi.fn()}
    onAtualizarVencimento={vi.fn()} onRegistrarFalta={comFalta ? vi.fn() : undefined}
    agendamentos={[{ ...SESSAO, ...sessao }]} />);
}

it('mantém a retomada do cancelamento acessível depois da atualização da lista', () => {
  const markup = lista({ inicio: '2030-01-02T12:00:00Z', fim: '2030-01-02T12:50:00Z', status: 'cancelado', podeConfirmarRealizacao: false });
  expect(markup).toContain('CANCELADA');
  expect(markup).toContain('Conferir cancelamento');
});

it('oferece registrar falta ao lado da confirmação quando a sessão já começou', () => {
  const markup = lista({});
  expect(markup).toContain('Registrar falta');
  expect(markup).toContain('Confirmar que ocorreu');
});

it('não oferece falta antes do início', () => {
  expect(lista({ inicio: '2099-01-02T12:00:00Z', fim: '2099-01-02T12:50:00Z', podeConfirmarRealizacao: false }))
    .not.toContain('Registrar falta');
});

it('não mostra falta como realizada nem permite editá-la', () => {
  const markup = lista({ status: 'faltou', podeConfirmarRealizacao: false, pagamentoStatus: 'pending' });
  expect(markup).toContain('FALTA · COBRADA');
  expect(markup).not.toContain('REALIZADA');
  expect(markup).not.toContain('Registrar falta');
  expect(markup).not.toContain('Editar<');
  expect(markup).toContain('Pagamento da sessão');
});

it.each([undefined, 'cancelled'])('falta isenta (%s) não oferece pagamento', (pagamentoStatus) => {
  const markup = lista({ status: 'faltou', podeConfirmarRealizacao: false, pagamentoStatus });
  expect(markup).toContain('FALTA · SEM COBRANÇA');
  expect(markup).not.toContain('Pagamento da sessão');
  expect(markup).not.toContain('Pagamento: pendente');
});

it('falta paga mantém o pagamento e não permite rever a decisão', () => {
  const markup = lista({ status: 'faltou', podeConfirmarRealizacao: false, pagamentoStatus: 'paid' });
  expect(markup).toContain('FALTA · COBRADA');
  expect(markup).not.toContain('Alterar cobrança');
});

const dialogo = (session: Partial<AgendamentoResumo>) => renderToStaticMarkup(
  <NoShowDialog session={{ ...SESSAO, ...session }} onClose={vi.fn()} onConfirm={vi.fn()} />);

it('exige escolher a cobrança antes de registrar', () => {
  const markup = dialogo({});
  expect(markup).toContain('Esta sessão será cobrada do paciente?');
  expect(markup).not.toContain('checked');
  expect(markup).toMatch(/<button type="submit" disabled=""/);
});

it('bloqueia a isenção de sessão já paga', () => {
  const markup = dialogo({ pagamentoStatus: 'paid' });
  expect(markup).toContain('já tem pagamento registrado');
  expect(markup).toMatch(/<input type="radio"[^>]*disabled=""/);
});

it('explica o destino da cobrança em sessão custeada', () => {
  expect(dialogo({ custeadoPelaEmpresa: true, convenioNome: 'Empresa fictícia' }))
    .toContain('Sessão custeada por Empresa fictícia');
});
