-- Marcas de leitura das notificações do sino (header do admin e do psicólogo).
--
-- O que se guarda aqui é só o "já vi isto", nunca o conteúdo da notificação. O
-- conteúdo é derivado da fila de triagem e do credenciamento a cada leitura —
-- ver `server/application/notificacoes.ts` —, de modo que não exista uma
-- segunda cópia do estado clínico envelhecendo em paralelo com o original.
--
-- A chave da notificação carrega o instante do evento que a originou
-- (`paciente-atribuido:<lead>:<alocado_em>`), então um novo repasse do mesmo
-- paciente gera uma chave nova e volta a aparecer como não lida, em vez de ser
-- silenciada por uma leitura antiga.

CREATE TABLE IF NOT EXISTS clinica_notificacoes_leituras (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  usuario_ref VARCHAR(128) NOT NULL,
  notificacao_chave VARCHAR(191) NOT NULL,
  lida_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_notif_leituras_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_notif_leituras_uq (instituicao_id, usuario_ref, notificacao_chave),
  KEY clinica_notif_leituras_usuario_idx (instituicao_id, usuario_ref, lida_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
