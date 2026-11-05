-- Data de nascimento do paciente e tipo de alocacao (escolha direta ou rodizio)
-- na triagem.
--
-- O formulario de triagem valida e coleta `dataNascimento`, e o alocador
-- registra `tipoAlocacao` ('ESCOLHA_DIRETA' | 'RODIZIO'), mas a tabela
-- `clinica_triagens_pacientes` nao tinha colunas para guarda-los. Sem elas,
-- a data de nascimento informada pelo paciente se perdia antes da promocao
-- para `clinica_pacientes.data_nascimento`.
--
-- Idempotente: aplicavel a banco novo e a instalacao ja em producao.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'data_nascimento'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN data_nascimento DATE NULL AFTER telefone'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'tipo_alocacao'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN tipo_alocacao VARCHAR(32) NULL AFTER psicologos_ja_tentados'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
