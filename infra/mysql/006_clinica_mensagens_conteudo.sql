-- Migração para bancos que já receberam 004_clinica.sql antes da separação
-- entre nome de template e corpo da mensagem.
ALTER TABLE clinica_mensagens ADD COLUMN conteudo TEXT NULL AFTER template;
