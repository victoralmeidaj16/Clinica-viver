'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { DemandaClinica } from '@/lib/catalogoDemandas';
import { recarregarDemandasClinicas } from '@/components/forms/useDemandasClinicas';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';

interface DemandasParaGestao {
  demandas: DemandaClinica[];
  historico: { alteradoEm: string; alteradoPorNome?: string }[];
  editavel: boolean;
}

/**
 * Demandas clínicas (especificação final, 3.4). Renomear atualiza também os
 * cadastros e pedidos que já usam a demanda; remover só tira das listas de
 * escolha, sem apagar o que já foi marcado.
 */
export function PainelDemandas() {
  const [dados, setDados] = useState<DemandasParaGestao | null>(null);
  const [nova, setNova] = useState('');
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  const carregar = useCallback(async () => {
    try {
      setDados(await chamarGestao<DemandasParaGestao>('/api/application/gestao/demandas'));
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao carregar as demandas.');
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const operar = async (corpo: Record<string, unknown>) => {
    setEnviando(true);
    setErro(undefined);
    try {
      await chamarGestao('/api/application/gestao/demandas', corpo);
      setNova('');
      setRenomeando(null);
      recarregarDemandasClinicas();
      await carregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao alterar a demanda.');
    } finally {
      setEnviando(false);
    }
  };

  const ultima = dados?.historico[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-3xl border border-line bg-surface p-4 shadow-card">
        <label className="min-w-64 flex-1 text-[11px] font-bold text-muted">Nova demanda
          <input value={nova} onChange={(event) => setNova(event.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink" />
        </label>
        <button type="button" disabled={enviando || nova.trim().length < 3 || !dados?.editavel} onClick={() => void operar({ acao: 'ADICIONAR', nome: nova })} className="btn-primary min-h-10 justify-center disabled:opacity-50">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      {ultima && <p className="text-[11px] text-muted">Última alteração em {dataHoraBr(ultima.alteradoEm)}{ultima.alteradoPorNome ? ` por ${ultima.alteradoPorNome}` : ''}.</p>}
      {dados && !dados.editavel && <p className="text-xs font-semibold text-amber-800">A edição fica disponível depois da migration 087 no banco.</p>}
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}

      <ul className="divide-y divide-line rounded-3xl border border-line bg-surface shadow-card">
        {(dados?.demandas ?? []).map((demanda) => (
          <li key={demanda.nome} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
            {renomeando === demanda.nome ? (
              <div className="flex flex-1 flex-wrap gap-2">
                <input value={novoNome} onChange={(event) => setNovoNome(event.target.value)} className="min-w-48 flex-1 rounded-xl border border-line bg-white px-3 py-1.5 text-xs text-ink" />
                <button type="button" disabled={enviando} onClick={() => void operar({ acao: 'RENOMEAR', nome: demanda.nome, novoNome })} className="btn-primary min-h-9 justify-center">Salvar</button>
                <button type="button" onClick={() => setRenomeando(null)} className="btn-ghost min-h-9 justify-center">Cancelar</button>
              </div>
            ) : (
              <>
                <span className={`font-semibold ${demanda.ativo ? 'text-ink' : 'text-muted line-through'}`}>
                  {demanda.nome}
                  {demanda.nomesAnteriores.length > 0 && <span className="ml-1 font-normal text-muted">(antes: {demanda.nomesAnteriores.join(', ')})</span>}
                </span>
                <span className="flex gap-1.5">
                  <button type="button" disabled={!dados?.editavel} onClick={() => { setRenomeando(demanda.nome); setNovoNome(demanda.nome); }} className="rounded-lg border border-line px-2 py-1 font-bold text-ink hover:bg-slate-50 disabled:opacity-50">Renomear</button>
                  <button type="button" disabled={enviando || !dados?.editavel} onClick={() => void operar({ acao: demanda.ativo ? 'DESATIVAR' : 'REATIVAR', nome: demanda.nome })} className="rounded-lg border border-line px-2 py-1 font-bold text-ink hover:bg-slate-50 disabled:opacity-50">
                    {demanda.ativo ? 'Remover' : 'Reativar'}
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
