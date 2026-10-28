-- Preserva o vencimento escolhido mesmo quando a primeira emissão da cobrança falha.
SET @schema_name = DATABASE();
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_agendamentos' AND column_name = 'cobranca_vence_em'),
  'SELECT 1',
  'ALTER TABLE clinica_agendamentos ADD COLUMN cobranca_vence_em DATETIME(3) NULL AFTER valor_centavos'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
