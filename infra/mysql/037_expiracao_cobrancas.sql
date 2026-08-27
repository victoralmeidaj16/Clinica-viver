-- Estado explícito do checkout invalidado por vencimento exato.
-- A cobrança financeira permanece `overdue`: ela segue como recebível vencido,
-- enquanto o checkout Asaas deixa de aceitar pagamento.

ALTER TABLE financeiro_checkouts_asaas
  MODIFY COLUMN status ENUM('creating','pending','paid','failed','refunded','expired')
    NOT NULL DEFAULT 'creating';

SET @schema_name = DATABASE();
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=@schema_name AND table_name='financeiro_checkouts_asaas'
    AND column_name='expirado_em'), 'SELECT 1',
  'ALTER TABLE financeiro_checkouts_asaas ADD COLUMN expirado_em TIMESTAMP(3) NULL AFTER erro_codigo');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
