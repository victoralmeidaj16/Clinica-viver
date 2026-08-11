-- Migração para bancos que já receberam 004_clinica.sql antes da separação
-- entre nome de template e corpo da mensagem.
--
-- Instalação nova já nasce com a coluna, vinda do 004. A guarda existe porque
-- o runner aplica todos os arquivos em sequência: sem ela, um banco novo
-- morreria aqui com o erro 1060 (Duplicate column name) e nenhuma das
-- migrações seguintes seria aplicada.

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'clinica_mensagens'
       AND column_name = 'conteudo'
  ),
  'SELECT 1',
  'ALTER TABLE clinica_mensagens ADD COLUMN conteudo TEXT NULL AFTER template'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
