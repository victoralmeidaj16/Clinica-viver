export interface Paciente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  dataInicioTratamento: string;
  status: 'ativo' | 'em_pausa' | 'concluido';
  ultimaSessao: string;
  proximaSessao: string;
  planoAtendimento: string;
  historicoSessoesCount: number;
  tarefasAtivasCount: number;
  valorSessao: string;
}

export const INITIAL_PATIENTS: Paciente[] = [];
