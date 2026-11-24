-- Créditos são fatos históricos. Alterar a origem posteriormente não reescreve o crédito.
CREATE TABLE IF NOT EXISTS financeiro_creditos_educacionais (
  id CHAR(36) NOT NULL PRIMARY KEY,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  origem ENUM('payment','company_session','package','adjustment') NOT NULL,
  origem_ref VARCHAR(128) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  sessao_ref VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  competencia_em TIMESTAMP(3) NOT NULL,
  base_centavos BIGINT NOT NULL,
  credito_centavos BIGINT NOT NULL,
  forma VARCHAR(32) NULL,
  original_id CHAR(36) NULL,
  evento_ref VARCHAR(128) NULL,
  autor_ref VARCHAR(128) NULL,
  justificativa VARCHAR(500) NULL,
  UNIQUE KEY credito_origem (instituicao_id, organizacao_ref, origem, origem_ref),
  KEY credito_mes (instituicao_id, organizacao_ref, competencia_em),
  KEY credito_profissional (instituicao_id, organizacao_ref, profissional_ref, competencia_em),
  FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  FOREIGN KEY (original_id) REFERENCES financeiro_creditos_educacionais(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A mesma projeção alimenta o histórico e a captura transacional das novas baixas.
CREATE OR REPLACE VIEW financeiro_creditos_pagamentos_origem AS
 SELECT p.instituicao_id, p.organizacao_ref, p.ref_core AS origem_ref, c.ref_core AS cobranca_ref,
        c.sessao_ref, c.paciente_ref, c.profissional_ref, p.recebido_em AS competencia_em,
        p.valor_centavos AS base_centavos, ROUND(p.valor_centavos * 0.7) AS credito_centavos, p.forma
   FROM financeiro_pagamentos p JOIN financeiro_cobrancas c
     ON c.instituicao_id = p.instituicao_id AND c.organizacao_ref = p.organizacao_ref AND c.ref_core = p.cobranca_ref
  WHERE p.status = 'confirmed' AND c.convenio_ref IS NULL AND c.fatura_convenio_ref IS NULL;

DELIMITER $$
CREATE TRIGGER IF NOT EXISTS credito_pagamento_inserido AFTER INSERT ON financeiro_pagamentos FOR EACH ROW
BEGIN
  INSERT INTO financeiro_creditos_educacionais
    (id,instituicao_id,organizacao_ref,origem,origem_ref,cobranca_ref,sessao_ref,paciente_ref,profissional_ref,
     competencia_em,base_centavos,credito_centavos,forma)
  SELECT UUID(), v.instituicao_id,v.organizacao_ref,'payment',v.origem_ref,v.cobranca_ref,v.sessao_ref,v.paciente_ref,
         v.profissional_ref,v.competencia_em,v.base_centavos,v.credito_centavos,v.forma
    FROM financeiro_creditos_pagamentos_origem v WHERE v.instituicao_id=NEW.instituicao_id
     AND v.organizacao_ref=NEW.organizacao_ref AND v.origem_ref=NEW.ref_core;
END$$
CREATE TRIGGER IF NOT EXISTS credito_pagamento_confirmado AFTER UPDATE ON financeiro_pagamentos FOR EACH ROW
BEGIN
  IF OLD.status <> 'confirmed' AND NEW.status = 'confirmed' THEN
    INSERT INTO financeiro_creditos_educacionais
      (id,instituicao_id,organizacao_ref,origem,origem_ref,cobranca_ref,sessao_ref,paciente_ref,profissional_ref,
       competencia_em,base_centavos,credito_centavos,forma)
    SELECT UUID(),v.instituicao_id,v.organizacao_ref,'payment',v.origem_ref,v.cobranca_ref,v.sessao_ref,v.paciente_ref,
           v.profissional_ref,v.competencia_em,v.base_centavos,v.credito_centavos,v.forma
      FROM financeiro_creditos_pagamentos_origem v WHERE v.instituicao_id=NEW.instituicao_id
       AND v.organizacao_ref=NEW.organizacao_ref AND v.origem_ref=NEW.ref_core
    ON DUPLICATE KEY UPDATE id=financeiro_creditos_educacionais.id;
  END IF;
END$$
CREATE TRIGGER IF NOT EXISTS credito_sessao_empresarial AFTER INSERT ON financeiro_cobrancas FOR EACH ROW
BEGIN
  IF NEW.convenio_ref IS NOT NULL AND NEW.status <> 'cancelled' THEN
    INSERT INTO financeiro_creditos_educacionais
      (id,instituicao_id,organizacao_ref,origem,origem_ref,cobranca_ref,sessao_ref,paciente_ref,profissional_ref,
       competencia_em,base_centavos,credito_centavos)
    VALUES (UUID(),NEW.instituicao_id,NEW.organizacao_ref,'company_session',NEW.sessao_ref,NEW.ref_core,NEW.sessao_ref,
            NEW.paciente_ref,NEW.profissional_ref,NEW.emitida_em,NEW.valor_centavos,ROUND(NEW.valor_centavos * 0.7))
    ON DUPLICATE KEY UPDATE id=financeiro_creditos_educacionais.id;
  END IF;
END$$
DELIMITER ;

INSERT INTO financeiro_creditos_educacionais
  (id,instituicao_id,organizacao_ref,origem,origem_ref,cobranca_ref,sessao_ref,paciente_ref,profissional_ref,
   competencia_em,base_centavos,credito_centavos,forma)
SELECT UUID(),v.instituicao_id,v.organizacao_ref,'payment',v.origem_ref,v.cobranca_ref,v.sessao_ref,v.paciente_ref,
       v.profissional_ref,v.competencia_em,v.base_centavos,v.credito_centavos,v.forma
  FROM financeiro_creditos_pagamentos_origem v
 ON DUPLICATE KEY UPDATE id=financeiro_creditos_educacionais.id;

INSERT INTO financeiro_creditos_educacionais
  (id,instituicao_id,organizacao_ref,origem,origem_ref,cobranca_ref,sessao_ref,paciente_ref,profissional_ref,
   competencia_em,base_centavos,credito_centavos)
SELECT UUID(),c.instituicao_id,c.organizacao_ref,'company_session',c.sessao_ref,c.ref_core,c.sessao_ref,c.paciente_ref,
       c.profissional_ref,c.emitida_em,c.valor_centavos,ROUND(c.valor_centavos * 0.7)
  FROM financeiro_cobrancas c WHERE (c.convenio_ref IS NOT NULL OR c.fatura_convenio_ref IS NOT NULL)
    AND c.status <> 'cancelled'
 ORDER BY c.emitida_em, c.ref_core
 ON DUPLICATE KEY UPDATE id=financeiro_creditos_educacionais.id;
