import { describe, expect, it } from 'vitest';
import type { CadastroPsicologoRecord } from './persistence';
import { assertCadastroUnico, assertMudancasDeCadastroUnicas, CadastroDuplicadoError } from './psychologistUniqueness';

const original = { id: 'original', email: 'psi@example.com', whatsapp: '5548998315675', status: 'EM_ANALISE' } as CadastroPsicologoRecord;
const novo = { ...original, id: 'novo', email: 'outra@example.com', whatsapp: '5511987654321' };

describe('cadastro único', () => {
  it('bloqueia mesmo e-mail com telefone diferente e diferenças de caixa/espaços', () => {
    expect(() => assertCadastroUnico({ ...novo, email: ' PSI@EXAMPLE.COM ' }, [original])).toThrow(CadastroDuplicadoError);
  });
  it.each(['(48) 99831-5675', '+55 (48) 9831-5675', '5548998315675'])('bloqueia telefone equivalente %s mesmo com outro e-mail', (whatsapp) => {
    expect(() => assertCadastroUnico({ ...novo, whatsapp }, [original])).toThrow(CadastroDuplicadoError);
  });
  it('permite contatos próprios e novos contatos distintos', () => {
    expect(() => assertCadastroUnico(original, [original])).not.toThrow();
    expect(() => assertCadastroUnico(novo, [original])).not.toThrow();
  });
  it('bloqueia colisão em edição e aprovação de duplicado legado', () => {
    expect(() => assertMudancasDeCadastroUnicas([original, novo], [original, { ...novo, email: original.email }])).toThrow(CadastroDuplicadoError);
    const duplicado = { ...original, id: 'duplicado' };
    expect(() => assertMudancasDeCadastroUnicas([original, duplicado], [original, { ...duplicado, status: 'APROVADO' }])).toThrow(CadastroDuplicadoError);
  });
  it('não bloqueia mutações sem mudança de identidade nem correção de legado', () => {
    const duplicado = { ...original, id: novo.id };
    expect(() => assertMudancasDeCadastroUnicas([original, duplicado], [original, { ...duplicado, minibio: 'Nova bio' }])).not.toThrow();
    expect(() => assertMudancasDeCadastroUnicas([original, duplicado], [original, novo])).not.toThrow();
  });
});
