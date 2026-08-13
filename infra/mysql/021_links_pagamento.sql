-- Links públicos de pagamento e conciliação idempotente do Asaas.
-- O token público não revela nome, usuário ou ref_core do profissional.

SET @coluna_token_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_profissionais'
     AND column_name = 'token_link_pagamento'
);
SET @sql_token := IF(
  @coluna_token_existe = 0,
  'ALTER TABLE clinica_profissionais ADD COLUMN token_link_pagamento CHAR(32) NULL AFTER valor_social_centavos',
  'SELECT 1'
);
PREPARE stmt_token FROM @sql_token;
EXECUTE stmt_token;
DEALLOCATE PREPARE stmt_token;

UPDATE clinica_profissionais
   SET token_link_pagamento = LOWER(REPLACE(UUID(), '-', ''))
 WHERE token_link_pagamento IS NULL;

SET @indice_token_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'clinica_profissionais'
     AND index_name = 'clinica_profissionais_token_pagamento_uq'
);
SET @sql_indice_token := IF(
  @indice_token_existe = 0,
  'CREATE UNIQUE INDEX clinica_profissionais_token_pagamento_uq ON clinica_profissionais (instituicao_id, token_link_pagamento)',
  'SELECT 1'
);
PREPARE stmt_indice_token FROM @sql_indice_token;
EXECUTE stmt_indice_token;
DEALLOCATE PREPARE stmt_indice_token;

-- Valores já adotados pela clínica nos links anteriores. Continuam sendo
-- campos do perfil e nunca são aceitos do corpo da requisição pública.
UPDATE clinica_profissionais
   SET valor_social_centavos = COALESCE(valor_social_centavos, 7500),
       valor_sessao_centavos = COALESCE(valor_sessao_centavos, 13000);

ALTER TABLE clinica_profissionais
  MODIFY COLUMN valor_sessao_centavos BIGINT NULL DEFAULT 13000,
  MODIFY COLUMN valor_social_centavos BIGINT NULL DEFAULT 7500;

CREATE TABLE IF NOT EXISTS financeiro_checkouts_asaas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  modalidade ENUM('social','particular') NOT NULL,
  referencia_externa VARCHAR(80) NOT NULL,
  provedor_pagamento_ref VARCHAR(255) NULL,
  status ENUM('creating','pending','paid','failed','refunded') NOT NULL DEFAULT 'creating',
  erro_codigo VARCHAR(80) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT financeiro_checkouts_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_checkouts_cobranca_uq (instituicao_id, cobranca_ref),
  UNIQUE KEY financeiro_checkouts_externa_uq (instituicao_id, referencia_externa),
  UNIQUE KEY financeiro_checkouts_provedor_uq (instituicao_id, provedor_pagamento_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_webhooks_asaas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  evento_ref VARCHAR(255) NOT NULL,
  evento_tipo VARCHAR(80) NOT NULL,
  provedor_pagamento_ref VARCHAR(255) NOT NULL,
  processado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT financeiro_webhooks_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_webhooks_evento_uq (instituicao_id, evento_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
