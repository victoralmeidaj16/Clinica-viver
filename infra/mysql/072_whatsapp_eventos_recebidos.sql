-- O alvo de uma resposta fica fixo antes da mutação: reentregas nunca escolhem outro paciente.
-- Não armazena texto recebido nem telefone; somente hashes e referências internas.
CREATE TABLE IF NOT EXISTS clinica_whatsapp_eventos_recebidos (
  instituicao_id CHAR(36) NOT NULL,
  evento_hash CHAR(64) NOT NULL,
  conteudo_hash CHAR(64) NOT NULL,
  psicologo_ref VARCHAR(128) NULL,
  triagem_ref VARCHAR(128) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (instituicao_id, evento_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
