-- Boletos de convênios precisam ser distinguíveis de transferências bancárias
-- tanto no razão quanto nas telas da gestão e do psicólogo.

ALTER TABLE financeiro_cobrancas
  MODIFY forma_pagamento ENUM('pix','cash','card','boleto','bank_transfer','other') NULL;

ALTER TABLE financeiro_pagamentos
  MODIFY forma ENUM('pix','cash','card','boleto','bank_transfer','other') NOT NULL;

-- Corrige faturas empresariais já liquidadas pelo fluxo de boleto. O vínculo
-- com a fatura e a existência do boleto evitam reclassificar transferências
-- bancárias legítimas feitas fora desse fluxo.
UPDATE financeiro_cobrancas fc
JOIN financeiro_faturas_convenio f
  ON f.instituicao_id = fc.instituicao_id
 AND f.organizacao_ref = fc.organizacao_ref
 AND f.ref_core = fc.fatura_convenio_ref
SET fc.forma_pagamento = 'boleto'
WHERE f.boleto_url IS NOT NULL
  AND fc.status = 'paid'
  AND fc.forma_pagamento = 'bank_transfer';

UPDATE financeiro_pagamentos pg
JOIN financeiro_cobrancas fc
  ON fc.instituicao_id = pg.instituicao_id
 AND fc.organizacao_ref = pg.organizacao_ref
 AND fc.ref_core = pg.cobranca_ref
JOIN financeiro_faturas_convenio f
  ON f.instituicao_id = fc.instituicao_id
 AND f.organizacao_ref = fc.organizacao_ref
 AND f.ref_core = fc.fatura_convenio_ref
SET pg.forma = 'boleto'
WHERE f.boleto_url IS NOT NULL
  AND pg.status = 'confirmed'
  AND pg.forma = 'bank_transfer';
