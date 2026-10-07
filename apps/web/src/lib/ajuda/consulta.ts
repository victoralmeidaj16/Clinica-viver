import {
  CalendarOff, CalendarPlus, CheckCircle2, Clock, CreditCard, FileText, Lock,
  MessageCircle, RefreshCw, Save, Share2, Smartphone, UserX, type LucideIcon,
} from 'lucide-react';

/** "Preciso fazer X agora" → onde clicar. `etapa` aponta para `ETAPAS[].id`. */
export interface AtalhoBussola { icone: LucideIcon; situacao: string; onde: string; etapa?: string }

export const BUSSOLA: AtalhoBussola[] = [
  { icone: Smartphone, situacao: 'Chegou paciente novo', onde: 'Link no WhatsApp ou e-mail → **Confirmar primeiro contato**', etapa: 'paciente-novo' },
  { icone: Share2, situacao: 'Passar horários para o paciente escolher', onde: 'Meu Painel ou Agenda → **Copiar** / **Enviar Wpp**', etapa: 'link-agenda' },
  { icone: CalendarPlus, situacao: 'Marcar uma sessão', onde: 'Agenda & Horários → **Agendar sessão**', etapa: 'agendar' },
  { icone: MessageCircle, situacao: 'Lembrar o paciente da sessão', onde: 'Meu Painel → **Lembrar Wpp**', etapa: 'painel' },
  { icone: CheckCircle2, situacao: 'A sessão acabou de terminar', onde: 'Agenda & Horários → **Confirmar que ocorreu**', etapa: 'depois-da-sessao' },
  { icone: FileText, situacao: 'Registrar a evolução', onde: 'Prontuários dos Pacientes → **Registrar Prontuário Manual**', etapa: 'prontuario' },
  { icone: FileText, situacao: 'Emitir uma declaração', onde: 'Meus Pacientes → **Documentos**', etapa: 'documentos' },
  { icone: CreditCard, situacao: 'Ver o que recebi', onde: 'Meu Financeiro → escolher o mês', etapa: 'financeiro' },
  { icone: CalendarOff, situacao: 'Vou tirar férias', onde: 'Agenda & Horários → **Períodos bloqueados**', etapa: 'bloqueios' },
  { icone: UserX, situacao: 'Paciente desistiu', onde: 'Meus Pacientes → **Registrar desistência** no cartão (devolve a vaga ao rodízio)' },
];

export interface Regra { icone: LucideIcon; titulo: string; texto: string }

export const REGRAS_DE_OURO: Regra[] = [
  { icone: Lock, titulo: 'Sigilo absoluto', texto: 'Cada psicólogo vê só os próprios pacientes. Os registros são protegidos conforme CFP e LGPD.' },
  { icone: Clock, titulo: '24 horas para o primeiro contato', texto: 'Paciente novo do rodízio: confirme em até 24 h. Passou do prazo, ele vai para o próximo colega.' },
  { icone: CreditCard, titulo: 'Crédito de 70%', texto: 'Cada sessão paga e confirmada gera 70% de crédito para você, visível em Meu Financeiro.' },
  { icone: RefreshCw, titulo: 'Reagendar e cancelar', texto: 'Ao reagendar, o vencimento da cobrança acompanha o novo horário. Cancelar exige um motivo.' },
  { icone: CheckCircle2, titulo: 'Confirme a sessão', texto: 'Confirmar que ocorreu mantém agenda, prontuário e financeiro em ordem.' },
  { icone: Save, titulo: 'Prontuário no mesmo dia', texto: 'Registrar logo após a sessão evita esquecimentos e protege você.' },
];
