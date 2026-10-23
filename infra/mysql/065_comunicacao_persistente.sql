-- Reserva de envio antes do HTTP. Uma entrega incerta nunca expira para retry automático.
CREATE TABLE IF NOT EXISTS clinica_envios_whatsapp (
  instituicao_id CHAR(36) NOT NULL,
  chave_hash CHAR(64) NOT NULL,
  conteudo_hash CHAR(64) NOT NULL,
  tentativa CHAR(36) NOT NULL,
  estado VARCHAR(16) NOT NULL,
  provedor_ref VARCHAR(255) NULL,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (instituicao_id, chave_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Payloads contêm conteúdo destinado ao paciente e são cifrados com AES-GCM.
CREATE TABLE IF NOT EXISTS clinica_comunicacoes (
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(191) NOT NULL,
  tipo VARCHAR(16) NOT NULL,
  chave_hash CHAR(64) NOT NULL,
  id_hash CHAR(64) NOT NULL,
  paciente_ref VARCHAR(191) NOT NULL,
  estado VARCHAR(16) NOT NULL,
  agendado_em TIMESTAMP(3) NULL,
  conteudo_cifrado LONGTEXT NOT NULL,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (instituicao_id, organizacao_ref, tipo, chave_hash),
  UNIQUE KEY uq_comunicacao_id (instituicao_id, organizacao_ref, tipo, id_hash),
  KEY idx_comunicacao_pendente (instituicao_id, tipo, estado, agendado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
