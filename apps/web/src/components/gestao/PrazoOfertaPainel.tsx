'use client';

import { useEffect, useState } from 'react';
import { History, Timer } from 'lucide-react';
import { PRAZO_OFERTA_MAXIMO_HORAS, PRAZO_OFERTA_MINIMO_HORAS, rotuloPrazo } from '@/lib/prazoOferta';
import { chamarGestao, dataHoraBr } from './gestaoApi';

interface ConfiguracaoPrazo {
  prazoOfertaHoras: number;
  padrao: boolean;
  atualizadoEm?: string;
  atualizadoPorNome?: string;
  historico: readonly { valorAnterior: unknown; valorNovo: unknown; alteradoEm: string; alteradoPorNome?: string }[];
  editavel: boolean;
}

/**
 * Prazo para o psicólogo responder à oferta (especificação final, 5.02).
 * A mudança vale para as próximas ofertas; as enviadas mantêm o prazo delas.
 */
export function PrazoOfertaPainel({ onAlterado }: { onAlterado?: (horas: number) => void }) {
  const [config, setConfig] = useState<ConfiguracaoPrazo | null>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  useEffect(() => {
    let ativo = true;
    chamarGestao<{ prazoOferta: ConfiguracaoPrazo }>('/api/application/gestao/configuracoes')
      .then((dados) => {
        if (!ativo) return;
        setConfig(dados.prazoOferta);
        setValor(String(dados.prazoOferta.prazoOfertaHoras));
      })
      .catch((erro: unknown) => { if (ativo) setMensagem({ tipo: 'erro', texto: erro instanceof Error ? erro.message : 'Falha ao carregar o prazo.' }); });
    return () => { ativo = false; };
  }, []);

  const salvar = async () => {
    setSalvando(true);
    setMensagem(null);
    try {
      const dados = await chamarGestao<{ prazoOferta: ConfiguracaoPrazo }>(
        '/api/application/gestao/configuracoes', { prazoOfertaHoras: Number(valor) }, 'PUT',
      );
      setConfig(dados.prazoOferta);
      setMensagem({ tipo: 'ok', texto: `Prazo alterado para ${rotuloPrazo(dados.prazoOferta.prazoOfertaHoras)}. Vale para as próximas ofertas.` });
      onAlterado?.(dados.prazoOferta.prazoOfertaHoras);
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: erro instanceof Error ? erro.message : 'Falha ao salvar o prazo.' });
    } finally {
      setSalvando(false);
    }
  };

  const mudou = config && Number(valor) !== config.prazoOfertaHoras;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <Timer className="h-4 w-4 text-psi-vibrant" /> Prazo para responder à oferta
          </h3>
          <p className="mt-1 text-xs text-muted">
            {config ? `Atual: ${rotuloPrazo(config.prazoOfertaHoras)}${config.padrao ? ' (padrão)' : ''}.` : 'Carregando…'}
            {' '}Alterar não muda o prazo das ofertas já enviadas.
          </p>
          {config?.atualizadoEm && (
            <p className="mt-0.5 text-[11px] text-muted">
              Última alteração em {dataHoraBr(config.atualizadoEm)}{config.atualizadoPorNome ? ` por ${config.atualizadoPorNome}` : ''}.
            </p>
          )}
        </div>
        <div className="flex items-end gap-2">
          <label className="text-[11px] font-bold text-muted">
            Horas
            <input
              type="number"
              min={PRAZO_OFERTA_MINIMO_HORAS}
              max={PRAZO_OFERTA_MAXIMO_HORAS}
              step={1}
              value={valor}
              disabled={!config?.editavel || salvando}
              onChange={(event) => setValor(event.target.value)}
              className="mt-1 block w-24 rounded-xl border border-line bg-slate-50 px-3 py-2 text-sm font-bold text-ink focus:border-psi-vibrant focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={!mudou || salvando || !config?.editavel}
            className="btn-primary min-h-10 justify-center disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar prazo'}
          </button>
        </div>
      </div>
      {config && !config.editavel && (
        <p className="mt-3 text-[11px] font-semibold text-amber-800">A alteração fica disponível depois da migration 087 no banco.</p>
      )}
      {mensagem && (
        <p className={`mt-3 text-xs font-semibold ${mensagem.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{mensagem.texto}</p>
      )}
      {Boolean(config?.historico.length) && (
        <div className="mt-3">
          <button type="button" onClick={() => setVerHistorico((atual) => !atual)} className="flex items-center gap-1 text-[11px] font-bold text-psi-deep">
            <History className="h-3.5 w-3.5" /> {verHistorico ? 'Ocultar histórico' : 'Ver histórico de alterações'}
          </button>
          {verHistorico && (
            <ul className="mt-2 space-y-1 text-[11px] text-muted">
              {config!.historico.map((item) => (
                <li key={item.alteradoEm}>
                  {dataHoraBr(item.alteradoEm)} — {String(item.valorAnterior ?? 24)} h → {String(item.valorNovo)} h
                  {item.alteradoPorNome ? ` · ${item.alteradoPorNome}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
