-- Emissão de NFS-e: reserva imutável da numeração da DPS e trilha fiscal.
--
-- A nota fiscal não pode depender apenas da memória do processo. Se a resposta
-- da SEFIN se perder após o POST, a mesma DPS precisa ser consultada e, se
-- necessário, reenviada — nunca uma segunda DPS com outro número.

CREATE TABLE IF NOT EXISTS fiscal_nfse_series (
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  cnpj_prestador CHAR(14) NOT NULL,
  serie CHAR(5) NOT NULL,
  proximo_numero BIGINT UNSIGNED NOT NULL,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (instituicao_id, organizacao_ref, cnpj_prestador, serie),
  CONSTRAINT fiscal_nfse_series_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS fiscal_nfse_emissoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  cnpj_prestador CHAR(14) NOT NULL,
  serie CHAR(5) NOT NULL,
  numero_dps BIGINT UNSIGNED NOT NULL,
  dps_id CHAR(45) NOT NULL,
  ambiente ENUM('producao_restrita','producao') NOT NULL,
  valor_centavos BIGINT NOT NULL,
  competencia DATE NOT NULL,
  status ENUM('reserved','processing','issued','failed','cancelled') NOT NULL DEFAULT 'reserved',
  processando_em TIMESTAMP(3) NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  emitido_por_usuario_ref VARCHAR(128) NOT NULL,
  dps_xml MEDIUMTEXT NULL,
  nfse_xml MEDIUMTEXT NULL,
  chave_acesso CHAR(50) NULL,
  numero_nfse VARCHAR(30) NULL,
  sefin_http_status SMALLINT UNSIGNED NULL,
  sefin_retorno MEDIUMTEXT NULL,
  erro_codigo VARCHAR(80) NULL,
  erro_mensagem VARCHAR(1000) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fiscal_nfse_emissoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY fiscal_nfse_emissoes_cobranca_uq (instituicao_id, organizacao_ref, cobranca_ref),
  UNIQUE KEY fiscal_nfse_emissoes_dps_uq (instituicao_id, dps_id),
  UNIQUE KEY fiscal_nfse_emissoes_numero_dps_uq (instituicao_id, organizacao_ref, cnpj_prestador, serie, numero_dps),
  KEY fiscal_nfse_emissoes_status_idx (instituicao_id, organizacao_ref, status, criado_em),
  KEY fiscal_nfse_emissoes_chave_idx (instituicao_id, chave_acesso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
