-- Preserva na triagem o endereço confirmado na vitrine. Quando o contato é
-- confirmado, estes dados acompanham a promoção para `clinica_pacientes` e
-- ficam disponíveis para identificação fiscal/NFS-e sem nova digitação.
-- Idempotente para instalações que receberam alguma coluna manualmente.

SET @schema_name = DATABASE();

SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_triagens_pacientes' AND column_name='logradouro'), 'SELECT 1', 'ALTER TABLE clinica_triagens_pacientes ADD COLUMN logradouro VARCHAR(255) NULL AFTER cep');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_triagens_pacientes' AND column_name='complemento'), 'SELECT 1', 'ALTER TABLE clinica_triagens_pacientes ADD COLUMN complemento VARCHAR(120) NULL AFTER numero_residencia');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_triagens_pacientes' AND column_name='bairro'), 'SELECT 1', 'ALTER TABLE clinica_triagens_pacientes ADD COLUMN bairro VARCHAR(120) NULL AFTER complemento');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_triagens_pacientes' AND column_name='cidade'), 'SELECT 1', 'ALTER TABLE clinica_triagens_pacientes ADD COLUMN cidade VARCHAR(120) NULL AFTER bairro');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_triagens_pacientes' AND column_name='estado_uf'), 'SELECT 1', 'ALTER TABLE clinica_triagens_pacientes ADD COLUMN estado_uf CHAR(2) NULL AFTER cidade');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
