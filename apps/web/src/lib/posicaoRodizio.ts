export interface PosicaoRodizio {
  /** Posição geral entre profissionais disponíveis; critérios do paciente recortam essa fila. */
  posicao: number | null;
  total: number;
  motivo?: string;
}
