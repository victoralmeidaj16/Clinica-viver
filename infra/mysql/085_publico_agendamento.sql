-- Guarda o público informado para esta reserva. A triagem atual pode ter sido
-- alterada desde uma sessão antiga, por isso não é usada para preencher o passado.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos' AND column_name = 'publico_atendimento'),
 'SELECT 1', 'ALTER TABLE clinica_agendamentos ADD COLUMN publico_atendimento VARCHAR(160) NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
