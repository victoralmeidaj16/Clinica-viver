-- O checkout de sessão pode ser liquidado por cartão no Asaas ou Pix no Inter.
-- A tabela mantém o nome histórico para evitar uma migração destrutiva.

SET @schema_name = DATABASE();
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=@schema_name AND table_name='financeiro_checkouts_asaas'
    AND column_name='provedor'), 'SELECT 1',
  'ALTER TABLE financeiro_checkouts_asaas ADD COLUMN provedor ENUM(''asaas'',''inter'') NULL AFTER referencia_externa');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE financeiro_pagamentos
  MODIFY COLUMN provedor ENUM('asaas','inter','manual','other') NULL;

CREATE TABLE IF NOT EXISTS financeiro_webhooks_inter (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  evento_ref VARCHAR(255) NOT NULL,
  txid VARCHAR(35) NOT NULL,
  end_to_end_id VARCHAR(64) NOT NULL,
  processado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT financeiro_webhooks_inter_instituicao_fk
    FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_webhooks_inter_evento_uq (instituicao_id, evento_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
