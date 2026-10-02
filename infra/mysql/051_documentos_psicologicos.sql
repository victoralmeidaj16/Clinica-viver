CREATE TABLE IF NOT EXISTS clinica_documentos_psicologicos (
  id CHAR(64) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  conteudo_cifrado MEDIUMTEXT NOT NULL,
  emitido_em TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (id),
  KEY documentos_paciente (instituicao_id, organizacao_ref, paciente_ref, profissional_ref, emitido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
