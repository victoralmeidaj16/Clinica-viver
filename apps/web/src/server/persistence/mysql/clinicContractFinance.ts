import 'server-only';
import type { RowDataPacket } from 'mysql2/promise';
import { dividirSplit7030Centavos, isFinancialEventInPeriod, type FinancialFilter } from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from './mappers';

export async function caixaDosContratos(org: string, filter: FinancialFilter, agora: string) {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(`SELECT f.ref_core,f.criado_em,f.vence_em,f.valor_centavos,f.status,
    r.recebido_em,r.recebido_centavos,r.estornado_centavos,
    (SELECT JSON_ARRAYAGG(JSON_OBJECT('data',DATE_FORMAT(e.estornado_em,'%Y-%m-%dT%H:%i:%s.%fZ'),'valor',e.valor_centavos))
      FROM financeiro_estornos_contratuais e WHERE e.instituicao_id=f.instituicao_id AND e.organizacao_ref=f.organizacao_ref
        AND e.fatura_ref=f.ref_core) AS estornos
    FROM financeiro_faturas_convenio f LEFT JOIN financeiro_recebimentos_contratuais r
      ON r.instituicao_id=f.instituicao_id AND r.organizacao_ref=f.organizacao_ref AND r.fatura_ref=f.ref_core
    WHERE f.instituicao_id=? AND f.organizacao_ref=? AND f.composicao_contratual IS NOT NULL`,[instituicaoId(),org]);
  const total = { recebido:0,receita:0,faturado:0,aberto:0,vencido:0 };
  for (const f of rows) {
    const pago = Number(f.recebido_centavos ?? 0);
    const valor = Number(f.valor_centavos);
    if (f.status !== 'cancelada' && isFinancialEventInPeriod(fromSqlTimestamp(f.criado_em)!,filter)) {
      total.faturado += valor;
      const aberto = f.recebido_em ? 0 : valor;
      total.aberto += aberto;
      if (f.vence_em && Date.parse(fromSqlTimestamp(f.vence_em)!) < Date.parse(agora)) total.vencido += aberto;
    }
    if (f.recebido_em && isFinancialEventInPeriod(fromSqlTimestamp(f.recebido_em)!,filter)) {
      total.recebido += pago;
      total.receita += dividirSplit7030Centavos(pago).receitaClinicaCents;
    }
    let liquido = pago;
    const estornos: {data:string; valor:number}[] = typeof f.estornos === 'string' ? JSON.parse(f.estornos) : f.estornos ?? [];
    for (const e of estornos.sort((a,b) => a.data.localeCompare(b.data))) {
      if (isFinancialEventInPeriod(e.data,filter)) {
        total.recebido -= Number(e.valor);
        total.receita += dividirSplit7030Centavos(liquido-e.valor).receitaClinicaCents - dividirSplit7030Centavos(liquido).receitaClinicaCents;
      }
      liquido -= e.valor;
    }
  }
  return total;
}
