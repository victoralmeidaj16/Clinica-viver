-- Trilha de auditoria das intervenções administrativas (especificação final,
-- 13.01 e 13.02): usuário, data, valor anterior e valor novo.
--
-- Módulos que já tinham histórico próprio continuam com ele
-- (`clinica_agendamentos_alteracoes`, `clinica_configuracoes_gestao_historico`,
-- `clinica_pacientes_alteracoes_cadastrais`, `clinica_psicologos_alteracoes_perfil`,
-- histórico de preferências e de créditos). Esta tabela cobre os que não
-- tinham — valor da sessão, CPF, convênio e inativação do paciente, limite de
-- pacientes do psicólogo, devolução ao rodízio, lista de espera e pacotes — e
-- serve a qualquer módulo novo. A tela "Histórico de alterações" lê as duas
-- fontes.
--
-- `campos` guarda só o que mudou: [{ "campo", "rotulo", "anterior", "novo" }].
-- Dado pessoal sensível (CPF) entra mascarado. Conteúdo clínico nunca entra
-- aqui (13.03).
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS clinica_auditoria_alteracoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  modulo VARCHAR(40) NOT NULL,
  entidade_tipo VARCHAR(40) NOT NULL,
  entidade_ref VARCHAR(191) NOT NULL,
  entidade_rotulo VARCHAR(255) NULL,
  acao VARCHAR(60) NOT NULL,
  campos JSON NOT NULL,
  motivo VARCHAR(1000) NULL,
  autor_ref VARCHAR(128) NULL,
  autor_nome VARCHAR(255) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_auditoria_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  KEY clinica_auditoria_entidade_idx (instituicao_id, organizacao_ref, entidade_tipo, entidade_ref, criado_em),
  KEY clinica_auditoria_modulo_idx (instituicao_id, organizacao_ref, modulo, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
