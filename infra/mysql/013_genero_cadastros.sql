-- Gênero informado nos cadastros de paciente e psicólogo.
-- Mantém colunas opcionais para preservar registros anteriores.

SET @psi_genero_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'genero'
);
SET @sql_psi_genero := IF(
  @psi_genero_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN genero VARCHAR(16) NULL AFTER cidade',
  'SELECT 1'
);
PREPARE stmt_psi_genero FROM @sql_psi_genero;
EXECUTE stmt_psi_genero;
DEALLOCATE PREPARE stmt_psi_genero;

SET @psi_genero_outro_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'genero_outro'
);
SET @sql_psi_genero_outro := IF(
  @psi_genero_outro_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN genero_outro VARCHAR(120) NULL AFTER genero',
  'SELECT 1'
);
PREPARE stmt_psi_genero_outro FROM @sql_psi_genero_outro;
EXECUTE stmt_psi_genero_outro;
DEALLOCATE PREPARE stmt_psi_genero_outro;

SET @triagem_genero_outro_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_triagens_pacientes'
     AND column_name = 'genero_outro'
);
SET @sql_triagem_genero_outro := IF(
  @triagem_genero_outro_existe = 0,
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN genero_outro VARCHAR(120) NULL AFTER genero',
  'SELECT 1'
);
PREPARE stmt_triagem_genero_outro FROM @sql_triagem_genero_outro;
EXECUTE stmt_triagem_genero_outro;
DEALLOCATE PREPARE stmt_triagem_genero_outro;
