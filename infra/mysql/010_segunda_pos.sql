SET @coluna_segunda_pos_existe := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'segunda_pos_graduacao_viver_mais'
);

SET @sql_segunda_pos := IF(
  @coluna_segunda_pos_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN segunda_pos_graduacao_viver_mais VARCHAR(255) NULL AFTER pos_graduacao_viver_mais',
  'SELECT 1'
);

PREPARE stmt_segunda_pos FROM @sql_segunda_pos;
EXECUTE stmt_segunda_pos;
DEALLOCATE PREPARE stmt_segunda_pos;
