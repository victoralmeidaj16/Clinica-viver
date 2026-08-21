export const REPORT_TIME_ZONE = 'America/Sao_Paulo';

export type DistributionItem = {
  label: string;
  quantidade: number;
  percentual: number;
};

export type MonthlyIndicators = {
  competencia: string;
  periodo: {
    inicio: string;
    fimExclusivo: string;
    timezone: typeof REPORT_TIME_ZONE;
  };
  filaAtual: {
    total: number;
    alocados: number;
    semProfissional: number;
    pendentesAtribuicao: number;
    aguardandoContato: number;
  };
  leadsDoMes: {
    total: number;
    genero: DistributionItem[];
    faixaEtaria: DistributionItem[];
    origens: DistributionItem[];
    modalidades: DistributionItem[];
  };
  sla24h: {
    cumpridos: number;
    violados: number;
    emAndamento: number;
    semAlocacao: number;
    avaliados: number;
    percentual: number | null;
  };
  sessoes: {
    realizadas: number;
    agendadas: number;
    confirmadas: number;
    emAndamento: number;
    canceladas: number;
    faltas: number;
    total: number;
    realizadasMesAnterior: number;
    variacaoRealizadasPercentual: number | null;
  };
  auditoria: {
    total: number;
    acessosConcedidos: number;
    acessosNegados: number;
    porAcao: DistributionItem[];
    primeiroEventoEm: string | null;
    historicoPodeEstarIncompleto: boolean;
  };
  indisponiveis: Array<{
    indicador: 'ticket_medio' | 'cac' | 'convenios_pj';
    titulo: string;
    motivo: string;
  }>;
};

export function competenciaAtual(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}
