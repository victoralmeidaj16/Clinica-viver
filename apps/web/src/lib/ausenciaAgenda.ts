import { FUSO_CLINICA } from './sessionReference';

/**
 * Leitura humana de um período de férias/folga.
 *
 * O `fim` gravado é **exclusivo**: bloquear só o dia 10 grava 10/00:00 até
 * 11/00:00, porque é assim que a sobreposição com agendamentos é calculada. Ao
 * mostrar para uma pessoa isso vira "10", não "10 a 11" — dizer que alguém está
 * de folga num dia em que já voltou é errar em algo que a gestão usa para
 * decidir quem chamar.
 */
export interface PeriodoAusencia {
  inicio: string;
  fim: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: FUSO_CLINICA,
});

/** Dias inteiros cobertos pela ausência; nunca menos de 1. */
export function diasDeAusencia(periodo: PeriodoAusencia): number {
  const duracao = Date.parse(periodo.fim) - Date.parse(periodo.inicio);
  if (!Number.isFinite(duracao) || duracao <= 0) return 1;
  return Math.max(1, Math.round(duracao / DIA_MS));
}

/**
 * A ausência que cobre este instante, se houver.
 *
 * Mesma regra do rodízio (`ausenciaVigente` em `viverMaisRodizio.ts`), aqui em
 * versão de cliente: o card da gestão precisa dizer "está de férias" pelo mesmo
 * critério que tirou a pessoa da fila, ou a tela contradiz a distribuição.
 */
export function ausenciaEmCurso<T extends PeriodoAusencia>(
  ausencias: readonly T[] | undefined,
  agora: Date = new Date()
): T | undefined {
  const instante = agora.getTime();
  return ausencias?.find(
    (ausencia) => Date.parse(ausencia.inicio) <= instante && Date.parse(ausencia.fim) > instante
  );
}

/** "no dia 10/09" ou "de 10/09 a 24/09". */
export function periodoAusencia(periodo: PeriodoAusencia): string {
  const inicio = new Date(periodo.inicio);
  // Um milissegundo antes do fim exclusivo cai sempre no último dia de folga,
  // sem depender de o bloqueio começar à meia-noite.
  const ultimoDia = new Date(Date.parse(periodo.fim) - 1);
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(ultimoDia.getTime())) {
    return 'em período não informado';
  }
  const de = DATA_CURTA.format(inicio);
  const ate = DATA_CURTA.format(ultimoDia);
  return de === ate ? `no dia ${de}` : `de ${de} a ${ate}`;
}
