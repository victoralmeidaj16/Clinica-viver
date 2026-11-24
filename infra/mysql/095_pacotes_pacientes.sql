CREATE TABLE IF NOT EXISTS financeiro_pacotes (
  id CHAR(36) PRIMARY KEY,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  chave_criacao VARCHAR(128) NOT NULL,
  quantidade INT UNSIGNED NOT NULL,
  utilizadas INT UNSIGNED NOT NULL DEFAULT 0,
  valor_centavos BIGINT UNSIGNED NOT NULL,
  pago_em TIMESTAMP(3) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY pacote_idempotencia (instituicao_id, organizacao_ref, chave_criacao),
  UNIQUE KEY pacote_cobranca (instituicao_id, organizacao_ref, cobranca_ref),
  KEY pacote_vinculo (instituicao_id,organizacao_ref,paciente_ref,profissional_ref,pago_em),
  CHECK (quantidade > 0 AND utilizadas <= quantidade AND valor_centavos > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_pacote_divergencias (
  pacote_id CHAR(36) NOT NULL,
  evento_ref VARCHAR(255) NOT NULL,
  recebido_centavos BIGINT NOT NULL,
  recebido_em TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (pacote_id,evento_ref),
  FOREIGN KEY (pacote_id) REFERENCES financeiro_pacotes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
 AND table_name='clinica_agendamentos' AND column_name='pacote_id'), 'SELECT 1',
 'ALTER TABLE clinica_agendamentos ADD COLUMN pacote_id CHAR(36) NULL, ADD FOREIGN KEY (pacote_id) REFERENCES financeiro_pacotes(id)');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE OR REPLACE VIEW financeiro_creditos_pagamentos_origem AS
 SELECT p.instituicao_id,p.organizacao_ref,p.ref_core AS origem_ref,c.ref_core AS cobranca_ref,
        c.sessao_ref,c.paciente_ref,c.profissional_ref,p.recebido_em AS competencia_em,
        p.valor_centavos AS base_centavos,ROUND(p.valor_centavos * 0.7) AS credito_centavos,p.forma
   FROM financeiro_pagamentos p JOIN financeiro_cobrancas c
     ON c.instituicao_id=p.instituicao_id AND c.organizacao_ref=p.organizacao_ref AND c.ref_core=p.cobranca_ref
  WHERE p.status='confirmed' AND c.convenio_ref IS NULL AND c.fatura_convenio_ref IS NULL
    AND NOT EXISTS(SELECT 1 FROM financeiro_pacotes k WHERE k.instituicao_id=c.instituicao_id
       AND k.organizacao_ref=c.organizacao_ref AND k.cobranca_ref=c.ref_core);

DELIMITER $$
CREATE TRIGGER IF NOT EXISTS pacote_pagamento_integral AFTER INSERT ON financeiro_pagamentos FOR EACH ROW
BEGIN
  IF NEW.status='confirmed' THEN
    UPDATE financeiro_pacotes SET pago_em=NEW.recebido_em
     WHERE instituicao_id=NEW.instituicao_id AND organizacao_ref=NEW.organizacao_ref AND cobranca_ref=NEW.cobranca_ref
       AND pago_em IS NULL AND valor_centavos=NEW.valor_centavos AND NEW.provedor IN ('inter','asaas','other');
    IF ROW_COUNT()=1 THEN
      INSERT INTO financeiro_creditos_educacionais
        (id,instituicao_id,organizacao_ref,origem,origem_ref,cobranca_ref,sessao_ref,paciente_ref,profissional_ref,
         competencia_em,base_centavos,credito_centavos,forma)
      SELECT UUID(),instituicao_id,organizacao_ref,'package',id,cobranca_ref,id,paciente_ref,profissional_ref,
             NEW.recebido_em,valor_centavos,ROUND(valor_centavos * 0.7),NEW.forma
        FROM financeiro_pacotes WHERE instituicao_id=NEW.instituicao_id AND organizacao_ref=NEW.organizacao_ref AND cobranca_ref=NEW.cobranca_ref;
    END IF;
  END IF;
END$$
CREATE TRIGGER IF NOT EXISTS pacote_cancelamento AFTER UPDATE ON clinica_agendamentos FOR EACH ROW
BEGIN
  IF OLD.pacote_id IS NOT NULL AND OLD.status<>'cancelado' AND NEW.status='cancelado' THEN
    UPDATE financeiro_pacotes SET utilizadas=utilizadas-1 WHERE id=OLD.pacote_id;
  END IF;
END$$
DELIMITER ;
