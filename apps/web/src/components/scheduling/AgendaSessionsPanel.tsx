import type { ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { UpcomingSessions, type AgendamentoResumo } from './UpcomingSessions';
import { ProfessionalCalendarView } from './ProfessionalCalendarView';

type SessionProps = ComponentProps<typeof UpcomingSessions>;
interface Props {
  ativa: boolean;
  buscaPaciente: string;
  setBuscaPaciente: (busca: string) => void;
  nomesPacientes: string[];
  agendamentosVisiveis: AgendamentoResumo[];
  cancelarSessao: SessionProps['onCancelar'];
  confirmarRealizacao: SessionProps['onConfirmarRealizacao'];
  registrarFalta: SessionProps['onRegistrarFalta'];
  atualizarVencimento: SessionProps['onAtualizarVencimento'];
  reagendarSessao: SessionProps['onReagendar'];
  carregar: SessionProps['onRecarregar'];
  decidirReagendamento: SessionProps['onDecidirReagendamento'];
}

export function AgendaSessionsPanel({
  ativa, buscaPaciente, setBuscaPaciente, nomesPacientes, agendamentosVisiveis, cancelarSessao,
  confirmarRealizacao, registrarFalta, atualizarVencimento, reagendarSessao, carregar, decidirReagendamento,
}: Props) {
  return (
    <div id="painel-sessoes" role="tabpanel" aria-labelledby="aba-sessoes" hidden={!ativa} className="space-y-6">
      <section className="rounded-2xl border border-psi-soft/60 bg-surface p-4 shadow-card" aria-labelledby="filtro-paciente-agenda">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span id="filtro-paciente-agenda" className="mb-1.5 block text-[10px] font-black uppercase tracking-[.16em] text-muted">
              Buscar sessões por paciente
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-psi-vibrant" />
              <input
                list="agenda-pacientes"
                type="search"
                value={buscaPaciente}
                onChange={(event) => setBuscaPaciente(event.target.value)}
                placeholder="Digite o nome da paciente…"
                className="w-full rounded-xl border border-psi-soft bg-white py-2.5 pl-9 pr-3 text-xs font-medium text-ink placeholder:text-muted focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20"
                aria-label="Buscar sessões pelo nome do paciente"
              />
              <datalist id="agenda-pacientes">
                {nomesPacientes.map((nome) => <option key={nome} value={nome} />)}
              </datalist>
            </span>
          </label>
          {buscaPaciente && (
            <button
              type="button"
              onClick={() => setBuscaPaciente('')}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-muted transition hover:bg-slate-50 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" /> Mostrar todas
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted" aria-live="polite">
          {buscaPaciente.trim()
            ? `${agendamentosVisiveis.length} ${agendamentosVisiveis.length === 1 ? 'sessão encontrada' : 'sessões encontradas'} para “${buscaPaciente.trim()}”.`
            : 'Digite ou selecione um nome para ver somente as sessões dessa paciente.'}
        </p>
      </section>

      <div id="agenda-sessoes">
        <UpcomingSessions
          agendamentos={agendamentosVisiveis}
          filtroPaciente={buscaPaciente}
          onCancelar={cancelarSessao}
          onConfirmarRealizacao={confirmarRealizacao}
          onRegistrarFalta={registrarFalta}
          onAtualizarVencimento={atualizarVencimento}
          onReagendar={reagendarSessao}
          onRecarregar={carregar}
          onDecidirReagendamento={decidirReagendamento}
        />
      </div>

      <div className="mx-auto w-full max-w-4xl pt-4 sm:pt-6">
        <ProfessionalCalendarView appointments={agendamentosVisiveis} />
      </div>
    </div>
  );
}
