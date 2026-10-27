import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { UpcomingSessions } from './UpcomingSessions';

it('mantém a retomada do cancelamento acessível depois da atualização da lista', () => {
  const markup = renderToStaticMarkup(<UpcomingSessions onCancelar={vi.fn()} onConfirmarRealizacao={vi.fn()}
    onAtualizarVencimento={vi.fn()} agendamentos={[{ id: 'a', pacienteNome: 'Paciente fictício',
      inicio: '2030-01-02T12:00:00Z', fim: '2030-01-02T12:50:00Z', modalidade: 'online',
      status: 'cancelado', origem: 'portal', criadoEm: '2026-01-01T12:00:00Z', linkPagamento: '',
      custeadoPelaEmpresa: false, podeConfirmarRealizacao: false }]} />);
  expect(markup).toContain('CANCELADA');
  expect(markup).toContain('Conferir cancelamento');
});
