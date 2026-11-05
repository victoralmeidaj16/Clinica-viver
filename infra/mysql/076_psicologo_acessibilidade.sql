-- Necessidades de acessibilidade do próprio profissional; informação interna da clínica.
SET @coluna_acessibilidade_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'acessibilidade'
);
SET @sql := IF(@coluna_acessibilidade_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN acessibilidade JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
