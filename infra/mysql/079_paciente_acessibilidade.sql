-- Necessidades de acessibilidade informadas pelo paciente ou pela equipe.
SET @coluna_acessibilidade_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_pacientes'
     AND column_name = 'acessibilidade'
);
SET @sql := IF(@coluna_acessibilidade_existe = 0,
  'ALTER TABLE clinica_pacientes ADD COLUMN acessibilidade JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
