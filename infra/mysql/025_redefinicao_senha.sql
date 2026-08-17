-- Links de redefinição de senha emitidos pela gestão, com uso único e expiração.

CREATE TABLE IF NOT EXISTS clinica_redefinicoes_senha (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_id CHAR(36) NOT NULL,
  usuario_ref VARCHAR(128) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_em TIMESTAMP(3) NOT NULL,
  utilizado_em TIMESTAMP(3) NULL,
  revogado_em TIMESTAMP(3) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_redefinicoes_senha_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_redefinicoes_senha_organizacao_fk FOREIGN KEY (organizacao_id) REFERENCES clinica_organizacoes(id),
  UNIQUE KEY clinica_redefinicoes_senha_token_uq (instituicao_id, token_hash),
  KEY clinica_redefinicoes_senha_usuario_idx (instituicao_id, usuario_ref, utilizado_em, revogado_em, expira_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
