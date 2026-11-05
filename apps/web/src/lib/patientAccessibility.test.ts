import { describe, expect, it } from 'vitest';
import { readPatientAccessibility, validatePatientAccessibility } from './patientAccessibility';

describe('acessibilidade do paciente', () => {
  it('distingue campo omitido de preferência por não informar', () => {
    expect(validatePatientAccessibility(undefined)).toEqual({ ok: true, data: undefined });
    expect(validatePatientAccessibility(null)).toEqual({ ok: true, data: null });
  });
  it.each([true, 'SIM', [], {}, { necessita: 'SIM' }, { necessita: true, descricao: 1 },
    { necessita: true, descricao: 'a'.repeat(1001) }])('recusa resposta inválida %j', (value) => {
    expect(validatePatientAccessibility(value).ok).toBe(false);
  });
  it('permite Sim sem descrição e remove descrição quando a resposta é Não', () => {
    expect(validatePatientAccessibility({ necessita: true })).toEqual({ ok: true, data: { necessita: true } });
    expect(validatePatientAccessibility({ necessita: false, descricao: 'antiga' })).toEqual({ ok: true, data: { necessita: false } });
  });
  it('recupera o JSON gravado e normaliza espaços na descrição', () => {
    expect(readPatientAccessibility('{"necessita":true,"descricao":"  Acesso sem degraus  "}'))
      .toEqual({ necessita: true, descricao: 'Acesso sem degraus' });
    expect(readPatientAccessibility(null)).toBeNull();
  });
});
