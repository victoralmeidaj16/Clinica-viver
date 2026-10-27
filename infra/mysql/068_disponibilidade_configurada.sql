SET @schema_name = DATABASE();
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_profissionais' AND column_name = 'disponibilidade_configurada'),
  'SELECT 1',
  'ALTER TABLE clinica_profissionais ADD COLUMN disponibilidade_configurada TINYINT(1) NOT NULL DEFAULT 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
