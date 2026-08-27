-- Cadastro fiscal/operacional completo e auditoria sem cópia de valores pessoais.
-- Idempotente para instalações que já receberam alguma coluna manualmente.

SET @schema_name = DATABASE();

SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='cep'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN cep VARCHAR(9) NULL AFTER email');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='logradouro'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN logradouro VARCHAR(255) NULL AFTER cep');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='numero_residencia'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN numero_residencia VARCHAR(32) NULL AFTER logradouro');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='complemento'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN complemento VARCHAR(120) NULL AFTER numero_residencia');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='bairro'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN bairro VARCHAR(120) NULL AFTER complemento');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='cidade'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN cidade VARCHAR(120) NULL AFTER bairro');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='estado_uf'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN estado_uf CHAR(2) NULL AFTER cidade');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='contato_emergencia_nome'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN contato_emergencia_nome VARCHAR(255) NULL AFTER estado_uf');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='contato_emergencia_telefone'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN contato_emergencia_telefone VARCHAR(32) NULL AFTER contato_emergencia_nome');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='observacao_cadastral'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN observacao_cadastral TEXT NULL AFTER contato_emergencia_telefone');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='cadastro_alterado_por'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN cadastro_alterado_por VARCHAR(128) NULL AFTER observacao_cadastral');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='clinica_pacientes' AND column_name='cadastro_alterado_em'), 'SELECT 1', 'ALTER TABLE clinica_pacientes ADD COLUMN cadastro_alterado_em TIMESTAMP(3) NULL AFTER cadastro_alterado_por');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS clinica_pacientes_alteracoes_cadastrais (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  ator_usuario_ref VARCHAR(128) NOT NULL,
  campos_alterados JSON NOT NULL,
  alterado_em TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT clinica_pacientes_alt_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  KEY clinica_pacientes_alt_paciente_idx (instituicao_id, organizacao_ref, paciente_ref, alterado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
