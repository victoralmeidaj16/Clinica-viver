-- Adiciona a coluna solicitacao_alteracao_gestao na tabela clinica_cadastros_psicologos
SET @coluna_solicitacao_gestao_existe := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'solicitacao_alteracao_gestao'
);

SET @sql_solicitacao_gestao := IF(
  @coluna_solicitacao_gestao_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN solicitacao_alteracao_gestao JSON NULL AFTER segunda_pos_graduacao_viver_mais',
  'SELECT 1'
);

PREPARE stmt_solicitacao_gestao FROM @sql_solicitacao_gestao;
EXECUTE stmt_solicitacao_gestao;
DEALLOCATE PREPARE stmt_solicitacao_gestao;
