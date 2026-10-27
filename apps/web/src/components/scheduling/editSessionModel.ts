export interface SessionEditableData {
  id: string;
  versao?: number;
  pacienteNome: string;
  inicio: string;
  fim?: string;
  modalidade?: 'online' | 'presencial' | 'telefone';
  serviceKey?: string;
  status?: string;
  custeadoPelaEmpresa?: boolean;
  convenioNome?: string;
}

export function camposIniciais(session: SessionEditableData) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(session.inicio)).map((p) => [p.type, p.value])
  );
  const dur = session.fim
    ? Math.round((new Date(session.fim).getTime() - new Date(session.inicio).getTime()) / 60_000)
    : 50;
  return {
    data: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}`,
    duracaoMin: dur > 0 ? dur : 50,
    modalidade: session.modalidade ?? 'online',
    status: session.status === 'realizado' || session.status === 'completed'
      ? ('realizado' as const) : session.status === 'confirmado' ? ('confirmado' as const) : ('agendado' as const),
  };
}
