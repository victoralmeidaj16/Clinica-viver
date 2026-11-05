-- A troca de pós exige nova seleção de públicos e serviços pelo profissional.
SET @coluna_reconfiguracao_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'reconfiguracao_atendimento_pendente'
);
SET @sql := IF(@coluna_reconfiguracao_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN reconfiguracao_atendimento_pendente TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
