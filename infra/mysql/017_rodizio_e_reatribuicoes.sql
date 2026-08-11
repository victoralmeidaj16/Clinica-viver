-- Separação entre vitrine e fila do rodízio, e auditoria de reatribuição.
--
-- Até aqui `exibir_na_vitrine` respondia a duas perguntas diferentes: "esta
-- pessoa aparece no site?" e "esta pessoa recebe encaminhamento?". Eram a mesma
-- coisa de propósito, para não haver dois lugares de desligar alguém. Na
-- operação as duas se separaram: um profissional em férias precisa parar de
-- receber sem sumir da vitrine, e um perfil sem foto pode sair do site
-- continuando a atender quem já é seu.
--
-- A segunda parte cria o destino da auditoria de reatribuição. Hoje o motivo e
-- o autor de uma troca de psicólogo são concatenados numa linha de texto em
-- `clinica_pacientes.observacao_administrativa`, truncada em 1000 caracteres e
-- nunca lida de volta. Trocar o profissional de um paciente é decisão clínica e
-- administrativa; precisa sobreviver em formato consultável.
--
-- Idempotente, no mesmo estilo das anteriores.

SET @schema_name = DATABASE();

-- ---------------------------------------------------------------------------
-- clinica_cadastros_psicologos: pausa de rodízio independente da vitrine
-- ---------------------------------------------------------------------------

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'pausado_no_rodizio'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN pausado_no_rodizio TINYINT(1) NOT NULL DEFAULT 0 AFTER exibir_na_vitrine'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'motivo_pausa_rodizio'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN motivo_pausa_rodizio VARCHAR(255) NULL AFTER pausado_no_rodizio'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill — a parte que não pode falhar.
--
-- Antes desta migração, `exibir_na_vitrine = 0` era o ÚNICO critério que tirava
-- alguém da fila. Assim que o motor passar a olhar `pausado_no_rodizio`, quem
-- estava desligado voltaria a receber pacientes em silêncio — e o sintoma
-- apareceria como encaminhamento para quem está de férias.
--
-- A condição `motivo_pausa_rodizio IS NULL` torna o comando repetível sem
-- sobrescrever uma pausa que a gestão já tenha registrado depois.
UPDATE clinica_cadastros_psicologos
   SET pausado_no_rodizio = 1,
       motivo_pausa_rodizio = COALESCE(
         NULLIF(motivo_desativacao, ''),
         'Desativado antes da separação entre vitrine e fila'
       )
 WHERE exibir_na_vitrine = 0
   AND pausado_no_rodizio = 0
   AND motivo_pausa_rodizio IS NULL;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND index_name = 'clinica_cad_psis_rodizio_idx'),
  'SELECT 1',
  'CREATE INDEX clinica_cad_psis_rodizio_idx ON clinica_cadastros_psicologos (instituicao_id, organizacao_ref, status, pausado_no_rodizio)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- clinica_pacientes_reatribuicoes: quem trocou, por quê e quando
-- ---------------------------------------------------------------------------
--
-- Sem chave estrangeira, pelo mesmo motivo de `clinica_auditoria_acessos`: um
-- registro de auditoria não pode deixar de ser gravado porque a linha que ele
-- descreve foi removida ou ainda não existe. A referência é por `ref_core`.

CREATE TABLE IF NOT EXISTS clinica_pacientes_reatribuicoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  profissional_anterior_ref VARCHAR(128) NULL,
  profissional_novo_ref VARCHAR(128) NOT NULL,
  motivo TEXT NOT NULL,
  ator_usuario_ref VARCHAR(128) NOT NULL,
  ocorrido_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY clinica_reatribuicoes_paciente_idx (instituicao_id, paciente_ref, ocorrido_em),
  KEY clinica_reatribuicoes_profissional_idx (instituicao_id, profissional_novo_ref, ocorrido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
