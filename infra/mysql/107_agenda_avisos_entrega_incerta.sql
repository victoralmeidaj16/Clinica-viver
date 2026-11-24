ALTER TABLE clinica_agenda_avisos MODIFY COLUMN situacao ENUM(
  'reservado', 'enviada', 'bloqueada_allowlist', 'provedor_desconfigurado',
  'aguardando_horario', 'descartada', 'entrega_incerta', 'canal_desligado'
) NOT NULL DEFAULT 'reservado';
