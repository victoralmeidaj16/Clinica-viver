-- Organização e vínculo administrativo da Viver Mais.
-- Aplicar depois do 004 e do 007. Não depende do 005.
--
-- Este é o mínimo para a aplicação funcionar contra o banco: uma organização e
-- um proprietário ativo. Profissionais e pacientes **não** são semeados —
-- entram pelo cadastro da equipe, em `/api/application/professionals` e
-- `/api/application/patients`.
--
-- A tentação de semear "dez profissionais de exemplo" é o que produz uma base
-- que parece cheia e não é. Pior: com WhatsApp ligado, telefone de exemplo é
-- telefone de alguém. O 005 existe para desenvolvimento e não deve ser aplicado
-- na OCI.
--
-- Rodar duas vezes não duplica nada.

-- ---------------------------------------------------------------------------
-- Derivação de id
-- ---------------------------------------------------------------------------
-- Réplica em SQL de `uuidDeterministico()` (apps/web/src/server/oci/identidade.ts).
-- A aplicação deriva a PK CHAR(36) do id do agregado; o seed precisa derivar
-- exatamente igual, senão cria linhas que a aplicação nunca encontra.

DROP FUNCTION IF EXISTS uuid_deterministico;
DELIMITER $$
CREATE FUNCTION uuid_deterministico(chave VARCHAR(255)) RETURNS CHAR(36) DETERMINISTIC
BEGIN
  DECLARE h CHAR(32);
  SET h = LEFT(SHA2(chave, 256), 32);
  -- Marca de versão 5 e variante RFC 4122, nas mesmas posições que o TypeScript.
  SET h = INSERT(h, 13, 1, '5');
  SET h = INSERT(h, 17, 1, LOWER(HEX((CONV(SUBSTRING(h, 17, 1), 16, 10) & 3) | 8)));
  RETURN LOWER(CONCAT(
    LEFT(h, 8), '-', SUBSTRING(h, 9, 4), '-', SUBSTRING(h, 13, 4), '-',
    SUBSTRING(h, 17, 4), '-', SUBSTRING(h, 21, 12)
  ));
END$$
DELIMITER ;

SET @slug = 'viver-mais-psicologia';
SET @inst_id = uuid_deterministico(CONCAT('instituicao:', @slug));
SET @org_ref = 'org-viver-mais';
SET @org_id = uuid_deterministico(CONCAT('organizacao:', @slug, ':', @org_ref));

INSERT INTO instituicoes (id, slug, nome)
VALUES (@inst_id, @slug, 'Viver Mais Psicologia')
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- ---------------------------------------------------------------------------
-- Organização
-- ---------------------------------------------------------------------------

INSERT INTO clinica_organizacoes
  (id, instituicao_id, ref_core, tipo, nome_exibicao, razao_social, timezone, status)
VALUES
  (@org_id, @inst_id, @org_ref, 'clinic', 'Viver Mais Psicologia', 'Viver Mais Psicologia',
   'America/Sao_Paulo', 'active')
ON DUPLICATE KEY UPDATE
  nome_exibicao = VALUES(nome_exibicao), timezone = VALUES(timezone), status = VALUES(status);

-- ---------------------------------------------------------------------------
-- Vínculo administrativo
-- ---------------------------------------------------------------------------
-- A organização exige ao menos um proprietário ativo. Ele administra membros e
-- finanças e **não** recebe acesso a prontuário: para atender é preciso ter
-- perfil profissional e paciente atribuído.
--
-- `NEXT_PUBLIC_ACTOR_USER_ID` precisa corresponder a este `ref_core` enquanto o
-- contexto for resolvido por cabeçalho.

SET @admin_ref = 'usr-coordenacao';

INSERT INTO clinica_usuarios (id, instituicao_id, ref_core, nome_exibicao, email_normalizado, status)
VALUES (uuid_deterministico(CONCAT('usuario:', @slug, ':', @admin_ref)), @inst_id, @admin_ref,
        'Coordenação Viver Mais', NULL, 'active')
ON DUPLICATE KEY UPDATE nome_exibicao = VALUES(nome_exibicao), status = VALUES(status);

INSERT INTO clinica_membros
  (id, instituicao_id, organizacao_id, ref_core, usuario_ref, papeis, status, profissional_id)
VALUES (uuid_deterministico(CONCAT('membro:', @slug, ':membership-coordenacao')), @inst_id, @org_id,
        'membership-coordenacao', @admin_ref, 'owner,admin', 'active', NULL)
ON DUPLICATE KEY UPDATE papeis = VALUES(papeis), status = VALUES(status);

-- ---------------------------------------------------------------------------
-- Promoção de profissionais pré-existentes (desenvolvimento)
-- ---------------------------------------------------------------------------
-- Só faz efeito onde o 005 foi aplicado. Em produção o SELECT não encontra
-- linha nenhuma e os três comandos abaixo são no-ops.

UPDATE clinica_profissionais
   SET organizacao_id = @org_id,
       ref_core = CONCAT('professional-', SUBSTRING(usuario_ref, 5))
 WHERE instituicao_id = @inst_id
   AND (ref_core IS NULL OR organizacao_id IS NULL);

INSERT INTO clinica_usuarios (id, instituicao_id, ref_core, nome_exibicao, email_normalizado, status)
SELECT uuid_deterministico(CONCAT('usuario:', @slug, ':', p.usuario_ref)),
       @inst_id, p.usuario_ref, p.nome, LOWER(p.email), 'active'
  FROM clinica_profissionais p
 WHERE p.instituicao_id = @inst_id
ON DUPLICATE KEY UPDATE nome_exibicao = VALUES(nome_exibicao), status = VALUES(status);

INSERT INTO clinica_membros
  (id, instituicao_id, organizacao_id, ref_core, usuario_ref, papeis, status, profissional_id)
SELECT uuid_deterministico(CONCAT('membro:', @slug, ':membership-', SUBSTRING(p.usuario_ref, 5))),
       @inst_id, @org_id, CONCAT('membership-', SUBSTRING(p.usuario_ref, 5)),
       p.usuario_ref, 'professional', 'active', p.id
  FROM clinica_profissionais p
 WHERE p.instituicao_id = @inst_id
ON DUPLICATE KEY UPDATE status = VALUES(status), profissional_id = VALUES(profissional_id);
