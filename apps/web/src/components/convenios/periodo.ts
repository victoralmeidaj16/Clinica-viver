export interface PeriodoFaturamento {
  inicio: string;
  fim: string;
}

const localDate = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

/**
 * Do primeiro dia do mês corrente até hoje.
 *
 * O período mora na página, e não no formulário, porque o painel é desmontado
 * enquanto o detalhe recarrega: guardado lá dentro, ele voltava para o mês
 * corrente exatamente quando o usuário acabava de aplicar outro mês, e o
 * fechamento da fatura seguia com datas diferentes das que estavam na tela.
 */
export function periodoPadrao(hoje: Date = new Date()): PeriodoFaturamento {
  return {
    inicio: localDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: localDate(hoje),
  };
}
