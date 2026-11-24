import 'server-only';

export const saldoAbertoSql = `c.valor_centavos
  - COALESCE((SELECT SUM(pg.valor_centavos) FROM financeiro_pagamentos pg WHERE pg.instituicao_id=c.instituicao_id
      AND pg.organizacao_ref=c.organizacao_ref AND pg.cobranca_ref=c.ref_core AND pg.status='confirmed'),0)
  - COALESCE((SELECT SUM(d.valor_centavos) FROM financeiro_descontos d WHERE d.instituicao_id=c.instituicao_id
      AND d.organizacao_ref=c.organizacao_ref AND d.cobranca_ref=c.ref_core),0)`;
