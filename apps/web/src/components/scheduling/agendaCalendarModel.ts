import type { BloqueioAgenda } from './AgendaBlocks';
import type { JanelaEditavel } from './AvailabilityEditor';
import type { AgendamentoResumo } from './UpcomingSessions';

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const FUSO_CLINICA = 'America/Sao_Paulo';

export interface SlotDoDia {
  horaInicio: string;
  horaFim: string;
  inicio: string;
  fim: string;
  modalidade: JanelaEditavel['modalidade'];
}

export function formatMonthYear(ano: number, mes: number): string {
  return new Date(Date.UTC(ano, mes, 1)).toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function monthCells(ano: number, mes: number): Array<string | null> {
  const vazios = Array.from({ length: new Date(Date.UTC(ano, mes, 1)).getUTCDay() }, () => null);
  const total = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return [...vazios, ...Array.from({ length: total }, (_, indice) =>
    `${ano}-${String(mes + 1).padStart(2, '0')}-${String(indice + 1).padStart(2, '0')}`
  )];
}

export function dataLocal(valor: string | number): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO_CLINICA,
  }).format(new Date(valor));
}

export function horaLocal(valor: string | number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSO_CLINICA,
  }).format(new Date(valor));
}

export function blocosDaData(blocos: readonly BloqueioAgenda[], data: string) {
  return blocos.filter((bloco) =>
    dataLocal(bloco.inicio) <= data && dataLocal(Date.parse(bloco.fim) - 1) >= data
  );
}

export function sessoesDaData(sessoes: readonly AgendamentoResumo[], data: string) {
  return sessoes.filter((sessao) => sessao.status !== 'cancelado' && dataLocal(sessao.inicio) === data);
}

export function colide(inicio: string, fim: string, intervalo: { inicio: string; fim: string }) {
  return Date.parse(inicio) < Date.parse(intervalo.fim) && Date.parse(fim) > Date.parse(intervalo.inicio);
}

function horaPorMinutos(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function isoLocal(data: string, hora: string): string {
  return new Date(`${data}T${hora}:00-03:00`).toISOString();
}

export function slotsDaData(data: string, janelas: readonly JanelaEditavel[]): SlotDoDia[] {
  return janelas.flatMap((janela) => {
    const inicio = minutos(janela.horaInicio);
    const fim = minutos(janela.horaFim);
    const slots: SlotDoDia[] = [];
    for (let atual = inicio; atual + janela.duracaoMin <= fim; atual += janela.duracaoMin) {
      const horaInicio = horaPorMinutos(atual);
      const horaFim = horaPorMinutos(atual + janela.duracaoMin);
      slots.push({
        horaInicio, horaFim, inicio: isoLocal(data, horaInicio), fim: isoLocal(data, horaFim),
        modalidade: janela.modalidade,
      });
    }
    return slots;
  }).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function dataPorExtenso(data: string): string {
  return new Date(`${data}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
