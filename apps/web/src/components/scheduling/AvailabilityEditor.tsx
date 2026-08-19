'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Save } from 'lucide-react';
import { AvailabilityCopyPanel } from './AvailabilityCopyPanel';
import { AvailabilityDayCard } from './AvailabilityDayCard';
import {
  assinatura, DIAS, erroDaGrade, ordenar, padraoDaGrade, type JanelaEditavel,
} from './availabilityEditorModel';

export type { JanelaEditavel } from './availabilityEditorModel';

interface Props {
  janelas: readonly JanelaEditavel[];
  onSalvar: (janelas: JanelaEditavel[]) => Promise<void>;
}

export function AvailabilityEditor({ janelas, onSalvar }: Props) {
  const [rascunho, setRascunho] = useState<JanelaEditavel[]>(() => ordenar(janelas));
  const [expandido, setExpandido] = useState(() => janelas[0]?.diaSemana ?? 1);
  const [copiarDe, setCopiarDe] = useState<number>();
  const [destinos, setDestinos] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();
  const padrao = useMemo(() => padraoDaGrade(janelas), [janelas]);
  const alterado = assinatura(rascunho) !== assinatura(janelas);
  const erro = erroDaGrade(rascunho);

  const janelasDoDia = (dia: number) => rascunho.filter((janela) => janela.diaSemana === dia);
  const substituirDia = (dia: number, novas: readonly JanelaEditavel[]) => {
    setRascunho((atual) => ordenar([...atual.filter((janela) => janela.diaSemana !== dia), ...novas]));
    setAviso(undefined);
  };

  const alternarDia = (dia: number) => {
    const atuais = janelasDoDia(dia);
    if (atuais.length > 0) {
      substituirDia(dia, []);
      return;
    }
    substituirDia(dia, [{ diaSemana: dia, horaInicio: '08:00', horaFim: '12:00', ...padrao }]);
    setExpandido(dia);
  };

  const alterarJanela = (dia: number, indice: number, campo: Partial<JanelaEditavel>) => {
    substituirDia(dia, janelasDoDia(dia).map((janela, atual) => atual === indice ? { ...janela, ...campo } : janela));
  };

  const alterarRegra = (dia: number, campo: Partial<JanelaEditavel>) => {
    substituirDia(dia, janelasDoDia(dia).map((janela) => ({ ...janela, ...campo })));
  };

  const adicionarPeriodo = (dia: number) => {
    const atuais = janelasDoDia(dia);
    const ultimo = atuais.at(-1);
    const inicio = ultimo?.horaFim ?? '08:00';
    const horaFim = inicio < '18:00' ? '18:00' : '22:00';
    substituirDia(dia, [...atuais, {
      diaSemana: dia,
      horaInicio: inicio,
      horaFim,
      duracaoMin: ultimo?.duracaoMin ?? padrao.duracaoMin,
      modalidade: ultimo?.modalidade ?? padrao.modalidade,
    }]);
  };

  const aplicarCopia = () => {
    if (copiarDe === undefined || destinos.length === 0) return;
    const origem = janelasDoDia(copiarDe);
    setRascunho((atual) => ordenar([
      ...atual.filter((janela) => !destinos.includes(janela.diaSemana)),
      ...destinos.flatMap((dia) => origem.map((janela) => ({ ...janela, diaSemana: dia }))),
    ]));
    setAviso({ tipo: 'ok', texto: `Horários copiados para ${destinos.length} ${destinos.length === 1 ? 'dia' : 'dias'}. Salve para publicar.` });
    setCopiarDe(undefined);
    setDestinos([]);
  };

  const salvar = async () => {
    if (erro || !alterado) return;
    setSalvando(true);
    setAviso(undefined);
    try {
      await onSalvar(ordenar(rascunho));
      setAviso({ tipo: 'ok', texto: 'Disponibilidade publicada. O link dos pacientes já está atualizado.' });
    } catch (causa) {
      setAviso({ tipo: 'erro', texto: causa instanceof Error ? causa.message : 'Não foi possível salvar a disponibilidade.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <header className="bg-psi-darkest px-5 py-6 text-white sm:px-7">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-white/10 p-2.5"><CalendarClock className="h-5 w-5 text-psi-vibrant" /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Grade semanal de atendimento</p>
            <h2 className="mt-1 text-xl font-extrabold">Disponibilidade semanal</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-psi-soft/75">Defina os dias e períodos em que pacientes podem agendar uma sessão.</p>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-4 sm:p-6">
        {aviso && (
          <div role="status" className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${aviso.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{aviso.texto}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-ink">Seus dias de atendimento</h3>
            <p className="text-[11px] text-muted">Ative um dia e abra-o para editar os períodos.</p>
          </div>
          <span className="shrink-0 rounded-full bg-psi-soft px-3 py-1.5 text-[10px] font-bold text-psi-deep">{new Set(rascunho.map((janela) => janela.diaSemana)).size} dias ativos</span>
        </div>

        {DIAS.map((_, dia) => {
          const doDia = janelasDoDia(dia);
          return (
            <div key={dia} className="space-y-3">
              <AvailabilityDayCard
                dia={dia}
                janelas={doDia}
                expandido={expandido === dia}
                padrao={padrao}
                onExpandir={() => setExpandido((atual) => atual === dia ? -1 : dia)}
                onAlternar={() => alternarDia(dia)}
                onAlterar={(indice, campo) => alterarJanela(dia, indice, campo)}
                onAlterarRegra={(campo) => alterarRegra(dia, campo)}
                onAdicionar={() => adicionarPeriodo(dia)}
                onRemover={(indice) => substituirDia(dia, doDia.filter((_, atual) => atual !== indice))}
                onCopiar={() => { setCopiarDe(dia); setDestinos([]); }}
              />
              {copiarDe === dia && (
                <AvailabilityCopyPanel
                  origem={dia}
                  selecionados={destinos}
                  onAlternar={(destino) => setDestinos((atual) => atual.includes(destino) ? atual.filter((item) => item !== destino) : [...atual, destino])}
                  onCancelar={() => { setCopiarDe(undefined); setDestinos([]); }}
                  onAplicar={aplicarCopia}
                />
              )}
            </div>
          );
        })}

        {(alterado || erro) && (
          <div className="sticky bottom-4 z-10 mt-5 flex flex-col gap-3 rounded-2xl border border-psi-vibrant/30 bg-white/95 p-3 shadow-lift backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className={`flex items-center gap-2 text-xs font-bold ${erro ? 'text-rose-700' : 'text-ink'}`}>
              {erro ? <AlertCircle className="h-4 w-4 shrink-0" /> : <span className="h-2 w-2 rounded-full bg-amber-400" />}
              {erro ?? 'Você tem alterações que ainda não foram publicadas.'}
            </div>
            <button type="button" onClick={() => void salvar()} disabled={salvando || Boolean(erro)} className="btn-accent shrink-0 px-5 py-2.5 text-xs">
              <Save className="h-4 w-4" /> {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
