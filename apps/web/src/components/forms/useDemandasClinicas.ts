'use client';

import { useEffect, useState } from 'react';
import { DEMANDAS_PADRAO } from '@/lib/demandasPadrao';

let pedido: Promise<readonly string[]> | null = null;

function carregar(): Promise<readonly string[]> {
  pedido ??= fetch('/api/application/demandas', { cache: 'no-store' })
    .then((resposta) => resposta.json())
    .then((corpo: { success?: boolean; data?: { demandas?: string[] } }) =>
      corpo.success && Array.isArray(corpo.data?.demandas) && corpo.data.demandas.length ? corpo.data.demandas : DEMANDAS_PADRAO)
    .catch(() => {
      pedido = null;
      return DEMANDAS_PADRAO;
    });
  return pedido;
}

export function recarregarDemandasClinicas(): void {
  pedido = null;
}

/**
 * Demandas clínicas mantidas pela Gestão (3.4). Enquanto carrega, ou se a API
 * falhar, vale a lista inicial.
 */
export function useDemandasClinicas(): readonly string[] {
  const [demandas, setDemandas] = useState<readonly string[]>(DEMANDAS_PADRAO);
  useEffect(() => {
    let ativo = true;
    void carregar().then((lista) => { if (ativo) setDemandas(lista); });
    return () => { ativo = false; };
  }, []);
  return demandas;
}

/** Demandas para marcar: as ativas, mais as já marcadas que saíram da lista. */
export function demandasParaSelecao(ativas: readonly string[], selecionados: readonly string[] | undefined): string[] {
  const extras = (selecionados ?? []).filter((item) => !ativas.includes(item));
  return [...ativas, ...extras];
}
