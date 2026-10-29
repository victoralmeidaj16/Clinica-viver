import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import type { ConvenioDetailView } from './types';

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => [initial, vi.fn()],
  useMemo: (fn: () => unknown) => fn(),
}));
import { FaturamentoPanel } from './FaturamentoPanel';

function buttons(node: ReactNode): ReactElement<{ disabled?: boolean; children?: ReactNode }>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<{ children?: ReactNode; disabled?: boolean }>(node)) return [];
  return [...(node.type === 'button' ? [node] : []), ...buttons(node.props.children)];
}

it('impede fechar enquanto a lista não corresponde ao período escolhido', () => {
  const detail = { convenio: { id: 'empresa' }, pacientes: [], faturas: [], sessoes: [
    { chargeId: 'charge', custeadoPelaEmpresa: true, status: 'pending', valorCents: 10000 },
  ] } as unknown as ConvenioDetailView;
  const panel = (aplicado: string, loading = false) => FaturamentoPanel({
    detail, periodo: { inicio: '2026-10-01', fim: '2026-10-31' },
    periodoAplicado: { inicio: aplicado, fim: '2026-10-31' }, loading,
    onPeriodoChange: vi.fn(), onRefresh: vi.fn(),
  });
  // O último botão do painel é o fechamento; os botões de seleção estão no componente filho.
  expect(buttons(panel('2026-09-01')).at(-1)?.props.disabled).toBe(true);
  expect(buttons(panel('2026-10-01', true)).at(-1)?.props.disabled).toBe(true);
  expect(buttons(panel('2026-10-01')).at(-1)?.props.disabled).toBe(false);
});
