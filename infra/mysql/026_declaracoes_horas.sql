-- Declarações de horas de atendimento, com código de conferência pública.
--
-- Antes disto a declaração era só um HTML impresso: não havia registro do que
-- a clínica tinha declarado, para quem, nem com que número. A coordenação do
-- curso recebia um papel e não tinha como distinguir o documento emitido aqui
-- de um PDF editado depois.
--
-- Cada linha guarda o que foi afirmado **e a evidência que sustentou**: os ids
-- das sessões que produziram o total. `conteudo_hash` é o SHA-256 do conteúdo
-- canônico; a conferência recalcula e compara, de modo que um UPDATE direto na
-- tabela deixa de passar por declaração válida.
--
-- `emitido_em` é gravado pela aplicação, não por CURRENT_TIMESTAMP: o instante
-- entra no hash, e um valor decidido pelo servidor de banco divergiria do que
-- foi assinado.

CREATE TABLE IF NOT EXISTS clinica_declaracoes_horas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  codigo CHAR(12) NOT NULL,
  psicologo_cadastro_ref VARCHAR(128) NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  psicologo_nome VARCHAR(255) NOT NULL,
  psicologo_crp VARCHAR(40) NOT NULL,
  curso VARCHAR(255) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_sessoes INT UNSIGNED NOT NULL,
  total_horas INT UNSIGNED NOT NULL,
  sessoes_ref JSON NOT NULL,
  conteudo_hash CHAR(64) NOT NULL,
  coordenadora VARCHAR(255) NOT NULL,
  supervisora VARCHAR(255) NULL,
  emitido_por_usuario_ref VARCHAR(128) NOT NULL,
  emitido_em TIMESTAMP(3) NOT NULL,
  revogada_em TIMESTAMP(3) NULL,
  revogacao_motivo VARCHAR(255) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_declaracoes_horas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_declaracoes_horas_codigo_uq (instituicao_id, codigo),
  KEY clinica_declaracoes_horas_psicologo_idx (instituicao_id, organizacao_ref, psicologo_cadastro_ref, emitido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
