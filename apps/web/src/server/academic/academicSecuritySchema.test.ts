import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), '../../infra/mysql/054_portal_aluno_sessao_vimeo.sql'), 'utf8');

describe('migração 054 do portal do aluno', () => {
  it('registra quando a senha mudou para invalidar sessões anteriores', () => {
    expect(sql).toMatch(/table_name = 'clinica_alunos' AND column_name = 'senha_alterada_em'/);
    expect(sql).toContain('ADD COLUMN senha_alterada_em TIMESTAMP(3) NULL');
  });

  it('guarda o hash de privacidade do Vimeo de forma idempotente', () => {
    expect(sql).toMatch(/table_name = 'clinica_cursos_aulas' AND column_name = 'vimeo_hash'/);
    expect(sql).toContain('ADD COLUMN vimeo_hash VARCHAR(32) NULL');
  });
});
