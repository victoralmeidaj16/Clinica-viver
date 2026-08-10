-- Nucleo clinico e financeiro: prontuario, revisoes, linha do tempo, sessoes
-- e o razao financeiro. Aplicar depois do 011_localizacao_limite_psicologos.sql.
--
-- Estes agregados eram os ultimos a viver no snapshot JSON. Arquivo nao tem
-- transacao entre agregados, e a leitura descarta o estado inteiro em silencio
-- quando o formato muda -- o que, para um prontuario com guarda legal de cinco
-- anos, e perda de dado sem rastro.
--
-- Nao confundir com o desenho antigo. `clinica_evolucoes` (004_clinica.sql)
-- modela evolucao append-only com conteudo em texto; `financeiro_recebimentos`
-- (001_financeiro.sql) modela o recebimento do modulo antigo. Nenhuma das duas
-- comporta o que a aplicacao usa hoje -- prontuario SOAP com revisoes, status e
-- versao; razao com seis colecoes. As duas seguem intocadas.
--
-- Convencoes herdadas do 007/009: CHAR(36) como PK derivada, `ref_core` com o
-- id do dominio, `instituicao_id` + `organizacao_ref` em toda tabela, `versao`
-- para concorrencia otimista, TIMESTAMP(3), InnoDB, utf8mb4_0900_ai_ci.
--
-- Idempotencia de comando reusa `clinica_comandos`, que ja serve a agenda.
--
-- RECORTE DA VIVER MAIS (definido em 10/08/2026): a clinica nao grava nem
-- transcreve sessao, e o prontuario e escrito inteiramente pelo profissional.
-- Por isso nao existe aqui coluna de gravacao, de transcricao nem de
-- proveniencia de IA -- guardar campo para um fluxo que nao acontece so cria a
-- duvida, mais tarde, sobre por que ele esta sempre vazio. A sessao clinica e
-- registro do atendimento: liga agendamento, prontuario e cobranca, sem a
-- cadeia de automacao pos-sessao.
--
-- O tipo `ClinicalRecordRevision` do nucleo ainda admite `aiProvenance`, e o
-- `ClinicalSession` ainda admite gravacao e transcricao. O repositorio
-- **recusa** os dois em vez de descarta-los em silencio: se um dia voltarem,
-- a falha aparece na hora, e nao como campo que sumiu sem ninguem notar.

-- ---------------------------------------------------------------------------
-- Prontuario
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinica_prontuarios (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  sessao_ref VARCHAR(128) NOT NULL,
  profissional_responsavel_ref VARCHAR(128) NOT NULL,
  profissionais_atribuidos JSON NOT NULL,
  status ENUM('draft','approved','amendment_draft') NOT NULL DEFAULT 'draft',
  revisao_rascunho_ativa INT UNSIGNED NULL,
  revisao_aprovada_atual INT UNSIGNED NULL,
  -- Prazo de guarda do CFP. Coluna propria, e nao calculo na aplicacao, porque
  -- e criterio de expurgo: quem apaga precisa ler a data no banco.
  retencao_ate TIMESTAMP(3) NOT NULL,
  -- Retencao legal estendida. Enquanto verdadeiro, nenhuma rotina de expurgo
  -- pode tocar o registro, mesmo vencido o prazo.
  retencao_legal TINYINT(1) NOT NULL DEFAULT 0,
  versao INT UNSIGNED NOT NULL DEFAULT 0,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_prontuarios_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_prontuarios_ref_uq (instituicao_id, ref_core),
  -- Uma sessao produz no maximo um prontuario. Sem isso, uma automacao
  -- reprocessada cria o segundo registro clinico do mesmo atendimento, e nao
  -- ha como saber qual dos dois vale.
  UNIQUE KEY clinica_prontuarios_sessao_uq (instituicao_id, organizacao_ref, sessao_ref),
  KEY clinica_prontuarios_paciente_idx (instituicao_id, organizacao_ref, paciente_ref, criado_em),
  KEY clinica_prontuarios_profissional_idx (instituicao_id, organizacao_ref, profissional_responsavel_ref),
  KEY clinica_prontuarios_status_idx (instituicao_id, organizacao_ref, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Uma linha por revisao. Nunca recebe UPDATE: retificar cria a revisao
-- seguinte, e as duas permanecem legiveis lado a lado.
CREATE TABLE IF NOT EXISTS clinica_prontuarios_revisoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  prontuario_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  numero_revisao INT UNSIGNED NOT NULL,
  tipo ENUM('initial','amendment') NOT NULL,
  origem ENUM('manual','ai_assisted') NOT NULL,
  subjetivo MEDIUMTEXT NOT NULL,
  objetivo MEDIUMTEXT NOT NULL,
  avaliacao MEDIUMTEXT NOT NULL,
  plano MEDIUMTEXT NOT NULL,
  tarefas_extraidas JSON NOT NULL,
  motivo_retificacao TEXT NULL,
  criado_por_usuario_ref VARCHAR(128) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_pront_revisoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_pront_revisoes_prontuario_fk FOREIGN KEY (prontuario_id) REFERENCES clinica_prontuarios(id),
  UNIQUE KEY clinica_pront_revisoes_ref_uq (instituicao_id, ref_core),
  -- O numero da revisao e unico dentro do prontuario: e ele que ordena o
  -- historico e que a aprovacao referencia.
  UNIQUE KEY clinica_pront_revisoes_numero_uq (prontuario_id, numero_revisao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Aprovacao com o hash do conteudo aprovado. E o que permite provar, depois,
-- que o texto guardado e o mesmo que o profissional assinou.
CREATE TABLE IF NOT EXISTS clinica_prontuarios_aprovacoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  prontuario_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  numero_revisao INT UNSIGNED NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  aprovado_por_usuario_ref VARCHAR(128) NOT NULL,
  aprovado_em TIMESTAMP(3) NOT NULL,
  hash_conteudo CHAR(64) NOT NULL,
  atestado VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT clinica_pront_aprov_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_pront_aprov_prontuario_fk FOREIGN KEY (prontuario_id) REFERENCES clinica_prontuarios(id),
  UNIQUE KEY clinica_pront_aprov_ref_uq (instituicao_id, ref_core),
  -- Uma revisao e aprovada uma unica vez.
  UNIQUE KEY clinica_pront_aprov_revisao_uq (prontuario_id, numero_revisao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Trilha de leitura e escrita de prontuario e de linha do tempo.
--
-- Nao reusa `clinica_acessos_prontuario` (004_clinica.sql) por dois motivos
-- concretos: aquela tabela exige `paciente_id` com FK para `clinica_pacientes`
-- -- o que faria a auditoria falhar justamente quando o paciente ainda nao
-- estivesse la, ou seja, silenciar o registro no caso mais delicado -- e usa
-- um vocabulario de acao ('leitura','escrita') que nao distingue leitura
-- negada de leitura concedida. A tabela antiga segue intocada.
--
-- O que esta tabela nao guarda: nome, contato e qualquer conteudo clinico. Ela
-- responde quem acessou o que e quando. Log que carrega o dado protegido vira
-- uma segunda copia do prontuario, sem as regras do prontuario.
CREATE TABLE IF NOT EXISTS clinica_auditoria_acessos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  usuario_ref VARCHAR(128) NOT NULL,
  acao ENUM('clinical_record.read','clinical_record.listed',
            'clinical_record.access_denied','clinical_timeline.listed',
            'clinical_timeline.searched') NOT NULL,
  prontuario_ref VARCHAR(128) NULL,
  paciente_ref VARCHAR(128) NULL,
  correlacao_id VARCHAR(128) NOT NULL,
  motivo VARCHAR(255) NULL,
  quantidade_resultados INT UNSIGNED NULL,
  ocorrido_em TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT clinica_auditoria_acessos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_auditoria_acessos_ref_uq (instituicao_id, ref_core),
  KEY clinica_auditoria_acessos_usuario_idx (instituicao_id, usuario_ref, ocorrido_em),
  KEY clinica_auditoria_acessos_prontuario_idx (instituicao_id, prontuario_ref, ocorrido_em),
  KEY clinica_auditoria_acessos_paciente_idx (instituicao_id, paciente_ref, ocorrido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Sessao clinica
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinica_sessoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  profissional_principal_ref VARCHAR(128) NOT NULL,
  profissionais_atribuidos JSON NOT NULL,
  status ENUM('scheduled','confirmed','in_progress','awaiting_processing',
              'processing_failed','awaiting_review','ready_to_complete',
              'completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  modalidade ENUM('in_person','video','phone') NOT NULL,
  inicio_previsto TIMESTAMP(3) NOT NULL,
  fim_previsto TIMESTAMP(3) NOT NULL,
  inicio_real TIMESTAMP(3) NULL,
  fim_real TIMESTAMP(3) NULL,
  cancelamento_codigo VARCHAR(80) NULL,
  -- Consentimentos, plano e estado da automacao sao listas e maquinas de
  -- estado que so a aplicacao interpreta; nenhuma consulta filtra por elas.
  -- Ficam como JSON para que o agregado volte do banco identico ao que entrou.
  consentimentos JSON NOT NULL,
  automacao_plano JSON NOT NULL,
  automacao_estado JSON NOT NULL,
  -- As duas unicas ligacoes que a Viver Mais usa: o prontuario que a sessao
  -- produziu e a cobranca que ela gerou. Gravacao, transcricao, entrega ao
  -- paciente e recibo nao existem neste recorte.
  prontuario_aprovado_ref VARCHAR(128) NULL,
  cobranca_ref VARCHAR(128) NULL,
  versao INT UNSIGNED NOT NULL DEFAULT 0,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_sessoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_sessoes_ref_uq (instituicao_id, ref_core),
  KEY clinica_sessoes_paciente_idx (instituicao_id, organizacao_ref, paciente_ref, inicio_previsto),
  KEY clinica_sessoes_profissional_idx (instituicao_id, organizacao_ref, profissional_principal_ref, inicio_previsto),
  KEY clinica_sessoes_status_idx (instituicao_id, organizacao_ref, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Linha do tempo clinica
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinica_linha_do_tempo (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  profissionais_autorizados JSON NOT NULL,
  categoria ENUM('clinical_record','session','assessment','mood','habit','task',
                 'goal','pre_session','appointment','alert') NOT NULL,
  importancia ENUM('routine','attention','milestone') NOT NULL DEFAULT 'routine',
  ocorrido_em TIMESTAMP(3) NOT NULL,
  registrado_em TIMESTAMP(3) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  resumo TEXT NOT NULL,
  trecho_evidencia TEXT NULL,
  etiquetas JSON NOT NULL,
  -- A referencia a fonte e o que separa esta tabela de um mural de recados:
  -- toda entrada aponta para o registro que a originou, e a busca de memoria
  -- clinica devolve a fonte junto do resultado.
  evidencia_tipo ENUM('clinical_record_revision','clinical_session_event',
                      'assessment_response','mood_check_in','habit_observation',
                      'care_plan','pre_session_check_in','appointment_event',
                      'care_alert') NOT NULL,
  evidencia_ref VARCHAR(128) NOT NULL,
  evidencia_versao INT UNSIGNED NULL,
  evidencia_revisao_ref VARCHAR(128) NULL,
  evidencia_campo VARCHAR(80) NULL,
  evidencia_hash CHAR(64) NULL,
  PRIMARY KEY (id),
  CONSTRAINT clinica_linha_tempo_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_linha_tempo_ref_uq (instituicao_id, ref_core),
  KEY clinica_linha_tempo_paciente_idx (instituicao_id, organizacao_ref, paciente_ref, ocorrido_em),
  KEY clinica_linha_tempo_categoria_idx (instituicao_id, organizacao_ref, paciente_ref, categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Razao financeiro
-- ---------------------------------------------------------------------------
--
-- Valores em centavos inteiros (BIGINT), nunca DECIMAL nem ponto flutuante:
-- e assim que `MoneyCents` existe no dominio, e converter na fronteira e como
-- se introduz erro de arredondamento em dinheiro.

CREATE TABLE IF NOT EXISTS financeiro_cobrancas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  sessao_ref VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  emitida_em TIMESTAMP(3) NOT NULL,
  vence_em TIMESTAMP(3) NOT NULL,
  valor_centavos BIGINT NOT NULL,
  status ENUM('draft','pending','partially_paid','paid','overdue','cancelled','refunded')
    NOT NULL DEFAULT 'draft',
  forma_pagamento ENUM('pix','cash','card','bank_transfer','other') NULL,
  descricao VARCHAR(255) NULL,
  provedor_ref VARCHAR(255) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT financeiro_cobrancas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_cobrancas_ref_uq (instituicao_id, ref_core),
  -- Caminho do webhook: o provedor devolve a propria referencia, e a busca
  -- precisa ser unica e indexada. Sem unicidade, um reenvio do gateway acha
  -- duas cobrancas e concilia a errada.
  UNIQUE KEY financeiro_cobrancas_provedor_uq (instituicao_id, provedor_ref),
  KEY financeiro_cobrancas_sessao_idx (instituicao_id, organizacao_ref, sessao_ref),
  KEY financeiro_cobrancas_status_idx (instituicao_id, organizacao_ref, status, vence_em),
  KEY financeiro_cobrancas_paciente_idx (instituicao_id, organizacao_ref, paciente_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_descontos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  valor_centavos BIGINT NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  aplicado_em TIMESTAMP(3) NOT NULL,
  criado_por VARCHAR(128) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT financeiro_descontos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_descontos_ref_uq (instituicao_id, ref_core),
  KEY financeiro_descontos_cobranca_idx (instituicao_id, organizacao_ref, cobranca_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_pagamentos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  recebido_em TIMESTAMP(3) NOT NULL,
  valor_centavos BIGINT NOT NULL,
  forma ENUM('pix','cash','card','bank_transfer','other') NOT NULL,
  status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  provedor ENUM('asaas','manual','other') NULL,
  provedor_transacao_ref VARCHAR(255) NULL,
  PRIMARY KEY (id),
  CONSTRAINT financeiro_pagamentos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_pagamentos_ref_uq (instituicao_id, ref_core),
  -- Um pagamento por transacao do provedor. E esta linha que impede o webhook
  -- reentregue de creditar o mesmo dinheiro duas vezes.
  UNIQUE KEY financeiro_pagamentos_transacao_uq (instituicao_id, provedor_transacao_ref),
  KEY financeiro_pagamentos_cobranca_idx (instituicao_id, organizacao_ref, cobranca_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_estornos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  pagamento_ref VARCHAR(128) NOT NULL,
  valor_centavos BIGINT NOT NULL,
  estornado_em TIMESTAMP(3) NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  provedor_ref VARCHAR(255) NULL,
  PRIMARY KEY (id),
  CONSTRAINT financeiro_estornos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_estornos_ref_uq (instituicao_id, ref_core),
  KEY financeiro_estornos_pagamento_idx (instituicao_id, organizacao_ref, pagamento_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_taxas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  -- Uma taxa nasce de uma cobranca ou de um pagamento, nunca das duas e nunca
  -- de nenhuma; a checagem fica na aplicacao porque as duas colunas sao
  -- opcionais no dominio.
  cobranca_ref VARCHAR(128) NULL,
  pagamento_ref VARCHAR(128) NULL,
  tipo ENUM('provider','banking','tax','platform','other') NOT NULL,
  valor_centavos BIGINT NOT NULL,
  incorrida_em TIMESTAMP(3) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT financeiro_taxas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_taxas_ref_uq (instituicao_id, ref_core),
  KEY financeiro_taxas_cobranca_idx (instituicao_id, organizacao_ref, cobranca_ref),
  KEY financeiro_taxas_pagamento_idx (instituicao_id, organizacao_ref, pagamento_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_repasses (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  cobranca_ref VARCHAR(128) NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  valor_centavos BIGINT NOT NULL,
  vence_em TIMESTAMP(3) NOT NULL,
  status ENUM('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
  pago_em TIMESTAMP(3) NULL,
  provedor_ref VARCHAR(255) NULL,
  PRIMARY KEY (id),
  CONSTRAINT financeiro_repasses_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_repasses_ref_uq (instituicao_id, ref_core),
  KEY financeiro_repasses_cobranca_idx (instituicao_id, organizacao_ref, cobranca_ref),
  KEY financeiro_repasses_profissional_idx (instituicao_id, organizacao_ref, profissional_ref, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
