'use client';

import { useState } from 'react';
import { ListOrdered } from 'lucide-react';
import {
  naListaDeEspera,
  ROTULO_EVENTO_LISTA_ESPERA,
  ROTULO_MODO_LISTA_ESPERA,
  ROTULO_SAIDA_LISTA_ESPERA,
  type ModoListaEspera,
} from '@/lib/listaEspera';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';
import type { ManagedPatient } from './managementTypes';

/**
 * Lista de espera no painel da Gestão (especificação final, 5.06 e 5.07):
 * entrada em modo automático ou manual, prioridade excepcional com motivo,
 * retirada e o histórico de movimentos.
 */
export default function PatientWaitlistPanel({ patient, onChange }: {
  patient: ManagedPatient;
  onChange: () => Promise<void>;
}) {
  const [modo, setModo] = useState<ModoListaEspera>(patient.listaEspera?.modo ?? 'AUTOMATICO');
  const [prioritario, setPrioritario] = useState(Boolean(patient.listaEspera?.prioritario));
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  const lista = patient.listaEspera;
  const naLista = Boolean(lista && naListaDeEspera(patient));
  const podeEntrar = !naLista && patient.leadStatus === 'PENDENTE_ATRIBUICAO' && patient.leadId;
  if (!patient.leadId || (!naLista && !podeEntrar && !lista)) return null;

  const enviar = async (acao: 'ENTRAR' | 'ALTERAR' | 'RETIRAR') => {
    setEnviando(true);
    setErro(undefined);
    try {
      await chamarGestao('/api/application/gestao/lista-espera', {
        leadId: patient.leadId,
        acao,
        ...(acao !== 'RETIRAR' ? { modo, prioritario, motivoPrioridade: motivo } : { motivo }),
      });
      setMotivo('');
      await onChange();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao atualizar a lista de espera.');
    } finally {
      setEnviando(false);
    }
  };

  const mudou = naLista && lista && (modo !== lista.modo || prioritario !== Boolean(lista.prioritario));

  return (
    <section className="space-y-3 rounded-2xl border border-psi-soft/60 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
        <ListOrdered className="h-4 w-4 text-psi-vibrant" /> Lista de espera
      </h3>

      {naLista && lista ? (
        <p className="text-xs text-ink">
          Na lista desde {dataHoraBr(lista.entradaEm)} · modo <strong>{ROTULO_MODO_LISTA_ESPERA[lista.modo].toLowerCase()}</strong>
          {patient.posicaoListaEspera ? ` · posição ${patient.posicaoListaEspera}` : ''}
          {lista.prioritario ? ` · prioridade excepcional: ${lista.motivoPrioridade ?? ''}` : ''}
          {patient.leadStatus === 'AGUARDANDO_CONTATO' ? ' · oferta em andamento' : ''}
        </p>
      ) : lista?.saidaEm ? (
        <p className="text-xs text-muted">
          Saiu da lista em {dataHoraBr(lista.saidaEm)}{lista.motivoSaida ? ` — ${ROTULO_SAIDA_LISTA_ESPERA[lista.motivoSaida]}` : ''}.
        </p>
      ) : null}

      {(podeEntrar || naLista) && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(['AUTOMATICO', 'MANUAL'] as const).map((opcao) => (
              <label key={opcao} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold ${modo === opcao ? 'border-psi-vibrant bg-psi-soft/40 text-psi-deep' : 'border-line text-ink'}`}>
                <input type="radio" name={`modo-${patient.id}`} checked={modo === opcao} onChange={() => setModo(opcao)} />
                {ROTULO_MODO_LISTA_ESPERA[opcao]}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted">
            {modo === 'AUTOMATICO'
              ? 'Quando surgir vaga compatível, a oferta sai sozinha, pela ordem de entrada.'
              : 'O paciente aguarda até a Gestão decidir o encaminhamento.'}
          </p>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink">
            <input type="checkbox" checked={prioritario} onChange={(event) => setPrioritario(event.target.checked)} />
            Prioridade excepcional (passa à frente de quem entrou antes)
          </label>
          {(prioritario && !lista?.prioritario) || !naLista ? (
            <input
              type="text"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder={prioritario ? 'Motivo da prioridade (obrigatório)' : naLista ? 'Motivo da retirada (opcional)' : 'Observação (opcional)'}
              className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-ink focus:border-psi-vibrant focus:outline-none"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {podeEntrar && (
              <button type="button" disabled={enviando} onClick={() => void enviar('ENTRAR')} className="btn-primary min-h-10 justify-center disabled:opacity-60">
                {enviando ? 'Salvando…' : 'Colocar na lista de espera'}
              </button>
            )}
            {mudou && (
              <button type="button" disabled={enviando} onClick={() => void enviar('ALTERAR')} className="btn-primary min-h-10 justify-center disabled:opacity-60">
                Salvar alteração
              </button>
            )}
            {naLista && (
              <button type="button" disabled={enviando} onClick={() => void enviar('RETIRAR')} className="btn-ghost min-h-10 justify-center disabled:opacity-60">
                Retirar da lista
              </button>
            )}
          </div>
        </div>
      )}

      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}

      {Boolean(lista?.eventos.length) && (
        <ul className="space-y-1 border-t border-psi-soft/60 pt-2 text-[11px] text-muted">
          {[...lista!.eventos].reverse().map((evento, indice) => (
            <li key={`${evento.em}-${indice}`}>
              {dataHoraBr(evento.em)} — {ROTULO_EVENTO_LISTA_ESPERA[evento.tipo]}
              {evento.detalhe ? `: ${evento.detalhe}` : ''}{evento.porNome ? ` · ${evento.porNome}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
