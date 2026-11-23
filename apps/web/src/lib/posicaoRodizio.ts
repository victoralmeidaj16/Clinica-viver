export interface PosicaoRodizio {
  /** Posição geral entre profissionais disponíveis; critérios do paciente recortam essa fila. */
  posicao: number | null;
  total: number;
  /** Empate absoluto com outro profissional: a vez entre eles é sorteada. */
  empate?: boolean;
  motivo?: string;
}
