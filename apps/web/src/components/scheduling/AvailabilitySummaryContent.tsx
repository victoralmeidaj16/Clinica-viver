import { CalendarDays, Clock3, Laptop, Timer } from 'lucide-react';
import { horariosDoDia, rotuloDias, rotuloDuracao, rotuloPeriodos, type ConfigDisponibilidade } from './availabilityStepsModel';

export function AvailabilitySummaryContent({ config }: { config: ConfigDisponibilidade }) {
  const horarios = horariosDoDia(config);
  return (
    <>
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
            : <>A grade gera, em cada dia marcado, {horarios.length} {horarios.length === 1 ? 'horário' : 'horários'}:
              {horarios.map((hora) => <b key={hora} className="rounded-lg border border-psi-soft bg-white px-2 py-0.5 font-extrabold text-psi-darkest">{hora}</b>)}</>}
      </div>
    </>
  );
}
