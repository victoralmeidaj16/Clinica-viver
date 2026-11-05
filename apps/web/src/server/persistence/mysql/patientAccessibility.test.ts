import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./mappers', async (original) => ({ ...await original<typeof import('./mappers')>(), instituicaoId: () => 'inst-test' }));
import { MysqlIdentityRepository } from './identityRepository';
import { savePatientAccessibility } from './patientAccessibility';

const accessibility = { necessita: true, descricao: 'Acesso sem degraus' };

describe('persistência de acessibilidade', () => {
  it('grava no cadastro novo e recupera na consulta e na listagem', async () => {
    const db = { execute: vi.fn(), query: vi.fn().mockResolvedValue([[{ ref_core: 'patient', acessibilidade: JSON.stringify(accessibility) }]]) };
    const repository = new MysqlIdentityRepository(db as never);
    await repository.savePatientContact('patient', { acessibilidade: accessibility });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql.match(/\?/g)).toHaveLength(params.length);
    expect(params).toContain(JSON.stringify(accessibility));
    expect((await repository.getPatientRegistration('org', 'patient'))?.acessibilidade).toEqual(accessibility);
    expect((await repository.listPatientContacts('org')).patient.acessibilidade).toEqual(accessibility);
  });
  it('não escreve ao omitir a pergunta e permite limpar com preferência por não informar', async () => {
    const db = { execute: vi.fn() };
    await savePatientAccessibility('org', 'patient', undefined, db as never);
    expect(db.execute).not.toHaveBeenCalled();
    await savePatientAccessibility('org', 'patient', null, db as never);
    expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('o.ref_core = ? AND pa.ref_core = ?'),
      ['null', 'inst-test', 'org', 'patient']);
  });
  it('edição antiga sem o campo preserva a resposta existente', async () => {
    const db = { execute: vi.fn() };
    await new MysqlIdentityRepository(db as never).savePatientContact('patient', { phone: '11999999999' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('acessibilidade = IF(?, CAST(? AS JSON), acessibilidade)');
    expect(params.slice(-4, -2)).toEqual([false, 'null']);
  });
});
