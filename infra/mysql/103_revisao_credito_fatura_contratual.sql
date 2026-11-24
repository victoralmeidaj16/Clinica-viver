CREATE OR REPLACE VIEW financeiro_eventos_revisao_credito AS
SELECT r.instituicao_id,r.organizacao_ref,r.ref_core AS evento,p.cobranca_ref,p.ref_core AS pagamento_ref
  FROM financeiro_estornos r JOIN financeiro_pagamentos p ON p.instituicao_id=r.instituicao_id
    AND p.organizacao_ref=r.organizacao_ref AND p.ref_core=r.pagamento_ref
UNION
SELECT w.instituicao_id,p.organizacao_ref,CONCAT('contestacao-',SHA2(w.provedor_pagamento_ref,256)),p.cobranca_ref,p.ref_core
  FROM financeiro_webhooks_asaas w JOIN financeiro_pagamentos p ON p.instituicao_id=w.instituicao_id AND p.provedor='asaas'
    AND (p.provedor_transacao_ref=w.provedor_pagamento_ref OR
      LEFT(p.provedor_transacao_ref,CHAR_LENGTH(w.provedor_pagamento_ref)+1)=CONCAT(w.provedor_pagamento_ref,':'))
 WHERE w.evento_tipo IN ('PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL')
UNION
SELECT e.instituicao_id,e.organizacao_ref,CONCAT('estorno-contrato-',SHA2(e.evento_ref,256)),c.ref_core,NULL
  FROM financeiro_estornos_contratuais e JOIN financeiro_cobrancas c ON c.instituicao_id=e.instituicao_id
    AND c.organizacao_ref=e.organizacao_ref AND c.fatura_convenio_ref=e.fatura_ref
UNION
SELECT r.instituicao_id,r.organizacao_ref,CONCAT('contestacao-',SHA2(r.pagamento_ref,256)),c.ref_core,NULL
  FROM financeiro_recebimentos_contratuais r JOIN financeiro_cobrancas c ON c.instituicao_id=r.instituicao_id
    AND c.organizacao_ref=r.organizacao_ref AND c.fatura_convenio_ref=r.fatura_ref
  JOIN financeiro_webhooks_asaas w ON w.instituicao_id=r.instituicao_id AND w.provedor_pagamento_ref=r.pagamento_ref
 WHERE w.evento_tipo IN ('PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL');
