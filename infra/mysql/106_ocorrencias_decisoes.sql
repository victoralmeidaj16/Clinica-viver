-- Decisões da Gestão sobre as ocorrências administrativas (especificação
-- final, 13.06).
--
-- As ocorrências em si são derivadas na leitura das mesmas fontes que as
-- geram — pedidos sem profissional compatível, pacientes aguardando decisão,
-- pedidos de alteração de cadastro, falhas de checkout e de NFS-e, avisos não
-- entregues, 48 horas sem primeiro agendamento — e por isso não são copiadas
-- para cá. O que fica gravado é cada decisão: o próximo passo escrito pela
-- Gestão, a situação em que a ocorrência ficou, quem decidiu e quando. A
-- chave (`ocorrencia_chave`) liga a decisão ao cadastro, ao pedido ou ao
-- pagamento de origem (por exemplo `checkout:<cobrança>`, `nfse:<cobrança>`).
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS clinica_ocorrencias_decisoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ocorrencia_chave VARCHAR(255) NOT NULL,
  situacao VARCHAR(20) NOT NULL,
  decisao VARCHAR(2000) NOT NULL,
  autor_ref VARCHAR(128) NOT NULL,
  autor_nome VARCHAR(255) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_ocorrencias_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  KEY clinica_ocorrencias_chave_idx (instituicao_id, organizacao_ref, ocorrencia_chave, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
