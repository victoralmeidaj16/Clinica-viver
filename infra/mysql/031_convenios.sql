-- Convênios empresariais, custeio por empresa e faturamento PJ.
--
-- O convênio deixa de ser texto livre da triagem e passa a ser uma entidade
-- vinculável ao paciente. Cada sessão custeada continua sendo uma cobrança
-- individual; a fatura apenas agrupa essas cobranças para que a baixa do
-- boleto produza pagamentos rastreáveis, preserve o split 70/30 e não crie
-- uma segunda razão financeira.

CREATE TABLE IF NOT EXISTS clinica_convenios (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  razao_social VARCHAR(255) NULL,
  cnpj CHAR(14) NULL,
  email_faturamento VARCHAR(255) NULL,
  empresa_paga_sessoes TINYINT(1) NOT NULL DEFAULT 0,
  pacote_sessoes SMALLINT UNSIGNED NULL,
  dia_vencimento TINYINT UNSIGNED NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_convenios_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_convenios_ref_uq (instituicao_id, organizacao_ref, ref_core),
  UNIQUE KEY clinica_convenios_nome_uq (instituicao_id, organizacao_ref, nome),
  KEY clinica_convenios_ativos_idx (instituicao_id, organizacao_ref, ativo, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_faturas_convenio (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  convenio_ref VARCHAR(128) NOT NULL,
  competencia CHAR(7) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_sessoes INT UNSIGNED NOT NULL,
  valor_centavos BIGINT NOT NULL,
  status ENUM('aberta','boleto_gerado','paga','cancelada') NOT NULL DEFAULT 'aberta',
  vence_em DATE NULL,
  provedor_ref VARCHAR(255) NULL,
  boleto_url VARCHAR(1000) NULL,
  boleto_linha_digitavel VARCHAR(255) NULL,
  pago_em TIMESTAMP(3) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT financeiro_faturas_convenio_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_faturas_convenio_ref_uq (instituicao_id, organizacao_ref, ref_core),
  UNIQUE KEY financeiro_faturas_convenio_competencia_uq (instituicao_id, convenio_ref, competencia),
  -- O webhook busca pelo id do Asaas. Sem unicidade, uma reentrega poderia
  -- conciliar a fatura errada e creditar sessões de outra empresa.
  UNIQUE KEY financeiro_faturas_convenio_provedor_uq (instituicao_id, provedor_ref),
  KEY financeiro_faturas_convenio_status_idx (instituicao_id, organizacao_ref, status, vence_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @paciente_convenio_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_pacientes'
     AND column_name = 'convenio_ref'
);
SET @sql_paciente_convenio := IF(
  @paciente_convenio_existe = 0,
  'ALTER TABLE clinica_pacientes ADD COLUMN convenio_ref VARCHAR(128) NULL AFTER referencia_externa',
  'SELECT 1'
);
PREPARE stmt_paciente_convenio FROM @sql_paciente_convenio;
EXECUTE stmt_paciente_convenio;
DEALLOCATE PREPARE stmt_paciente_convenio;

SET @paciente_custeado_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_pacientes'
     AND column_name = 'custeado_pela_empresa'
);
SET @sql_paciente_custeado := IF(
  @paciente_custeado_existe = 0,
  'ALTER TABLE clinica_pacientes ADD COLUMN custeado_pela_empresa TINYINT(1) NULL AFTER convenio_ref',
  'SELECT 1'
);
PREPARE stmt_paciente_custeado FROM @sql_paciente_custeado;
EXECUTE stmt_paciente_custeado;
DEALLOCATE PREPARE stmt_paciente_custeado;

SET @paciente_convenio_indice_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'clinica_pacientes'
     AND index_name = 'clinica_pacientes_convenio_idx'
);
SET @sql_paciente_convenio_indice := IF(
  @paciente_convenio_indice_existe = 0,
  'CREATE INDEX clinica_pacientes_convenio_idx ON clinica_pacientes (instituicao_id, organizacao_id, convenio_ref)',
  'SELECT 1'
);
PREPARE stmt_paciente_convenio_indice FROM @sql_paciente_convenio_indice;
EXECUTE stmt_paciente_convenio_indice;
DEALLOCATE PREPARE stmt_paciente_convenio_indice;

SET @cobranca_fatura_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'financeiro_cobrancas'
     AND column_name = 'fatura_convenio_ref'
);
SET @sql_cobranca_fatura := IF(
  @cobranca_fatura_existe = 0,
  'ALTER TABLE financeiro_cobrancas ADD COLUMN fatura_convenio_ref VARCHAR(128) NULL AFTER provedor_ref',
  'SELECT 1'
);
PREPARE stmt_cobranca_fatura FROM @sql_cobranca_fatura;
EXECUTE stmt_cobranca_fatura;
DEALLOCATE PREPARE stmt_cobranca_fatura;

SET @cobranca_fatura_indice_existe := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'financeiro_cobrancas'
     AND index_name = 'financeiro_cobrancas_fatura_convenio_idx'
);
SET @sql_cobranca_fatura_indice := IF(
  @cobranca_fatura_indice_existe = 0,
  'CREATE INDEX financeiro_cobrancas_fatura_convenio_idx ON financeiro_cobrancas (instituicao_id, organizacao_ref, fatura_convenio_ref)',
  'SELECT 1'
);
PREPARE stmt_cobranca_fatura_indice FROM @sql_cobranca_fatura_indice;
EXECUTE stmt_cobranca_fatura_indice;
DEALLOCATE PREPARE stmt_cobranca_fatura_indice;

SET @nfse_convenio_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'fiscal_nfse_emissoes'
     AND column_name = 'convenio_ref'
);
SET @sql_nfse_convenio := IF(
  @nfse_convenio_existe = 0,
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN convenio_ref VARCHAR(128) NULL AFTER paciente_ref',
  'SELECT 1'
);
PREPARE stmt_nfse_convenio FROM @sql_nfse_convenio;
EXECUTE stmt_nfse_convenio;
DEALLOCATE PREPARE stmt_nfse_convenio;

-- NULL distingue o tomador PJ da emissão por paciente. Repetir o MODIFY é
-- seguro e mantém instalações parciais alinhadas com o contrato final.
ALTER TABLE fiscal_nfse_emissoes
  MODIFY COLUMN paciente_ref VARCHAR(128) NULL;

-- Catálogo real que antes vivia dentro do bundle da vitrine. CNPJ, razão
-- social e e-mail ficam nulos até a administração cadastrar dados verdadeiros.
INSERT INTO clinica_convenios
  (id, instituicao_id, organizacao_ref, ref_core, nome, empresa_paga_sessoes, ativo)
SELECT UUID(), o.instituicao_id, o.ref_core, seed.ref_core, seed.nome,
       seed.empresa_paga_sessoes, 1
  FROM clinica_organizacoes o
  JOIN (
    SELECT 'convenio-001' ref_core, 'Alvet Hospital Veterinário' nome, 0 empresa_paga_sessoes UNION ALL
    SELECT 'convenio-002', 'AMPE Tubarão', 0 UNION ALL
    SELECT 'convenio-003', 'Bebidas Nuernberg', 0 UNION ALL
    SELECT 'convenio-004', 'Canguru Embalagens', 0 UNION ALL
    SELECT 'convenio-005', 'Cerealista Vista Alegre', 0 UNION ALL
    SELECT 'convenio-006', 'CFC Placar', 0 UNION ALL
    SELECT 'convenio-007', 'Colégio Éthicos/ Escola Catavento', 0 UNION ALL
    SELECT 'convenio-008', 'Colorminas', 0 UNION ALL
    SELECT 'convenio-009', 'Concordia Logistica Portuária', 0 UNION ALL
    SELECT 'convenio-010', 'Copaza Descartáveis', 0 UNION ALL
    SELECT 'convenio-011', 'Cristalcopo (empresa paga as sessões)', 1 UNION ALL
    SELECT 'convenio-012', 'Damyller', 0 UNION ALL
    SELECT 'convenio-013', 'Engeplus', 0 UNION ALL
    SELECT 'convenio-014', 'ESUCRI', 0 UNION ALL
    SELECT 'convenio-015', 'EUpsico', 0 UNION ALL
    SELECT 'convenio-016', 'Fundicar', 0 UNION ALL
    SELECT 'convenio-017', 'Grupo Ramage', 0 UNION ALL
    SELECT 'convenio-018', 'Hospital Florianópolis', 0 UNION ALL
    SELECT 'convenio-019', 'Imbralit', 0 UNION ALL
    SELECT 'convenio-020', 'Jean Querino sobrancelha e Beleza', 0 UNION ALL
    SELECT 'convenio-021', 'KFG', 0 UNION ALL
    SELECT 'convenio-022', 'Loja Tchê', 0 UNION ALL
    SELECT 'convenio-023', 'Maré Alta', 0 UNION ALL
    SELECT 'convenio-024', 'MJP/MMC Metalúrgica', 0 UNION ALL
    SELECT 'convenio-025', 'Pagé', 0 UNION ALL
    SELECT 'convenio-026', 'Sempre Real', 0 UNION ALL
    SELECT 'convenio-027', 'STAR PROTECAO VEICULAR', 0 UNION ALL
    SELECT 'convenio-028', 'UNICER', 0 UNION ALL
    SELECT 'convenio-029', 'UNIFEBE', 0 UNION ALL
    SELECT 'convenio-030', 'UNISUL (Curso de psicologia)', 0 UNION ALL
    SELECT 'convenio-031', 'UNINASSAU (Curso de psicologia)', 0 UNION ALL
    SELECT 'convenio-032', 'Viver Mais Psicologia - Alunos', 0 UNION ALL
    SELECT 'convenio-033', 'Weg', 0
  ) seed
 WHERE o.ref_core = 'org-viver-mais'
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  empresa_paga_sessoes = IF(
    clinica_convenios.ref_core = 'convenio-011',
    1,
    clinica_convenios.empresa_paga_sessoes
  ),
  ativo = 1;

-- A promoção da triagem liga somente nomes exatos e ignora o sentinela. Um
-- nome divergente permanece sem vínculo para revisão, em vez de ser associado
-- por aproximação a uma empresa incorreta.
UPDATE clinica_pacientes p
JOIN clinica_organizacoes o
  ON o.id = p.organizacao_id AND o.instituicao_id = p.instituicao_id
JOIN clinica_triagens_pacientes t
  ON t.instituicao_id = p.instituicao_id
 AND t.organizacao_ref = o.ref_core
 AND t.paciente_ref = p.ref_core
JOIN clinica_convenios c
  ON c.instituicao_id = p.instituicao_id
 AND c.organizacao_ref = o.ref_core
 AND c.nome = t.convenio_selecionado
SET p.convenio_ref = c.ref_core
WHERE p.convenio_ref IS NULL
  AND t.convenio_selecionado <> 'Nenhum';
