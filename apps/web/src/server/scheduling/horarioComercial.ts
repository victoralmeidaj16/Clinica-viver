import { FUSO_CLINICA } from '@thats-life/core';

/**
 * Horário comercial da clínica, para avisos que não precisam sair de madrugada.
 *
 * Quem marca às 23h pelo link não deve acordar com o WhatsApp: a confirmação
 * espera a abertura do expediente. Configurável por ambiente, com o padrão de
 * segunda a sexta, das 08:00 às 18:00, no fuso da clínica.
 *
 *   AGENDA_AVISOS_DIAS    dias da semana, 0 = domingo  (padrão "1,2,3,4,5")
 *   AGENDA_AVISOS_INICIO  abertura, HH:MM               (padrão "08:00")
 *   AGENDA_AVISOS_FIM     fechamento, HH:MM, exclusivo  (padrão "18:00")
 *
 * Feriados não entram: o aviso de um feriado sai no horário de um dia comum.
 */

export interface HorarioComercial {
  dias: number[];
  inicioMin: number;
  fimMin: number;
}

const PADRAO: HorarioComercial = { dias: [1, 2, 3, 4, 5], inicioMin: 8 * 60, fimMin: 18 * 60 };

function minutos(valor: string | undefined): number | null {
  const casou = /^(\d{1,2}):(\d{2})$/.exec(valor?.trim() ?? '');
  if (!casou) return null;
  const total = Number(casou[1]) * 60 + Number(casou[2]);
  return Number(casou[2]) < 60 && total <= 24 * 60 ? total : null;
}

/** Configuração inválida cai no padrão em vez de calar os avisos. */
export function horarioComercialConfigurado(env: Record<string, string | undefined> = process.env): HorarioComercial {
  const dias = (env.AGENDA_AVISOS_DIAS ?? '')
    .split(',')
    .map((dia) => Number.parseInt(dia, 10))
    .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6);
  const inicioMin = minutos(env.AGENDA_AVISOS_INICIO) ?? PADRAO.inicioMin;
  const fimMin = minutos(env.AGENDA_AVISOS_FIM) ?? PADRAO.fimMin;
  if (fimMin <= inicioMin) return PADRAO;
  return { dias: dias.length > 0 ? [...new Set(dias)] : PADRAO.dias, inicioMin, fimMin };
}

/** Relógio de parede da clínica, lido como se fosse UTC. */
function paredeDaClinica(instante: Date): { ms: number; diaSemana: number; minutoDoDia: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO_CLINICA,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instante)
      .map((parte) => [parte.type, Number(parte.value)])
  );
  const ms = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute, partes.second);
  return {
    ms: ms + instante.getUTCMilliseconds(),
    diaSemana: new Date(ms).getUTCDay(),
    minutoDoDia: partes.hour * 60 + partes.minute,
  };
}

/**
 * `null` quando `agora` está dentro do expediente; senão, o instante da próxima
 * abertura. O deslocamento do fuso é o de `agora` — o Brasil não tem horário de
 * verão desde 2019, então ele vale também para a abertura seguinte.
 */
export function proximaAberturaComercial(
  agora: Date,
  horario: HorarioComercial = horarioComercialConfigurado()
): Date | null {
  const parede = paredeDaClinica(agora);
  const dentro =
    horario.dias.includes(parede.diaSemana) &&
    parede.minutoDoDia >= horario.inicioMin &&
    parede.minutoDoDia < horario.fimMin;
  if (dentro) return null;

  const deslocamento = parede.ms - agora.getTime();
  const meiaNoite = parede.ms - (parede.ms % 86_400_000);
  for (let dias = 0; dias <= 7; dias += 1) {
    if (!horario.dias.includes((parede.diaSemana + dias) % 7)) continue;
    if (dias === 0 && parede.minutoDoDia >= horario.inicioMin) continue;
    return new Date(meiaNoite + dias * 86_400_000 + horario.inicioMin * 60_000 - deslocamento);
  }
  return null;
}
