-- Credenciais próprias e convites de ativação para psicólogos aprovados.
-- Idempotente e sem alteração dos logins já existentes.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = @schema_name AND table_name = 'clinica_usuarios' AND column_name = 'senha_hash'
  ),
  'SELECT 1',
  'ALTER TABLE clinica_usuarios ADD COLUMN senha_hash VARCHAR(255) NULL AFTER email_normalizado'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = @schema_name AND table_name = 'clinica_usuarios' AND column_name = 'senha_definida_em'
  ),
  'SELECT 1',
  'ALTER TABLE clinica_usuarios ADD COLUMN senha_definida_em TIMESTAMP(3) NULL AFTER senha_hash'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos' AND column_name = 'usuario_ref'
  ),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN usuario_ref VARCHAR(128) NULL AFTER email'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos' AND column_name = 'profissional_ref'
  ),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN profissional_ref VARCHAR(128) NULL AFTER usuario_ref'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos' AND column_name = 'acesso_criado_em'
  ),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN acesso_criado_em TIMESTAMP(3) NULL AFTER profissional_ref'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos' AND column_name = 'boas_vindas_enviada_em'
  ),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN boas_vindas_enviada_em TIMESTAMP(3) NULL AFTER acesso_criado_em'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS clinica_convites_acesso (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_id CHAR(36) NOT NULL,
  cadastro_ref VARCHAR(128) NOT NULL,
  usuario_ref VARCHAR(128) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_em TIMESTAMP(3) NOT NULL,
  utilizado_em TIMESTAMP(3) NULL,
  revogado_em TIMESTAMP(3) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_convites_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_convites_organizacao_fk FOREIGN KEY (organizacao_id) REFERENCES clinica_organizacoes(id),
  UNIQUE KEY clinica_convites_token_uq (instituicao_id, token_hash),
  KEY clinica_convites_usuario_idx (instituicao_id, usuario_ref, utilizado_em, revogado_em, expira_em),
  KEY clinica_convites_cadastro_idx (instituicao_id, cadastro_ref, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
