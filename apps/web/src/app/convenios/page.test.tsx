import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import ConveniosPage from './page';
import { ConvenioList } from '@/components/convenios/ConvenioList';
import { ConvenioDetailDrawer } from '@/components/convenios/ConvenioDetailDrawer';
import type { ConvenioDetailView } from '@/components/convenios/types';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = typeof value === 'function' ? value(hooks.values[index]) : value; }];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    return hooks.values[index] ??= { current: initial };
  },
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useEffect: vi.fn(),
}));
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/applicationApi', () => ({ applicationRequest: request }));

function find<P>(node: ReactNode, type: unknown): ReactElement<P> {
  if (Array.isArray(node)) {
    for (const child of node) { try { return find<P>(child, type); } catch {} }
  } else if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === type) return node as ReactElement<P>;
    return find<P>(node.props.children, type);
  }
  throw new Error('Componente não encontrado');
}
function render() { hooks.cursor = 0; return ConveniosPage(); }
function pending() {
  let resolve!: (data: ConvenioDetailView) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ConvenioDetailView>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const overview = { convenios: [], resumo: { total: 0, ativos: 0, custeados: 0, pacientes: 0, provisionadoCents: 0 } };
const detail = (id: string) => ({ convenio: { id } }) as ConvenioDetailView;

beforeEach(() => {
  hooks.values = [overview]; hooks.cursor = 0; request.mockReset();
  request.mockResolvedValue(overview);
});

it.each(['resolve', 'reject'] as const)('ignora resposta antiga (%s) depois de fechar A e abrir B', async (outcome) => {
  const first = pending(); const second = pending();
  request.mockImplementation((path: string) => path.startsWith('/convenios/a?') ? first.promise
    : path.startsWith('/convenios/b?') ? second.promise : Promise.resolve(overview));
  find<React.ComponentProps<typeof ConvenioList>>(render(), ConvenioList).props.onSelect('a');
  find<React.ComponentProps<typeof ConvenioDetailDrawer>>(render(), ConvenioDetailDrawer).props.onClose();
  find<React.ComponentProps<typeof ConvenioList>>(render(), ConvenioList).props.onSelect('b');
  second.resolve(detail('b')); await second.promise; await Promise.resolve();
  if (outcome === 'resolve') first.resolve(detail('a')); else first.reject(new Error('Erro antigo de A'));
  await first.promise.catch(() => undefined); await Promise.resolve();
  const drawer = find<React.ComponentProps<typeof ConvenioDetailDrawer>>(render(), ConvenioDetailDrawer).props;
  expect(drawer.detail?.convenio.id).toBe('b');
  expect(drawer.error).toBe('');
});

it('a resposta antiga não encerra o carregamento de B', async () => {
  const first = pending(); const second = pending();
  request.mockImplementation((path: string) => path.startsWith('/convenios/a?') ? first.promise : second.promise);
  find<React.ComponentProps<typeof ConvenioList>>(render(), ConvenioList).props.onSelect('a');
  find<React.ComponentProps<typeof ConvenioList>>(render(), ConvenioList).props.onSelect('b');
  first.reject(new Error('Erro antigo')); await first.promise.catch(() => undefined);
  const drawer = find<React.ComponentProps<typeof ConvenioDetailDrawer>>(render(), ConvenioDetailDrawer).props;
  expect(drawer.loading).toBe(true); expect(drawer.error).toBe('');
  second.resolve(detail('b')); await second.promise;
});

it('ignora uma atualização do painel anterior depois de abrir outro convênio', async () => {
  const first = pending();
  request.mockImplementation((path: string) => path.startsWith('/convenios/a?') ? first.promise : Promise.resolve(overview));
  find<React.ComponentProps<typeof ConvenioList>>(render(), ConvenioList).props.onSelect('a');
  const refreshA = find<React.ComponentProps<typeof ConvenioDetailDrawer>>(render(), ConvenioDetailDrawer).props.onRefresh;
  find<React.ComponentProps<typeof ConvenioDetailDrawer>>(render(), ConvenioDetailDrawer).props.onClose();
  find<React.ComponentProps<typeof ConvenioList>>(render(), ConvenioList).props.onSelect('b');
  const count = request.mock.calls.filter(([path]) => path.startsWith('/convenios/a?')).length;
  await refreshA();
  expect(request.mock.calls.filter(([path]) => path.startsWith('/convenios/a?'))).toHaveLength(count);
  first.resolve(detail('a')); await first.promise;
});
