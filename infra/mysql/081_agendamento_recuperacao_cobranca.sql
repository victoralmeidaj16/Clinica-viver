SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos' AND column_name = 'cobranca_recuperacao_tentada_em'),
 'SELECT 1', 'ALTER TABLE clinica_agendamentos ADD COLUMN cobranca_recuperacao_tentada_em DATETIME(3) NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
