-- Eventos da NFS-e: cancelamento e o que mais vier depois da emissão.
--
-- Nota emitida não se apaga nem se edita: o que existe é um pedido de registro
-- de evento, assinado e numerado por nota. A numeração precisa sobreviver ao
-- processo, porque reenviar um pedido com sequencial repetido é rejeição — e
-- reenviar com sequencial novo, quando o primeiro passou, é um segundo evento.
--
-- Guarda-se o XML do pedido e a resposta crua da SEFIN pelo mesmo motivo de
-- `fiscal_nfse_emissoes`: em discussão fiscal o que vale é o documento, não o
-- resumo que a tela mostrou.

CREATE TABLE IF NOT EXISTS fiscal_nfse_eventos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  emissao_id CHAR(36) NOT NULL,
  tipo_evento VARCHAR(6) NOT NULL,
  numero_pedido SMALLINT UNSIGNED NOT NULL,
  pedido_id VARCHAR(64) NOT NULL,
  chave_acesso CHAR(50) NOT NULL,
  motivo_codigo VARCHAR(2) NULL,
  motivo VARCHAR(255) NULL,
  status ENUM('processing','registered','failed') NOT NULL DEFAULT 'processing',
  pedido_xml MEDIUMTEXT NULL,
  sefin_http_status SMALLINT UNSIGNED NULL,
  sefin_retorno MEDIUMTEXT NULL,
  erro_codigo VARCHAR(80) NULL,
  erro_mensagem VARCHAR(1000) NULL,
  solicitado_por_usuario_ref VARCHAR(128) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fiscal_nfse_eventos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT fiscal_nfse_eventos_emissao_fk FOREIGN KEY (emissao_id) REFERENCES fiscal_nfse_emissoes(id),
  -- A trava que impede dois cancelamentos concorrentes da mesma nota virarem
  -- dois pedidos com o mesmo sequencial.
  UNIQUE KEY fiscal_nfse_eventos_sequencial_uq (instituicao_id, emissao_id, tipo_evento, numero_pedido),
  KEY fiscal_nfse_eventos_chave_idx (instituicao_id, chave_acesso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @schema_name = DATABASE();

-- Quando a nota foi cancelada, e por quê, sem precisar abrir a trilha de
-- eventos: é o que a tela do financeiro mostra ao lado da cobrança.
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'cancelado_em'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN cancelado_em TIMESTAMP(3) NULL AFTER numero_nfse'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'cancelamento_motivo'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN cancelamento_motivo VARCHAR(255) NULL AFTER cancelado_em'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
