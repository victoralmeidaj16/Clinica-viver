-- Agenda editável pelo psicólogo e link público de marcação de sessões.
--
-- O token da agenda é separado do token de pagamento de propósito: quem recebe
-- o link para marcar sessão não deve poder trocá-lo pelo endereço que gera
-- cobrança, e revogar um não pode derrubar o outro.

SET @coluna_agenda_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_profissionais'
     AND column_name = 'token_link_agenda'
);
SET @sql_agenda := IF(
  @coluna_agenda_existe = 0,
  'ALTER TABLE clinica_profissionais ADD COLUMN token_link_agenda CHAR(32) NULL AFTER token_link_pagamento',
  'SELECT 1'
);
PREPARE stmt_agenda FROM @sql_agenda;
EXECUTE stmt_agenda;
DEALLOCATE PREPARE stmt_agenda;

UPDATE clinica_profissionais
   SET token_link_agenda = LOWER(REPLACE(UUID(), '-', ''))
 WHERE token_link_agenda IS NULL;

SET @indice_agenda_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'clinica_profissionais'
     AND index_name = 'clinica_profissionais_token_agenda_uq'
);
SET @sql_indice_agenda := IF(
  @indice_agenda_existe = 0,
  'CREATE UNIQUE INDEX clinica_profissionais_token_agenda_uq ON clinica_profissionais (instituicao_id, token_link_agenda)',
  'SELECT 1'
);
PREPARE stmt_indice_agenda FROM @sql_indice_agenda;
EXECUTE stmt_indice_agenda;
DEALLOCATE PREPARE stmt_indice_agenda;

-- A janela recorrente diz de quando até quando o profissional atende; a
-- duração diz em quantos horários aquilo se parte. Sem a coluna, o tamanho do
-- slot seria uma constante do código e uma janela de 08:00 às 12:00 ofereceria
-- um horário só.
SET @coluna_duracao_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_disponibilidades'
     AND column_name = 'duracao_min'
);
SET @sql_duracao := IF(
  @coluna_duracao_existe = 0,
  'ALTER TABLE clinica_disponibilidades ADD COLUMN duracao_min SMALLINT UNSIGNED NOT NULL DEFAULT 50 AFTER hora_fim',
  'SELECT 1'
);
PREPARE stmt_duracao FROM @sql_duracao;
EXECUTE stmt_duracao;
DEALLOCATE PREPARE stmt_duracao;

-- Férias, feriado, congresso: o intervalo em que a janela recorrente não vale.
-- Fica separado de `clinica_disponibilidades` porque é exceção datada, e
-- misturá-la com a regra semanal obrigaria a apagar e recriar a janela toda vez
-- que o profissional tirasse uma semana de folga.
CREATE TABLE IF NOT EXISTS clinica_agenda_bloqueios (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NOT NULL,
  inicio TIMESTAMP(3) NOT NULL,
  fim TIMESTAMP(3) NOT NULL,
  motivo VARCHAR(255) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_agenda_bloq_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_agenda_bloq_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  KEY clinica_agenda_bloq_janela_idx (instituicao_id, profissional_id, inicio, fim)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
