-- Guarda o pagador empresarial junto da cobrança. Faturas existentes são
-- fonte comprovada; cobranças sem fatura não têm histórico suficiente.
SET @existe := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'financeiro_cobrancas' AND column_name = 'convenio_ref');
SET @ddl := IF(@existe = 0,
 'ALTER TABLE financeiro_cobrancas ADD COLUMN convenio_ref VARCHAR(128) NULL AFTER fatura_convenio_ref',
 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @transferencia_existe := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos' AND column_name = 'transferencia_convenio_ref');
SET @ddl_transferencia := IF(@transferencia_existe = 0,
 'ALTER TABLE clinica_agendamentos ADD COLUMN transferencia_convenio_ref VARCHAR(128) NULL',
 'SELECT 1');
PREPARE stmt_transferencia FROM @ddl_transferencia;
EXECUTE stmt_transferencia;
DEALLOCATE PREPARE stmt_transferencia;

ALTER TABLE financeiro_faturas_convenio
 MODIFY COLUMN status ENUM('aberta','boleto_gerado','paga','cancelada','revisao_estorno','revisao_pagamento') NOT NULL DEFAULT 'aberta';

SET @valor_divergente_existe := (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'financeiro_faturas_convenio' AND column_name = 'valor_recebido_divergente_centavos');
SET @ddl_divergente := IF(@valor_divergente_existe = 0,
 'ALTER TABLE financeiro_faturas_convenio ADD COLUMN valor_recebido_divergente_centavos BIGINT NULL',
 'SELECT 1');
PREPARE stmt_divergente FROM @ddl_divergente;
EXECUTE stmt_divergente;
DEALLOCATE PREPARE stmt_divergente;

SET @ambiente_no_indice := (SELECT COUNT(*) FROM information_schema.statistics
 WHERE table_schema = DATABASE() AND table_name = 'fiscal_nfse_emissoes'
 AND index_name = 'fiscal_nfse_emissoes_cobranca_uq' AND column_name = 'ambiente');
SET @ddl_fiscal := IF(@ambiente_no_indice = 0,
 'ALTER TABLE fiscal_nfse_emissoes DROP INDEX fiscal_nfse_emissoes_cobranca_uq, ADD UNIQUE KEY fiscal_nfse_emissoes_cobranca_uq (instituicao_id, organizacao_ref, cobranca_ref, ambiente)',
 'SELECT 1');
PREPARE stmt_fiscal FROM @ddl_fiscal;
EXECUTE stmt_fiscal;
DEALLOCATE PREPARE stmt_fiscal;

UPDATE financeiro_cobrancas c
JOIN financeiro_faturas_convenio f ON f.instituicao_id = c.instituicao_id
 AND f.organizacao_ref = c.organizacao_ref AND f.ref_core = c.fatura_convenio_ref
SET c.convenio_ref = f.convenio_ref
WHERE c.convenio_ref IS NULL;
