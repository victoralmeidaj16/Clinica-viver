-- Ampliação do tamanho da coluna genero em clinica_cadastros_psicologos para comportar novas opções como PREFIRO_NAO_INFORMAR (20 caracteres)

SET @psi_genero_len := (
  SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'genero'
);

SET @sql_psi_genero_mod := IF(
  @psi_genero_len IS NOT NULL AND @psi_genero_len < 32,
  'ALTER TABLE clinica_cadastros_psicologos MODIFY COLUMN genero VARCHAR(32) NULL',
  'SELECT 1'
);

PREPARE stmt_psi_genero_mod FROM @sql_psi_genero_mod;
EXECUTE stmt_psi_genero_mod;
DEALLOCATE PREPARE stmt_psi_genero_mod;
