ALTER TABLE clinica_convenios ADD COLUMN politica JSON NULL;
ALTER TABLE clinica_agendamentos ADD COLUMN cota_ocorrencia_ref VARCHAR(128) NULL,
  ADD COLUMN custeio_aguarda_autorizacao BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE financeiro_faturas_convenio ADD COLUMN composicao_contratual JSON NULL;

DELIMITER $$
CREATE TRIGGER convenio_cota_ocorrencia BEFORE UPDATE ON clinica_agendamentos FOR EACH ROW
BEGIN
  IF OLD.status IN ('agendado','confirmado') AND NEW.status IN ('cancelado','faltou')
     AND OLD.custeado_pela_empresa = 1 AND OLD.custeio_convenio_ref IS NOT NULL THEN
    SET NEW.cota_ocorrencia_ref = (SELECT c.ref_core FROM clinica_convenios c
      JOIN clinica_organizacoes o ON o.instituicao_id=c.instituicao_id AND o.ref_core=c.organizacao_ref
      WHERE o.id=OLD.organizacao_id AND c.instituicao_id=OLD.instituicao_id AND c.ref_core=OLD.custeio_convenio_ref
        AND IF(NEW.status='faltou', JSON_EXTRACT(c.politica,'$.consumirFalta'), JSON_EXTRACT(c.politica,'$.consumirCancelamento'))=TRUE);
  END IF;
  IF NEW.pacote_id IS NOT NULL AND NEW.custeado_pela_empresa=1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A sessão já está coberta pelo pacote do paciente.';
  END IF;
END$$
DELIMITER ;
