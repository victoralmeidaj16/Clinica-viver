/**
 * Da grade semanal declarada pelo profissional aos horários que o paciente vê.
 *
 * Vive no core, e não junto do SQL, porque é a única parte do fluxo de
 * marcação que tem regra de verdade: tudo o mais é leitura de tabela. O que se
 * decide aqui — o que é passado, o que colide, o que sobra de uma janela que
 * não fecha em múltiplo da duração — é o que o paciente enxerga como agenda.
 */

/** Sem horário de verão desde 2019, o Brasil tem offset fixo. */
export const FUSO_CLINICA = 'America/Sao_Paulo';
const OFFSET_CLINICA = '-03:00';

/** Antecedência mínima entre a marcação e a sessão. */
export const ANTECEDENCIA_MINIMA_MIN = 120;

export interface JanelaDisponibilidade {
  /** 0=domingo … 6=sábado, como grava `clinica_disponibilidades`. */
  diaSemana: number;
  /** `HH:MM` no fuso da clínica. */
  horaInicio: string;
  horaFim: string;
  duracaoMin: number;
  modalidade: 'presencial' | 'online';
  /** `YYYY-MM-DD`; ausente significa janela sem data de corte. */
  vigenciaInicio?: string;
  vigenciaFim?: string;
}

export interface IntervaloOcupado {
  /** Epoch em ms. */
  inicio: number;
  fim: number;
}

export interface Slot {
  /** ISO em UTC — o mesmo instante que vai para o banco. */
  inicio: string;
  fim: string;
  /** `YYYY-MM-DD` no fuso da clínica, para agrupar por dia na tela. */
  dia: string;
  /** `HH:MM` no fuso da clínica, que é o rótulo do botão. */
  hora: string;
  modalidade: 'presencial' | 'online';
}

/** Instante absoluto de uma data e hora locais da clínica. */
export function instanteLocal(dia: string, hora: string): number {
  return Date.parse(`${dia}T${hora}:00${OFFSET_CLINICA}`);
}

/** `YYYY-MM-DD` do dia da clínica em que o instante cai. */
export function diaLocal(instante: number): string {
  return new Date(instante - 3 * 60 * 60_000).toISOString().slice(0, 10);
}

/** `HH:MM` local da clínica. */
export function horaLocal(instante: number): string {
  return new Date(instante - 3 * 60 * 60_000).toISOString().slice(11, 16);
}

function diaSemanaLocal(dia: string): number {
  return new Date(`${dia}T12:00:00${OFFSET_CLINICA}`).getUTCDay();
}

function proximoDia(dia: string): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + 24 * 60 * 60_000).toISOString().slice(0, 10);
}

function vigente(janela: JanelaDisponibilidade, dia: string): boolean {
  if (janela.vigenciaInicio && dia < janela.vigenciaInicio) return false;
  if (janela.vigenciaFim && dia > janela.vigenciaFim) return false;
  return true;
}

function colide(inicio: number, fim: number, ocupados: readonly IntervaloOcupado[]): boolean {
  return ocupados.some((item) => item.inicio < fim && item.fim > inicio);
}

/**
 * Horários livres entre dois instantes.
 *
 * O corte por `agora + antecedência` é deliberado e não configurável pelo
 * paciente: sem ele, o link permitiria marcar para daqui a dez minutos, e o
 * profissional descobriria a sessão quando ela já tivesse começado.
 *
 * Uma janela que não fecha em múltiplo da duração perde o resto — 08:00–09:30
 * com 50 minutos oferece 08:00 e nada mais. Oferecer um slot de 40 minutos
 * seria vender uma sessão mais curta do que a combinada.
 */
export function gerarSlots(
  janelas: readonly JanelaDisponibilidade[],
  ocupados: readonly IntervaloOcupado[],
  de: Date,
  ate: Date,
  agora: Date = new Date()
): Slot[] {
  if (janelas.length === 0) return [];

  const limiteInferior = Math.max(
    de.getTime(),
    agora.getTime() + ANTECEDENCIA_MINIMA_MIN * 60_000
  );
  const limiteSuperior = ate.getTime();
  if (limiteInferior >= limiteSuperior) return [];

  const slots: Slot[] = [];
  const ultimoDia = diaLocal(limiteSuperior);

  for (let dia = diaLocal(limiteInferior); dia <= ultimoDia; dia = proximoDia(dia)) {
    const diaSemana = diaSemanaLocal(dia);
    for (const janela of janelas) {
      if (janela.diaSemana !== diaSemana || !vigente(janela, dia)) continue;
      const duracaoMs = Math.max(1, janela.duracaoMin) * 60_000;
      const abertura = instanteLocal(dia, janela.horaInicio);
      const fechamento = instanteLocal(dia, janela.horaFim);

      for (let inicio = abertura; inicio + duracaoMs <= fechamento; inicio += duracaoMs) {
        const fim = inicio + duracaoMs;
        if (inicio < limiteInferior || inicio >= limiteSuperior) continue;
        if (colide(inicio, fim, ocupados)) continue;
        slots.push({
          inicio: new Date(inicio).toISOString(),
          fim: new Date(fim).toISOString(),
          dia: diaLocal(inicio),
          hora: horaLocal(inicio),
          modalidade: janela.modalidade,
        });
      }
    }
  }

  return slots.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Primeiro nome, para confirmar a identificação sem exibir o cadastro inteiro. */
export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto.trim();
}
