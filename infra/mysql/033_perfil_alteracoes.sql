-- Trilha de alterações que o psicólogo faz no próprio perfil.
--
-- O sino é derivado: `application/notificacoes.ts` calcula os avisos a partir da
-- fila de triagem e do credenciamento a cada leitura, e nada de aviso é gravado
-- quando o evento acontece. Uma edição de perfil não se encaixa nessa regra, e
-- vale explicar por quê em vez de abrir exceção em silêncio.
--
-- Os outros avisos descrevem um **estado** que ainda é verdade no banco —
-- "paciente aguardando contato", "credenciamento em análise" — e por isso podem
-- ser recalculados a qualquer momento. Uma alteração de perfil é um **evento com
-- diferença**: depois que o registro foi sobrescrito, o valor anterior não existe
-- mais em lugar nenhum, e "de manhã, tarde para manhã, tarde, noite" é
-- impossível de derivar. Guardar o fato aqui é o que torna possível continuar
-- derivando a notificação, exatamente como as demais.
--
-- O que se guarda é o diff já resolvido, não o registro inteiro: a finalidade é
-- contar o que mudou para a coordenação, não manter uma segunda cópia do
-- cadastro envelhecendo em paralelo com o original.

CREATE TABLE IF NOT EXISTS clinica_psicologos_alteracoes_perfil (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  cadastro_ref VARCHAR(128) NOT NULL,
  psicologo_nome VARCHAR(255) NOT NULL,
  alterado_por_usuario_ref VARCHAR(128) NOT NULL,
  alterado_em TIMESTAMP(3) NOT NULL,
  -- `[{ campo, rotulo, de, para }]`, como `lib/perfilPsicologoDiff.ts` produz.
  mudancas JSON NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_psi_alteracoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  -- A chave da notificação é `perfil-alterado:<cadastro>:<alterado_em>`. A
  -- unicidade do par é o que impede um duplo clique em "salvar" de virar dois
  -- avisos idênticos, e é a mesma razão pela qual um PATCH sem diferença
  -- nenhuma não chega a gravar linha.
  UNIQUE KEY clinica_psi_alteracoes_evento_uq (instituicao_id, cadastro_ref, alterado_em),
  KEY clinica_psi_alteracoes_recentes_idx (instituicao_id, organizacao_ref, alterado_em),
  KEY clinica_psi_alteracoes_cadastro_idx (instituicao_id, cadastro_ref, alterado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
