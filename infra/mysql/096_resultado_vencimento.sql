ALTER TABLE financeiro_ajustes_vencimento
  MODIFY situacao ENUM('pending','completed','paid','rejected') NOT NULL DEFAULT 'pending';
