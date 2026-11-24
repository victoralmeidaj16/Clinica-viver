-- Registro dos avisos enviados (especificação final, 7.03, 12.01 e 12.04).
--
-- Uma linha por aviso e canal: o evento (finalidade), o destinatário, a versão
-- do modelo usada, o resultado devolvido pela integração e o horário. A Gestão
-- consulta os não entregues e reenvia daqui.
--
-- `clinica_envios_whatsapp` (065) continua sendo a trava de idempotência da
-- entrega e guarda só hashes; esta tabela é o registro legível. O telefone e o
-- texto ficam cifrados (AES-256-GCM, mesma chave dos documentos) em
-- `conteudo_cifrado`, só para permitir o reenvio; a tela mostra apenas os
-- quatro últimos dígitos. Aviso com segredo no texto (link de ativação) é
-- registrado sem conteúdo e não se reenvia por aqui.
--
-- `canal = 'sino'` registra um aviso que existe só no painel da Gestão (por
-- exemplo, o de 48 horas sem primeiro agendamento quando a Gestão escolhe não
-- receber por WhatsApp), para que ele exista fora do sino.
--
-- O reenvio pela Gestão grava uma linha nova com `reenvio_de` apontando para a
-- original e uma chave própria: não reabre a solicitação nem o agendamento que
-- deram origem ao aviso.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS clinica_avisos_envios (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  finalidade VARCHAR(64) NOT NULL,
  chave_dedupe VARCHAR(255) NOT NULL,
  canal VARCHAR(16) NOT NULL,
  destinatario_tipo VARCHAR(16) NOT NULL,
  destino_final VARCHAR(8) NULL,
  referencia VARCHAR(255) NULL,
  situacao VARCHAR(32) NOT NULL,
  reenvio_seguro TINYINT(1) NULL,
  modelo_versao INT NOT NULL DEFAULT 0,
  tentativas INT NOT NULL DEFAULT 1,
  conteudo_cifrado TEXT NULL,
  reenvio_de CHAR(36) NULL,
  reenviado_em TIMESTAMP(3) NULL,
  autor_ref VARCHAR(128) NULL,
  autor_nome VARCHAR(255) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_avisos_envios_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_avisos_envios_chave_uq (instituicao_id, chave_dedupe, canal),
  KEY clinica_avisos_envios_situacao_idx (instituicao_id, situacao, criado_em),
  KEY clinica_avisos_envios_finalidade_idx (instituicao_id, finalidade, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
