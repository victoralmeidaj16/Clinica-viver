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
}

export const INITIAL_PATIENTS: Paciente[] = [
  {
    id: 'pac_01',
    nome: 'Mariana Silva de Oliveira',
    email: 'mariana.silva@email.com',
    telefone: '(11) 98765-4321',
    dataNascimento: '1995-04-12',
    dataInicioTratamento: '2025-10-15',
    status: 'ativo',
    ultimaSessao: '2026-07-29',
    proximaSessao: '2026-08-05 às 14:00',
    planoAtendimento: 'Terapia Cognitivo-Comportamental (Ansiedade & Rotina)',
    historicoSessoesCount: 18,
    tarefasAtivasCount: 3,
  },
  {
    id: 'pac_02',
    nome: 'Lucas Ramos Oliveira',
    email: 'lucas.ramos@email.com',
    telefone: '(11) 97654-3210',
    dataNascimento: '1988-11-23',
    dataInicioTratamento: '2026-01-10',
    status: 'ativo',
    ultimaSessao: '2026-07-28',
    proximaSessao: '2026-08-04 às 16:30',
    planoAtendimento: 'Existencialismo Clínico (Transição de Carreira)',
    historicoSessoesCount: 12,
    tarefasAtivasCount: 2,
  },
  {
    id: 'pac_03',
    nome: 'Beatriz Santos Guimarães',
    email: 'beatriz.santos@email.com',
    telefone: '(21) 99887-6655',
    dataNascimento: '2001-08-05',
    dataInicioTratamento: '2026-03-20',
    status: 'ativo',
    ultimaSessao: '2026-07-27',
    proximaSessao: '2026-08-03 às 10:00',
    planoAtendimento: 'Psicodrama & Regulação Emocional',
    historicoSessoesCount: 9,
    tarefasAtivasCount: 4,
  },
  {
    id: 'pac_04',
    nome: 'Rodrigo Costa Ferreira',
    email: 'rodrigo.costa@email.com',
    telefone: '(31) 98443-2211',
    dataNascimento: '1992-02-18',
    dataInicioTratamento: '2025-06-01',
    status: 'em_pausa',
    ultimaSessao: '2026-06-15',
    proximaSessao: 'Sem agendamento',
    planoAtendimento: 'Gestão de Burnout & Liderança',
    historicoSessoesCount: 24,
    tarefasAtivasCount: 0,
  },
];
