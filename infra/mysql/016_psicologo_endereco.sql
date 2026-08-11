-- Endereço informado no cadastro do psicólogo.
--
-- Cidade e UF já existiam, mas rua/logradouro e bairro eram descartados porque
-- não havia colunas correspondentes. A migration é idempotente para funcionar
-- tanto em instalações novas quanto no banco de produção já inicializado.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'logradouro'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN logradouro VARCHAR(255) NULL AFTER cidade'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'bairro'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN bairro VARCHAR(160) NULL AFTER logradouro'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
