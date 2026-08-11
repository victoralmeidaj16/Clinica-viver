-- Campos que os formulários coletam e o banco descartava.
--
-- O 009 criou as duas tabelas com um subconjunto das colunas: quatorze campos
-- de `CadastroPsicologoRecord` e `TriagemPacienteRecord` nunca tiveram onde
-- pousar. O efeito era silencioso e por isso pior — o POST respondia
-- `{success: true}` com tudo preenchido, e a leitura seguinte devolvia
-- `undefined`. Em modo de arquivo os campos sobreviviam; a perda era exclusiva
-- do caminho MySQL, o que fazia o bug aparecer só em produção.
--
-- Dois deles, `publico_alvo` e `necessidades_atendidas`, são critérios que o
-- rodízio cruza (viverMaisRodizio.ts, filtros 6 e 7). Vazios, esses filtros são
-- pulados: o matching por público-alvo degradava para "qualquer um serve".
--
-- Coluna dedicada para valor escalar e consultável; JSON para as listas curtas
-- declaradas no formulário, seguindo o critério que o próprio 009 estabelece no
-- cabeçalho.
--
-- Idempotente: aplicável a banco novo e a instalação que já rodou o 009.

SET @schema_name = DATABASE();

-- ---------------------------------------------------------------------------
-- clinica_cadastros_psicologos
-- ---------------------------------------------------------------------------

-- `foto_url` guarda hoje uma data URL base64 vinda do FileReader (até ~5 MB).
-- MEDIUMTEXT é ponte, não destino: o lugar da imagem é o Object Storage, já
-- listado como pendência de object storage. Enquanto for assim, evitar
-- selecionar esta coluna em listagens.
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'foto_url'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN foto_url MEDIUMTEXT NULL AFTER email'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'atendimento_preferencia'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN atendimento_preferencia ENUM(''PARTICULAR'',''SOCIAL'',''AMBOS'') NULL AFTER modalidade_atendimento'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Os rótulos em português declarados pelo profissional. `servicos_habilitados`
-- guarda os enums derivados deles; manter os dois permite reprocessar a
-- derivação sem pedir o cadastro de novo.
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'servicos_prestados'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN servicos_prestados JSON NULL AFTER servicos_habilitados'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'publico_alvo'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN publico_alvo JSON NULL AFTER servicos_prestados'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'publico_alvo_outro'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN publico_alvo_outro VARCHAR(255) NULL AFTER publico_alvo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'especificar_necessidades'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN especificar_necessidades TINYINT(1) NOT NULL DEFAULT 0 AFTER publico_alvo_outro'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'necessidades_atendidas'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN necessidades_atendidas JSON NULL AFTER especificar_necessidades'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'necessidades_outro'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN necessidades_outro VARCHAR(255) NULL AFTER necessidades_atendidas'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- clinica_triagens_pacientes
-- ---------------------------------------------------------------------------

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'numero_residencia'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN numero_residencia VARCHAR(32) NULL AFTER cep'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'para_quem_e'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN para_quem_e VARCHAR(120) NULL AFTER modalidade'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'especificar_necessidades'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN especificar_necessidades TINYINT(1) NOT NULL DEFAULT 0 AFTER para_quem_e'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'necessidades_paciente'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN necessidades_paciente JSON NULL AFTER especificar_necessidades'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'necessidades_outro'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN necessidades_outro VARCHAR(255) NULL AFTER necessidades_paciente'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'opcao_avaliacao_psicologica'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN opcao_avaliacao_psicologica VARCHAR(255) NULL AFTER necessidades_outro'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ponte com o cadastro clínico: aponta para `clinica_pacientes.ref_core` depois
-- que o lead é promovido a paciente, na confirmação do contato. Sem FK porque
-- as duas tabelas pertencem a repositórios diferentes e a promoção acontece
-- fora da transação de captação.
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'paciente_ref'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN paciente_ref VARCHAR(128) NULL AFTER psicologo_nome'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND index_name = 'clinica_triagens_paciente_idx'),
  'SELECT 1',
  'CREATE INDEX clinica_triagens_paciente_idx ON clinica_triagens_pacientes (instituicao_id, paciente_ref)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
