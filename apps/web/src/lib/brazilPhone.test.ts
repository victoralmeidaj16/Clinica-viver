import { expect, it } from 'vitest';
import { maskBrazilPhoneInput, normalizeBrazilPhone } from './brazilPhone';
import { maskPhone } from '@/components/patients/patientRegistration';

it.each(['+55 (48) 99999-1234', '5548999991234', '48999991234', '(48) 99999-1234'])(
  'preserva todos os dígitos no cadastro público e interno: %s', (input) => {
    expect(maskBrazilPhoneInput(input)).toBe('(48) 99999-1234');
    expect(maskPhone(input)).toBe('(48) 99999-1234');
    expect(normalizeBrazilPhone(maskBrazilPhoneInput(input))).toBe('5548999991234');
  },
);
it('não confunde DDD 55 com código de país e mantém números de oito dígitos', () => {
  expect(maskBrazilPhoneInput('55999991234')).toBe('(55) 99999-1234');
  expect(maskBrazilPhoneInput('+55 48 3333-1234')).toBe('(48) 3333-1234');
});
it('mantém dígitos excedentes visíveis para validação, sem cortar outro telefone', () => {
  const value = maskBrazilPhoneInput('554899999123456');
  expect(value).toBe('554899999123456');
  expect(normalizeBrazilPhone(value)).toBeNull();
});
it('preserva os dígitos ao digitar progressivamente', () => {
  let value = '';
  for (const digit of '48999991234') value = maskBrazilPhoneInput(value + digit);
  expect(value).toBe('(48) 99999-1234');
});
