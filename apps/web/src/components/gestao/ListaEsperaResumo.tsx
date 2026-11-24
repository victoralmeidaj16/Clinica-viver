'use client';

import { ListOrdered } from 'lucide-react';
import { compararListaDeEspera, naListaDeEspera, ROTULO_MODO_LISTA_ESPERA, type ListaEsperaRegistro } from '@/lib/listaEspera';
import { dataHoraBr } from './gestaoApi';

interface ItemDaFila {
  id: string;
  protocolo: string;
  nomePaciente: string;
  status: string;
  listaEspera?: ListaEsperaRegistro;
}

/**
 * A lista de espera em ordem de atendimento (especificação final, 5.07 e
 * 5.08): prioridade excepcional primeiro, depois a data de entrada. Clicar
 * abre o mesmo painel de detalhes da fila, onde ficam as ações.
 */
export function ListaEsperaResumo({ leads, onAbrir }: { leads: readonly ItemDaFila[]; onAbrir: (leadId: string) => void }) {
  const fila = leads.filter(naListaDeEspera).sort(compararListaDeEspera);
  if (!fila.length) return null;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink">
        <ListOrdered className="h-4 w-4 text-psi-vibrant" /> Lista de espera ({fila.length})
      </h3>
      <p className="mt-1 text-xs text-muted">
        No modo automático, a vaga compatível que surgir é oferecida nesta ordem. O rodízio das solicitações novas continua normalmente.
      </p>
      <ol className="mt-3 divide-y divide-line">
        {fila.map((lead, indice) => (
          <li key={lead.id}>
            <button
              type="button"
              onClick={() => onAbrir(lead.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="font-extrabold text-ink">{indice + 1}. {lead.nomePaciente}</span>
                <span className="ml-2 font-mono text-[10px] text-muted">{lead.protocolo}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                {lead.listaEspera?.prioritario && (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">Prioritário</span>
                )}
                <span className="rounded-full border border-line bg-slate-50 px-2 py-0.5 text-ink">
                  {lead.listaEspera ? ROTULO_MODO_LISTA_ESPERA[lead.listaEspera.modo] : ''}
                </span>
                {lead.status === 'AGUARDANDO_CONTATO' && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">Oferta em andamento</span>
                )}
                <span className="text-muted">desde {dataHoraBr(lead.listaEspera?.entradaEm)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
