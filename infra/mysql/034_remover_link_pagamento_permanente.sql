-- Fim do link de pagamento permanente por psicólogo.
--
-- O `token_link_pagamento` nasceu de um modelo em que o paciente pagava "uma
-- sessão do psicólogo fulano" a qualquer momento, sem dizer qual. Como o link
-- não carregava agendamento nenhum, o checkout tinha de adivinhar a competência
-- da cobrança: pegava o último atendimento realizado que ainda não tivesse
-- cobrança. Um paciente com duas sessões em aberto pagava a errada, e a NFS-e
-- ia junto.
--
-- Quem passou a ancorar o dinheiro é o `clinica_agendamentos.token_pagamento_sessao`
-- criado no 028: um link por sessão marcada, com data, valor e profissional
-- decididos antes de existir cobrança. Com o código do link permanente removido,
-- a coluna aqui é só uma capacidade adormecida esperando alguém reativá-la.
--
-- O índice sai antes da coluna: o MySQL recusa remover coluna que ainda sustenta
-- índice único.

SET @indice_token_pagamento_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'clinica_profissionais'
     AND index_name = 'clinica_profissionais_token_pagamento_uq'
);
SET @sql_indice_token_pagamento := IF(
  @indice_token_pagamento_existe > 0,
  'DROP INDEX clinica_profissionais_token_pagamento_uq ON clinica_profissionais',
  'SELECT 1'
);
PREPARE stmt_indice_token_pagamento FROM @sql_indice_token_pagamento;
EXECUTE stmt_indice_token_pagamento;
DEALLOCATE PREPARE stmt_indice_token_pagamento;

SET @coluna_token_pagamento_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_profissionais'
     AND column_name = 'token_link_pagamento'
);
SET @sql_coluna_token_pagamento := IF(
  @coluna_token_pagamento_existe > 0,
  'ALTER TABLE clinica_profissionais DROP COLUMN token_link_pagamento',
  'SELECT 1'
);
PREPARE stmt_coluna_token_pagamento FROM @sql_coluna_token_pagamento;
EXECUTE stmt_coluna_token_pagamento;
DEALLOCATE PREPARE stmt_coluna_token_pagamento;
