-- Conferência por origem antes da liberação da leitura do livro de créditos.
CREATE OR REPLACE VIEW financeiro_creditos_conferencia AS
SELECT v.instituicao_id,v.organizacao_ref,v.profissional_ref,DATE_FORMAT(DATE_SUB(v.competencia_em,INTERVAL 3 HOUR),'%Y-%m') AS mes,
       v.origem,v.origem_ref,v.base_centavos,v.credito_centavos,l.credito_centavos AS credito_gravado,
       CASE WHEN l.id IS NULL THEN 'ausente'
            WHEN v.base_centavos<>l.base_centavos OR v.credito_centavos<>l.credito_centavos OR v.profissional_ref<>l.profissional_ref
              OR v.paciente_ref<>l.paciente_ref OR v.competencia_em<>l.competencia_em THEN 'divergente'
            WHEN v.ocorrencias>1 THEN 'ambigua' ELSE 'conferido' END AS resultado
FROM (
  SELECT p.instituicao_id,p.organizacao_ref,p.profissional_ref,p.paciente_ref,p.competencia_em,'payment' AS origem,
         p.origem_ref,p.base_centavos,p.credito_centavos,1 AS ocorrencias FROM financeiro_creditos_pagamentos_origem p
  UNION ALL SELECT c.instituicao_id,c.organizacao_ref,c.profissional_ref,c.paciente_ref,c.emitida_em,'company_session',
         c.sessao_ref,c.valor_centavos,ROUND(c.valor_centavos*0.7),
         COUNT(*) OVER(PARTITION BY c.instituicao_id,c.organizacao_ref,c.sessao_ref)
    FROM financeiro_cobrancas c WHERE c.status<>'cancelled' AND (c.convenio_ref IS NOT NULL OR c.fatura_convenio_ref IS NOT NULL)
) v LEFT JOIN financeiro_creditos_educacionais l ON l.instituicao_id=v.instituicao_id AND l.organizacao_ref=v.organizacao_ref
  AND l.origem=v.origem AND l.origem_ref=v.origem_ref;

DROP PROCEDURE IF EXISTS verificar_importacao_creditos;
DELIMITER $$
CREATE PROCEDURE verificar_importacao_creditos()
BEGIN
  IF EXISTS(SELECT 1 FROM financeiro_creditos_conferencia WHERE resultado<>'conferido') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Confira origens em financeiro_creditos_conferencia antes de liberar a apuração.';
  END IF;
END$$
DELIMITER ;
CALL verificar_importacao_creditos();
DROP PROCEDURE verificar_importacao_creditos;
