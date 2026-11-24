'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  CATALOGO_AVISOS,
  ROTULO_CANAL,
  ROTULO_DESTINATARIO,
  type CanalAviso,
} from '@/lib/avisos/catalogo';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';
import { EditorModeloAviso, type ModeloDoEditor } from './EditorModeloAviso';

const URL = '/api/application/gestao/avisos/modelos';

/** Lista de avisos com evento, destinatário, canal e versão; abre o editor de cada um. */
export function PainelModelosAvisos() {
  const [modelos, setModelos] = useState<ModeloDoEditor[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setModelos(await chamarGestao<ModeloDoEditor[]>(URL));
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao carregar os modelos.');
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  async function salvar(finalidade: string, entrada: { texto: string | null; canal: CanalAviso; ativo: boolean }) {
    setSalvando(true);
    setAviso(null);
    try {
      const atualizado = await chamarGestao<ModeloDoEditor>(URL, { finalidade, ...entrada }, 'PUT');
      setModelos((atual) => atual?.map((item) => (item.finalidade === finalidade ? atualizado : item)) ?? null);
      setAviso(`Versão ${atualizado.configuracao.versao} gravada. Os próximos envios já usam este texto.`);
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted">
        Avisos essenciais saem sempre a cada evento real; a Gestão muda o texto e o canal, mas não os desliga.
        Complementares começam desligados. Cada mudança vira uma versão, e o registro de envios mostra qual versão saiu.
      </p>
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
      {aviso && <p className="text-xs font-semibold text-emerald-700">{aviso}</p>}
      {!modelos && !erro && <p className="text-xs text-muted">Carregando…</p>}
      <ul className="divide-y divide-line rounded-3xl border border-line bg-surface shadow-card">
        {modelos && CATALOGO_AVISOS.map((item) => {
          const modelo = modelos.find((m) => m.finalidade === item.finalidade);
          if (!modelo) return null;
          const expandido = aberto === item.finalidade;
          return (
            <li key={item.finalidade} className="px-4 py-3">
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : item.finalidade)}
                className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
              >
                <span className="flex items-start gap-2">
                  {expandido ? <ChevronDown className="mt-0.5 h-4 w-4 text-muted" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-muted" />}
                  <span>
                    <span className="block text-sm font-extrabold text-ink">{item.titulo}</span>
                    <span className="block text-[11px] text-muted">{item.evento}</span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{ROTULO_DESTINATARIO[item.destinatario]}</span>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">{ROTULO_CANAL[modelo.configuracao.canal]}</span>
                  <span className={`rounded-full px-2 py-0.5 ${item.essencial ? 'bg-violet-50 text-violet-800' : modelo.configuracao.ativo ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    {item.essencial ? 'Essencial' : modelo.configuracao.ativo ? 'Complementar · ativo' : 'Complementar · desligado'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                    {modelo.configuracao.texto ? `Versão ${modelo.configuracao.versao}` : 'Texto padrão'}
                  </span>
                </span>
              </button>
              {expandido && (
                <div className="mt-4 border-t border-line pt-4">
                  {modelo.atualizadoEm && (
                    <p className="mb-3 text-[11px] text-muted">
                      Última alteração em {dataHoraBr(modelo.atualizadoEm)}{modelo.atualizadoPorNome ? ` por ${modelo.atualizadoPorNome}` : ''}.
                    </p>
                  )}
                  <EditorModeloAviso
                    key={`${item.finalidade}-${modelo.configuracao.versao}`}
                    aviso={item}
                    modelo={modelo}
                    salvando={salvando}
                    onSalvar={(entrada) => salvar(item.finalidade, entrada)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
