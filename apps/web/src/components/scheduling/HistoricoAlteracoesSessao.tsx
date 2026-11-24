'use client';

import React, { useEffect, useState } from 'react';
import type { AlteracaoAgendamento } from '@/lib/alteracoesAgendamento';
import { applicationRequest } from '@/lib/applicationApi';
import { dataHoraSessao } from '@/lib/sessionReference';

export function ListaAlteracoes({ alteracoes }: { alteracoes: AlteracaoAgendamento[] }) {
  if (!alteracoes.length) return <p>Nenhuma alteração registrada pela Gestão.</p>;
  return (
    <ol className="space-y-3">
      {alteracoes.map((linha) => (
        <li key={linha.id}>
          <p className="font-semibold text-ink">{linha.alteradoPorNome || 'Gestão'} · <time dateTime={linha.alteradoEm}>{dataHoraSessao(linha.alteradoEm)}</time></p>
          <ul>
            {linha.mudancas.map((item) => <li key={item.campo}>{item.rotulo}: {item.de} → {item.para}</li>)}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function HistoricoAlteracoesSessao({ id }: { id: string }) {
  const [resultado, setResultado] = useState<{ alteracoes: AlteracaoAgendamento[] } | null>();
  useEffect(() => {
    const controller = new AbortController();
    applicationRequest<{ alteracoes: AlteracaoAgendamento[] }>(
      `/gestao/agenda/${encodeURIComponent(id)}/alteracoes`, { signal: controller.signal }
    ).then((data) => {
      if (!controller.signal.aborted) setResultado(data);
    }).catch(() => {
      if (!controller.signal.aborted) setResultado(null);
    });
    return () => controller.abort();
  }, [id]);
  return (
    <section aria-label="Histórico de alterações" className="space-y-2 border-t border-line pt-3 text-xs text-muted">
      <h3 className="font-bold text-ink">Histórico de alterações</h3>
      {resultado ? <ListaAlteracoes alteracoes={resultado.alteracoes} />
        : <p role="status">{resultado === null ? 'Não foi possível carregar o histórico.' : 'Carregando histórico…'}</p>}
    </section>
  );
}
