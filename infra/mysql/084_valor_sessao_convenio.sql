-- O preço do contrato é informado pela Gestão. Valores históricos já lançados
-- ficam nas respectivas cobranças. Sessões confirmadas antes do primeiro preço
-- podem aguardar o cadastro sem interromper o registro clínico.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'clinica_convenios' AND column_name = 'valor_sessao_contrato_centavos'),
 'SELECT 1', 'ALTER TABLE clinica_convenios ADD COLUMN valor_sessao_contrato_centavos INT UNSIGNED NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos' AND column_name = 'valor_contrato_pendente'),
 'SELECT 1', 'ALTER TABLE clinica_agendamentos ADD COLUMN valor_contrato_pendente TINYINT(1) NOT NULL DEFAULT 0, ADD INDEX clinica_ag_valor_contrato_idx (instituicao_id, custeio_convenio_ref, valor_contrato_pendente)');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
