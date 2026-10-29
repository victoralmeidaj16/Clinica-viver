-- Dados do tomador conhecido no momento de gerar o boleto; faturas antigas
-- ficam sem confirmação automática porque o cadastro pode ter mudado.
SET @existe := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'financeiro_faturas_convenio' AND column_name = 'tomador_cnpj');
SET @ddl := IF(@existe = 0, 'ALTER TABLE financeiro_faturas_convenio ADD COLUMN tomador_cnpj CHAR(14) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @existe := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'financeiro_faturas_convenio' AND column_name = 'tomador_nome');
SET @ddl := IF(@existe = 0, 'ALTER TABLE financeiro_faturas_convenio ADD COLUMN tomador_nome VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @existe := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'financeiro_faturas_convenio' AND column_name = 'tomador_email');
SET @ddl := IF(@existe = 0, 'ALTER TABLE financeiro_faturas_convenio ADD COLUMN tomador_email VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
