-- Um link de pagamento por sessão e o instante em que o profissional
-- confirmou que o atendimento ocorreu.
--
-- O token é uma capacidade pública aleatória. Ele identifica somente o
-- agendamento; o checkout continua exigindo o CPF do paciente antes de criar
-- ou exibir qualquer cobrança.

SET @coluna_token_sessao_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos'
     AND column_name = 'token_pagamento_sessao'
);
SET @sql_token_sessao := IF(
  @coluna_token_sessao_existe = 0,
  'ALTER TABLE clinica_agendamentos ADD COLUMN token_pagamento_sessao CHAR(32) NULL AFTER sessao_clinica_ref',
  'SELECT 1'
);
PREPARE stmt_token_sessao FROM @sql_token_sessao;
EXECUTE stmt_token_sessao;
DEALLOCATE PREPARE stmt_token_sessao;

SET @coluna_realizado_em_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos'
     AND column_name = 'realizado_em'
);
SET @sql_realizado_em := IF(
  @coluna_realizado_em_existe = 0,
  'ALTER TABLE clinica_agendamentos ADD COLUMN realizado_em TIMESTAMP(3) NULL AFTER confirmado_em',
  'SELECT 1'
);
PREPARE stmt_realizado_em FROM @sql_realizado_em;
EXECUTE stmt_realizado_em;
DEALLOCATE PREPARE stmt_realizado_em;

UPDATE clinica_agendamentos
   SET token_pagamento_sessao = LOWER(REPLACE(UUID(), '-', ''))
 WHERE token_pagamento_sessao IS NULL;

SET @indice_token_sessao_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos'
     AND index_name = 'clinica_agendamentos_token_pagamento_uq'
);
SET @sql_indice_token_sessao := IF(
  @indice_token_sessao_existe = 0,
  'CREATE UNIQUE INDEX clinica_agendamentos_token_pagamento_uq ON clinica_agendamentos (instituicao_id, token_pagamento_sessao)',
  'SELECT 1'
);
PREPARE stmt_indice_token_sessao FROM @sql_indice_token_sessao;
EXECUTE stmt_indice_token_sessao;
DEALLOCATE PREPARE stmt_indice_token_sessao;

