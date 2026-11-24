-- Campos do pedido para os fluxos de triagem, rodízio e pacientes
-- (especificação final, 4.04, 5.02, 5.07, 6.03, 6.04 e 6.05).
--
--   prazo_resposta_horas         prazo da oferta em andamento (NULL = 24 h)
--   lista_espera                 permanência na lista de espera e seus eventos
--   inativacoes                  inativações do vínculo com motivo, autor e data
--   preferencias_originais       preferências como chegaram do site, nunca reescritas
--   alteracoes_preferencias      cada alteração posterior, com antes e depois
--   responsavel_financeiro       destinatário do primeiro contato e das cobranças
--   identificado_por_responsavel menor sem CPF identificado pelo CPF do responsável
--   vinculo_coletivo             participantes de casal, família ou grupo
--
-- `status` ganha `INATIVO`, distinto de `DESISTENTE`: o vínculo inativado não
-- ocupa vaga e não aguarda novo destino.
--
-- Idempotente. Enquanto não aplicada, `MysqlCaptureRepository` lê e grava sem
-- estas colunas e recusa, com a causa, só as operações que dependem delas.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'status' AND column_type LIKE '%''INATIVO''%'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes MODIFY COLUMN status ENUM(''PENDENTE_ATRIBUICAO'',''AGUARDANDO_CONTATO'',''CONTATO_CONFIRMADO'',''DESISTENTE'',''FINALIZADO'',''INATIVO'') NOT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'prazo_resposta_horas'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN prazo_resposta_horas SMALLINT UNSIGNED NULL AFTER alocado_em'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'lista_espera'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN lista_espera JSON NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'inativacoes'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN inativacoes JSON NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'preferencias_originais'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN preferencias_originais JSON NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'alteracoes_preferencias'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN alteracoes_preferencias JSON NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'responsavel_financeiro'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN responsavel_financeiro JSON NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'identificado_por_responsavel'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN identificado_por_responsavel TINYINT(1) NOT NULL DEFAULT 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'vinculo_coletivo'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN vinculo_coletivo JSON NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
