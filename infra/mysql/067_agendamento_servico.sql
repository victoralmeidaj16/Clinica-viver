-- Identifica o serviço escolhido no agendamento para restringir a edição da duração.
SET @schema_name = DATABASE();
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_agendamentos' AND column_name = 'servico_key'),
  'SELECT 1',
  'ALTER TABLE clinica_agendamentos ADD COLUMN servico_key VARCHAR(80) NULL AFTER modalidade'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
