-- Permite fechar nova fatura na mesma competência quando uma fatura anterior
-- parcial já teve boleto emitido ou pago, e indexa o pagador histórico das cobranças.
SET @fatura_comp_idx_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'financeiro_faturas_convenio'
     AND index_name = 'financeiro_faturas_convenio_competencia_idx'
);
SET @ddl_fatura_comp_idx := IF(
  @fatura_comp_idx_existe = 0,
  'CREATE INDEX financeiro_faturas_convenio_competencia_idx ON financeiro_faturas_convenio (instituicao_id, organizacao_ref, convenio_ref, competencia)',
  'SELECT 1'
);
PREPARE stmt_fatura_comp_idx FROM @ddl_fatura_comp_idx;
EXECUTE stmt_fatura_comp_idx;
DEALLOCATE PREPARE stmt_fatura_comp_idx;

SET @fatura_comp_uq_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'financeiro_faturas_convenio'
     AND index_name = 'financeiro_faturas_convenio_competencia_uq'
);
SET @ddl_fatura_comp_uq := IF(
  @fatura_comp_uq_existe > 0,
  'ALTER TABLE financeiro_faturas_convenio DROP INDEX financeiro_faturas_convenio_competencia_uq',
  'SELECT 1'
);
PREPARE stmt_fatura_comp_uq FROM @ddl_fatura_comp_uq;
EXECUTE stmt_fatura_comp_uq;
DEALLOCATE PREPARE stmt_fatura_comp_uq;

SET @cobranca_convenio_idx_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'financeiro_cobrancas'
     AND index_name = 'financeiro_cobrancas_convenio_idx'
);
SET @ddl_cobranca_convenio_idx := IF(
  @cobranca_convenio_idx_existe = 0,
  'CREATE INDEX financeiro_cobrancas_convenio_idx ON financeiro_cobrancas (instituicao_id, organizacao_ref, convenio_ref, paciente_ref)',
  'SELECT 1'
);
PREPARE stmt_cobranca_convenio_idx FROM @ddl_cobranca_convenio_idx;
EXECUTE stmt_cobranca_convenio_idx;
DEALLOCATE PREPARE stmt_cobranca_convenio_idx;
