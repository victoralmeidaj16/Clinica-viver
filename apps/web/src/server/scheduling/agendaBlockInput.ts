import { instanteLocal } from '@thats-life/core';

export interface IntervaloBloqueio {
  inicio: string;
  fim: string;
  motivo?: string;
  tipo: 'dia' | 'horario';
}

export type ResultadoIntervaloBloqueio =
  | { ok: true; intervalo: IntervaloBloqueio }
  | { ok: false; mensagem: string };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function dataValida(valor: string): boolean {
  return DATA.test(valor) && new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) === valor;
}

function diaSeguinte(data: string): string {
  return new Date(Date.parse(`${data}T12:00:00Z`) + 24 * 60 * 60_000).toISOString().slice(0, 10);
}

export function parseAgendaBlockInput(body: Record<string, unknown>, agora: Date = new Date()): ResultadoIntervaloBloqueio {
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() || undefined : undefined;
  const bloqueioPorHorario = body.tipo === 'horario' || body.data !== undefined;

  if (bloqueioPorHorario) {
    const data = String(body.data ?? '');
    const horaInicio = String(body.horaInicio ?? '');
    const horaFim = String(body.horaFim ?? '');
    if (!dataValida(data)) return { ok: false, mensagem: 'Informe uma data válida para o bloqueio.' };
    if (!HORA.test(horaInicio) || !HORA.test(horaFim)) {
      return { ok: false, mensagem: 'Informe os horários inicial e final.' };
    }
    if (horaFim <= horaInicio) {
      return { ok: false, mensagem: 'O horário final deve ser posterior ao inicial.' };
    }
    const inicio = new Date(instanteLocal(data, horaInicio)).toISOString();
    const fim = new Date(instanteLocal(data, horaFim)).toISOString();
    if (Date.parse(fim) <= agora.getTime()) {
      return { ok: false, mensagem: 'Escolha um horário futuro para o bloqueio.' };
    }
    return {
      ok: true,
      intervalo: {
        inicio,
        fim,
        motivo,
        tipo: 'horario',
      },
    };
  }

  const inicioDia = String(body.inicioDia ?? '');
  const fimDia = String(body.fimDia ?? inicioDia);
  if (!dataValida(inicioDia) || !dataValida(fimDia)) {
    return { ok: false, mensagem: 'Informe as datas do bloqueio.' };
  }
  if (fimDia < inicioDia) {
    return { ok: false, mensagem: 'A data final não pode ser anterior à inicial.' };
  }
  const inicio = new Date(instanteLocal(inicioDia, '00:00')).toISOString();
  const fim = new Date(instanteLocal(diaSeguinte(fimDia), '00:00')).toISOString();
  if (Date.parse(fim) <= agora.getTime()) {
    return { ok: false, mensagem: 'Escolha uma data futura para o bloqueio.' };
  }
  return {
    ok: true,
    intervalo: {
      inicio,
      fim,
      motivo,
      tipo: 'dia',
    },
  };
}
