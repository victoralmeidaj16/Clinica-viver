'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle, CalendarCheck2, CalendarDays, Check, CheckCircle2, Clock3, Info, Laptop, Lightbulb, Plus, Timer, Trash2,
} from 'lucide-react';
import { AvailabilityEditor } from './AvailabilityEditor';
import { assinatura, DIAS, INTERVALOS, rotuloIntervalo, type JanelaEditavel } from './availabilityEditorModel';
import { SessionDurationField } from './SessionDurationField';
import {
  configDaGrade, erroDaConfig, gradeDaConfig, horariosDoDia, ORDEM_SEMANA,
  rotuloDias, rotuloDuracao, rotuloPeriodos, type ConfigDisponibilidade,
} from './availabilityStepsModel';

interface Props {
  janelas: readonly JanelaEditavel[];
  onSalvar: (janelas: JanelaEditavel[]) => Promise<void>;
  /** O passo 3, de bloqueios, que salva por conta própria. */
  bloqueios: ReactNode;
  permiteDuracaoVariavel?: boolean;
}

function Passo({ id, numero, titulo, opcional, descricao, children }: {
  id: string; numero: number; titulo: string; opcional?: boolean; descricao?: string; children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#B597DA] text-[15px] font-black text-white">{numero}</span>
        <div>
          <h3 className="mt-1.5 text-base font-black text-psi-darkest">
            {titulo} {opcional && <small className="text-[13px] font-semibold text-muted">(opcional)</small>}
          </h3>
          {descricao && <p className="mt-1 text-xs text-muted">{descricao}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const CAMPO = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-extrabold text-ink focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20';

/**
 * A disponibilidade em quatro passos: dias, horário, bloqueios e resumo.
 *
 * Pergunta a regra uma vez só e a aplica a todos os dias marcados. Quem atende
 * com horários diferentes em cada dia continua tendo o editor dia a dia, que é
 * aberto sozinho quando a grade salva já não cabe numa regra única.
 */
export function AvailabilitySteps({ janelas, onSalvar, bloqueios, permiteDuracaoVariavel = false }: Props) {
  const lida = useMemo(() => configDaGrade(janelas), [janelas]);
  const [config, setConfig] = useState<ConfigDisponibilidade>(lida.config);
  // Salvar pelo editor dia a dia troca a grade por fora; o rascunho dos passos
  // recomeça dela para não reapresentar a regra antiga.
  const [lidaAnterior, setLidaAnterior] = useState(lida);
  if (lidaAnterior !== lida) {
    setLidaAnterior(lida);
    setConfig(lida.config);
  }
  const [diaADia, setDiaADia] = useState(!lida.uniforme);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();

  const grade = gradeDaConfig(config);
  const alterado = assinatura(grade) !== assinatura(janelas);
  const erro = erroDaConfig(config);
  const horarios = horariosDoDia(config);
  const intervalos = INTERVALOS.includes(config.intervaloMin) ? INTERVALOS : [...INTERVALOS, config.intervaloMin].sort((a, b) => a - b);

  const mudar = (parcial: Partial<ConfigDisponibilidade>) => {
    setConfig((atual) => ({ ...atual, ...parcial }));
    setAviso(undefined);
  };
  const alternarDia = (dia: number) => mudar({
    dias: config.dias.includes(dia) ? config.dias.filter((item) => item !== dia) : [...config.dias, dia],
  });
  const mudarPeriodo = (indice: number, campo: Partial<ConfigDisponibilidade['periodos'][number]>) => mudar({
    periodos: config.periodos.map((periodo, atual) => (atual === indice ? { ...periodo, ...campo } : periodo)),
  });
  const adicionarPeriodo = () => {
    const ultimo = config.periodos.at(-1)?.horaFim ?? '08:00';
    const inicio = ultimo < '14:00' ? '14:00' : ultimo < '18:00' ? '18:00' : ultimo;
    mudar({ periodos: [...config.periodos, { horaInicio: inicio, horaFim: inicio < '18:00' ? '18:00' : '22:00' }] });
  };

  const salvar = async () => {
    if (erro || !alterado) return;
    setSalvando(true);
    setAviso(undefined);
    try {
      await onSalvar(grade);
      setAviso({ tipo: 'ok', texto: 'Disponibilidade salva. O link dos pacientes já está atualizado.' });
    } catch (causa) {
      setAviso({ tipo: 'erro', texto: causa instanceof Error ? causa.message : 'Não foi possível salvar a disponibilidade.' });
    } finally {
      setSalvando(false);
    }
  };

  const cabecalho = (
    <div id="agenda-disponibilidade" className="flex items-center gap-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-psi-soft">
        <CalendarDays className="h-6 w-6 text-psi-deep" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-black tracking-tight text-psi-darkest">Sua disponibilidade</h2>
        <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-psi-deep">
          Configure seus dias e horários para que seus pacientes possam agendar os atendimentos pelo seu link.
        </p>
      </div>
    </div>
  );

  if (diaADia) {
    return (
      <>
        {cabecalho}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-psi-soft bg-white px-4 py-3 text-xs text-muted">
          <span>{lida.uniforme
            ? 'Você está ajustando cada dia separadamente.'
            : 'Seus dias têm horários diferentes entre si, por isso a grade abre dia a dia.'}</span>
          <button type="button" onClick={() => setDiaADia(false)} className="font-extrabold text-psi-deep underline hover:text-psi-darkest">
            {lida.uniforme ? 'Voltar à configuração em passos' : 'Usar o mesmo horário em todos os dias'}
          </button>
        </div>
        <AvailabilityEditor janelas={janelas} onSalvar={onSalvar} permiteDuracaoVariavel={permiteDuracaoVariavel} />
        <section id="agenda-passo-3" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-card sm:p-6">
          <div>
            <h3 className="text-base font-black text-psi-darkest">Bloqueios <small className="text-[13px] font-semibold text-muted">(opcional)</small></h3>
            <p className="mt-1 text-xs text-muted">Informe dias ou períodos em que não estará disponível, como férias e folgas.</p>
          </div>
          {bloqueios}
        </section>
      </>
    );
  }

  return (
    <>
      {cabecalho}

      <Passo id="agenda-passo-1" numero={1} titulo="Dias de atendimento" descricao="Selecione os dias da semana em que você está disponível.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {ORDEM_SEMANA.map((dia) => {
            const ativo = config.dias.includes(dia);
            return (
              <button
                key={dia}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarDia(dia)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-bold transition ${
                  ativo ? 'border-[#8F61C2] bg-[#8F61C2] text-white shadow-[0_6px_14px_rgba(143,97,194,.25)]' : 'border-slate-200 bg-white text-ink hover:border-psi-vibrant'
                }`}
              >
                <span className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded border-[1.5px] ${ativo ? 'border-white/80' : 'border-[#C8BED4]'}`}>
                  {ativo && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </span>
                {DIAS[dia]}
              </button>
            );
          })}
        </div>
      </Passo>

      <Passo id="agenda-passo-2" numero={2} titulo="Horários e duração das sessões" descricao="Defina o período em que você pode atender, a duração das sessões e a modalidade.">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] md:gap-0">
          <div className="flex flex-col gap-2 md:pr-5">
            <span className="text-[12.5px] font-extrabold text-psi-darkest">Período de atendimento</span>
            {config.periodos.map((periodo, indice) => (
              <div key={indice} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2.5">
                <label className="text-[10.5px] font-semibold text-muted">Das
                  <input type="time" aria-label={`Início do período ${indice + 1}`} value={periodo.horaInicio} onChange={(evento) => mudarPeriodo(indice, { horaInicio: evento.target.value })} className={`${CAMPO} mt-1 tabular-nums`} />
                </label>
                <label className="text-[10.5px] font-semibold text-muted">Até
                  <input type="time" aria-label={`Fim do período ${indice + 1}`} value={periodo.horaFim} onChange={(evento) => mudarPeriodo(indice, { horaFim: evento.target.value })} className={`${CAMPO} mt-1 tabular-nums`} />
                </label>
                <button
                  type="button"
                  onClick={() => mudar({ periodos: config.periodos.filter((_, atual) => atual !== indice) })}
                  disabled={config.periodos.length === 1}
                  aria-label={`Remover período ${indice + 1}`}
                  className="mb-0.5 rounded-xl p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:invisible"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <label className="flex flex-col gap-2 border-line md:border-l md:px-5">
            <span className="text-[12.5px] font-extrabold text-psi-darkest">Duração da sessão</span>
            <SessionDurationField
              value={config.duracaoMin}
              onChange={(duracaoMin) => mudar({ duracaoMin })}
              permiteVariavel={permiteDuracaoVariavel}
              className={`${CAMPO} md:mt-[19px]`}
            />
          </label>
          <label className="flex flex-col gap-2 border-line md:border-l md:px-5">
            <span className="text-[12.5px] font-extrabold text-psi-darkest">Intervalo entre sessões</span>
            <select value={config.intervaloMin} onChange={(evento) => mudar({ intervaloMin: Number(evento.target.value) })} className={`${CAMPO} md:mt-[19px]`}>
              {intervalos.map((valor) => <option key={valor} value={valor}>{rotuloIntervalo(valor)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 border-line md:border-l md:pl-5">
            <span className="text-[12.5px] font-extrabold text-psi-darkest">Modalidade</span>
            <select value={config.modalidade} onChange={(evento) => mudar({ modalidade: evento.target.value as JanelaEditavel['modalidade'] })} className={`${CAMPO} md:mt-[19px]`}>
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
            </select>
          </label>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-[#F4EEFA] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#4A3D58]">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-psi-vibrant" />
          <span>
            O sistema divide cada período em sessões de {rotuloDuracao(config.duracaoMin)}
            {config.intervaloMin > 0 ? `, com ${config.intervaloMin} min de intervalo entre uma e outra` : ', uma em seguida da outra'}.
            Quer uma pausa maior no meio do dia? Use &quot;Adicionar outro período&quot; e deixe um espaço entre eles.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={adicionarPeriodo} className="inline-flex items-center gap-2 rounded-xl border border-[#DCC8F0] bg-white px-4 py-2.5 text-[12.5px] font-extrabold text-psi-darkest transition hover:bg-canvas">
            <Plus className="h-4 w-4" /> Adicionar outro período
          </button>
          <button type="button" onClick={() => setDiaADia(true)} className="text-xs font-bold text-muted underline hover:text-psi-deep">
            Atende em horários diferentes em cada dia? Ajustar dia a dia
          </button>
        </div>
      </Passo>

      <Passo id="agenda-passo-3" numero={3} titulo="Bloqueios" opcional descricao="Informe dias ou períodos em que não estará disponível, como férias e folgas.">
        <div className="flex flex-col gap-3 sm:pl-14">{bloqueios}</div>
      </Passo>

      <Passo id="agenda-passo-4" numero={4} titulo="Resumo da sua disponibilidade">
        <div className="grid grid-cols-1 gap-y-4 rounded-2xl bg-[#F7F3FB] px-2 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icone: CalendarDays, rotulo: 'Dias de atendimento', valor: rotuloDias(config.dias) },
            { icone: Clock3, rotulo: 'Horário', valor: rotuloPeriodos(config) },
            { icone: Timer, rotulo: 'Duração da sessão', valor: rotuloDuracao(config.duracaoMin) + (config.intervaloMin > 0 ? ` + ${config.intervaloMin} min de intervalo` : '') },
            { icone: Laptop, rotulo: 'Modalidade', valor: config.modalidade === 'online' ? 'Online' : 'Presencial' },
          ].map(({ icone: Icone, rotulo, valor }, indice) => (
            <div key={rotulo} className={`flex min-w-0 items-start gap-3 px-4 ${indice > 0 ? 'lg:border-l lg:border-[#E6DCF0]' : ''} ${indice % 2 === 1 ? 'sm:border-l sm:border-[#E6DCF0]' : ''}`}>
              <Icone className="h-6 w-6 shrink-0 text-psi-deep" strokeWidth={1.8} />
              <div className="min-w-0">
                <small className="block text-[11px] font-semibold text-muted">{rotulo}</small>
                <strong className="mt-0.5 block text-[12.5px] font-extrabold tabular-nums text-ink">{valor}</strong>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tabular-nums text-muted">
          {config.dias.length === 0
            ? 'Sem nenhum dia marcado, seu link não mostra horários.'
            : horarios.length === 0
              ? 'Com esse período não cabe nenhuma sessão. Aumente o horário de término.'
              : <>O paciente vai ver, em cada dia marcado, {horarios.length} {horarios.length === 1 ? 'horário' : 'horários'}:
                {horarios.map((hora) => <b key={hora} className="rounded-lg border border-psi-soft bg-white px-2 py-0.5 font-extrabold text-psi-darkest">{hora}</b>)}</>}
        </div>
      </Passo>

      <div id="agenda-salvar" className="flex flex-wrap items-center justify-between gap-3.5">
        <div role="status" className={`flex max-w-md flex-1 items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-[12.5px] ${
          erro || aviso?.tipo === 'erro' ? 'border-rose-200 bg-rose-50 font-bold text-rose-700'
            : aviso ? 'border-emerald-200 bg-emerald-50 font-bold text-emerald-800'
              : alterado ? 'border-amber-200 bg-amber-50 font-bold text-amber-900'
                : 'border-line bg-white text-muted'
        }`}>
          {erro || aviso?.tipo === 'erro' ? <AlertCircle className="h-[18px] w-[18px] shrink-0" />
            : aviso ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0" />
              : <Info className="h-[18px] w-[18px] shrink-0" />}
          {erro ?? aviso?.texto ?? (alterado
            ? 'Você tem alterações que ainda não chegaram ao link dos pacientes.'
            : 'Você pode editar sua disponibilidade sempre que precisar.')}
        </div>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando || Boolean(erro) || !alterado}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-[#8F61C2] px-11 py-4 text-[13.5px] font-extrabold text-white shadow-[0_10px_22px_rgba(143,97,194,.3)] transition hover:bg-psi-deep disabled:opacity-50 disabled:shadow-none sm:w-auto"
        >
          <CalendarCheck2 className="h-4 w-4" /> {salvando ? 'Salvando…' : 'Salvar disponibilidade'}
        </button>
      </div>
    </>
  );
}
