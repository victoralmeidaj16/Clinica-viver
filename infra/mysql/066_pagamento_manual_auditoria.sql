-- Autoria e instante do registro manual, separados da data do recebimento.
SET @schema_name = DATABASE();
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'financeiro_pagamentos' AND column_name = 'registrado_por'),
  'SELECT 1',
  'ALTER TABLE financeiro_pagamentos ADD COLUMN registrado_por VARCHAR(128) NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'financeiro_pagamentos' AND column_name = 'registrado_em'),
  'SELECT 1',
  'ALTER TABLE financeiro_pagamentos ADD COLUMN registrado_em TIMESTAMP(3) NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
