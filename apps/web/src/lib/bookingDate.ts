export function rotuloDataAgendamento(inicio: string): string {
  return new Date(inicio).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo',
  });
}
