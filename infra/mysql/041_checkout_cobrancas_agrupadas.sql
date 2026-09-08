-- Um checkout remoto pode quitar várias cobranças de sessões selecionadas pelo paciente.
-- A tabela de junção preserva a alocação contábil por sessão e permite que o webhook
-- distribua uma única liquidação entre todas as cobranças incluídas.

CREATE TABLE IF NOT EXISTS financeiro_checkout_cobrancas (
  instituicao_id CHAR(36) NOT NULL,
  referencia_externa VARCHAR(80) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  valor_centavos BIGINT NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (instituicao_id, referencia_externa, cobranca_ref),
  CONSTRAINT financeiro_checkout_cobrancas_instituicao_fk
    FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_checkout_cobrancas_cobranca_uq (instituicao_id, cobranca_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
