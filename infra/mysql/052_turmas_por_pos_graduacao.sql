-- Identifica o encerramento pela combinação de pós-graduação e turma.
--
-- Antes, o código 25A encerrava todas as formações que o compartilhassem.
-- As linhas antigas são expandidas para cada combinação que possua ao menos
-- um psicólogo aprovado no momento da migração.
--
-- Idempotente inclusive após interrupção entre os DDLs.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'clinica_turmas_encerradas'
            AND column_name = 'pos_graduacao'),
  'SELECT 1',
  'ALTER TABLE clinica_turmas_encerradas ADD COLUMN pos_graduacao VARCHAR(255) NULL AFTER turma'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A chave antiga impediria inserir duas formações com o mesmo código.
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics
          WHERE table_schema = @schema_name
            AND table_name = 'clinica_turmas_encerradas'
            AND index_name = 'clinica_turmas_encerradas_uq')
  AND NOT EXISTS(SELECT 1 FROM information_schema.statistics
          WHERE table_schema = @schema_name
            AND table_name = 'clinica_turmas_encerradas'
            AND index_name = 'clinica_turmas_encerradas_uq'
            AND column_name = 'pos_graduacao'),
  'ALTER TABLE clinica_turmas_encerradas DROP INDEX clinica_turmas_encerradas_uq',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics
          WHERE table_schema = @schema_name
            AND table_name = 'clinica_turmas_encerradas'
            AND index_name = 'clinica_turmas_encerradas_uq'),
  'SELECT 1',
  'ALTER TABLE clinica_turmas_encerradas ADD UNIQUE KEY clinica_turmas_encerradas_uq (instituicao_id, organizacao_ref, pos_graduacao, turma)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO clinica_turmas_encerradas
  (id, instituicao_id, organizacao_ref, turma, pos_graduacao, encerrada_em, encerrada_por, criado_em)
SELECT UUID(), antiga.instituicao_id, antiga.organizacao_ref, antiga.turma,
       cadastro.pos_graduacao_viver_mais, antiga.encerrada_em, antiga.encerrada_por, antiga.criado_em
  FROM clinica_turmas_encerradas antiga
  JOIN (
    SELECT DISTINCT instituicao_id, organizacao_ref, turma_viver_mais, pos_graduacao_viver_mais
      FROM clinica_cadastros_psicologos
     WHERE status = 'APROVADO'
       AND TRIM(COALESCE(turma_viver_mais, '')) <> ''
       AND TRIM(COALESCE(pos_graduacao_viver_mais, '')) <> ''
  ) cadastro
    ON cadastro.instituicao_id = antiga.instituicao_id
   AND cadastro.organizacao_ref = antiga.organizacao_ref
   AND UPPER(TRIM(cadastro.turma_viver_mais)) = UPPER(TRIM(antiga.turma))
 WHERE antiga.pos_graduacao IS NULL
ON DUPLICATE KEY UPDATE encerrada_em = VALUES(encerrada_em);

DELETE FROM clinica_turmas_encerradas WHERE pos_graduacao IS NULL;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'clinica_turmas_encerradas'
            AND column_name = 'pos_graduacao'
            AND is_nullable = 'YES'),
  'ALTER TABLE clinica_turmas_encerradas MODIFY COLUMN pos_graduacao VARCHAR(255) NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
