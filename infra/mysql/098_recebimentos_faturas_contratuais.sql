CREATE TABLE IF NOT EXISTS financeiro_recebimentos_contratuais (
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  fatura_ref VARCHAR(128) NOT NULL,
  pagamento_ref VARCHAR(128) NOT NULL,
  recebido_centavos BIGINT UNSIGNED NOT NULL,
  recebido_em TIMESTAMP(3) NOT NULL,
  estornado_centavos BIGINT UNSIGNED NOT NULL DEFAULT 0,
  estornado_em TIMESTAMP(3) NULL,
  PRIMARY KEY(instituicao_id,organizacao_ref,fatura_ref),
  UNIQUE KEY recebimento_provedor(instituicao_id,pagamento_ref),
  CHECK (estornado_centavos <= recebido_centavos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
