-- Prova do aceite do Termo de Adesão e Condições de Uso no credenciamento.
-- Guarda data/hora do servidor, IP, navegador, versão e hash SHA-256 do texto
-- aceito. É gravada uma vez e não é sobrescrita pelo upsert do cadastro.
SET @coluna_aceite_termo_existe := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'aceite_termo_adesao'
);

SET @sql_aceite_termo := IF(
  @coluna_aceite_termo_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN aceite_termo_adesao JSON NULL AFTER solicitacao_alteracao_gestao',
  'SELECT 1'
);

PREPARE stmt_aceite_termo FROM @sql_aceite_termo;
EXECUTE stmt_aceite_termo;
DEALLOCATE PREPARE stmt_aceite_termo;
