CREATE TABLE IF NOT EXISTS financeiro_estornos_contratuais (
  instituicao_id CHAR(36) NOT NULL, organizacao_ref VARCHAR(128) NOT NULL,
  fatura_ref VARCHAR(128) NOT NULL, evento_ref VARCHAR(255) NOT NULL,
  valor_centavos BIGINT UNSIGNED NOT NULL, estornado_em TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (instituicao_id,evento_ref), KEY estornos_fatura (instituicao_id,organizacao_ref,fatura_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DELIMITER $$
CREATE TRIGGER IF NOT EXISTS fatura_contratual_composicao AFTER INSERT ON financeiro_faturas_convenio FOR EACH ROW
BEGIN
  IF NEW.composicao_contratual IS NOT NULL THEN
    UPDATE financeiro_cobrancas fc JOIN clinica_agendamentos a ON a.instituicao_id=fc.instituicao_id
      AND fc.sessao_ref IN (a.sessao_clinica_ref,a.ref_core)
      SET fc.fatura_convenio_ref=NEW.ref_core
      WHERE fc.instituicao_id=NEW.instituicao_id AND fc.organizacao_ref=NEW.organizacao_ref AND fc.convenio_ref=NEW.convenio_ref
        AND fc.status IN ('pending','overdue') AND fc.fatura_convenio_ref IS NULL
        AND (JSON_CONTAINS(NEW.composicao_contratual,JSON_QUOTE(a.ref_core),'$.sessoes')
          OR (JSON_UNQUOTE(JSON_EXTRACT(NEW.composicao_contratual,'$.base'))='fixa'
            AND DATE(DATE_SUB(a.inicio,INTERVAL 3 HOUR)) BETWEEN NEW.periodo_inicio AND NEW.periodo_fim));
  END IF;
END$$
CREATE TRIGGER IF NOT EXISTS sessao_em_fatura_contratual BEFORE INSERT ON financeiro_cobrancas FOR EACH ROW
BEGIN
  DECLARE fatura VARCHAR(128);
  DECLARE situacao VARCHAR(32);
  IF NEW.convenio_ref IS NOT NULL AND NEW.fatura_convenio_ref IS NULL THEN
    SELECT f.ref_core,f.status INTO fatura,situacao FROM financeiro_faturas_convenio f
      JOIN clinica_agendamentos a ON a.instituicao_id=f.instituicao_id AND a.sessao_clinica_ref=NEW.sessao_ref
      WHERE f.instituicao_id=NEW.instituicao_id AND f.organizacao_ref=NEW.organizacao_ref AND f.convenio_ref=NEW.convenio_ref
        AND f.composicao_contratual IS NOT NULL AND f.status<>'cancelada'
        AND (JSON_CONTAINS(f.composicao_contratual,JSON_QUOTE(a.ref_core),'$.sessoes')
          OR (JSON_UNQUOTE(JSON_EXTRACT(f.composicao_contratual,'$.base'))='fixa'
            AND DATE(DATE_SUB(a.inicio,INTERVAL 3 HOUR)) BETWEEN f.periodo_inicio AND f.periodo_fim))
      LIMIT 1 FOR SHARE;
    SET NEW.fatura_convenio_ref=fatura;
    IF situacao='paga' THEN SET NEW.status='paid',NEW.forma_pagamento='boleto'; END IF;
  END IF;
END$$
CREATE TRIGGER IF NOT EXISTS fatura_contratual_situacao AFTER UPDATE ON financeiro_faturas_convenio FOR EACH ROW
BEGIN
  IF NEW.composicao_contratual IS NOT NULL AND NEW.status<>OLD.status THEN
    IF NEW.status='paga' THEN
      UPDATE financeiro_cobrancas SET status='paid',forma_pagamento='boleto'
       WHERE instituicao_id=NEW.instituicao_id AND organizacao_ref=NEW.organizacao_ref AND fatura_convenio_ref=NEW.ref_core;
    ELSEIF NEW.status='cancelada' THEN
      UPDATE financeiro_cobrancas SET status='pending',forma_pagamento=NULL,fatura_convenio_ref=NULL
       WHERE instituicao_id=NEW.instituicao_id AND organizacao_ref=NEW.organizacao_ref AND fatura_convenio_ref=NEW.ref_core;
    END IF;
  END IF;
END$$
DELIMITER ;
