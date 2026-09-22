import { describe, expect, it } from 'vitest';
import { normalizarCicloCusteio } from './convenioBilling';

describe('normalizarCicloCusteio', () => {
  it('reconhece os dois ciclos e descarta o resto', () => {
    expect(normalizarCicloCusteio('mensal')).toBe('mensal');
    expect(normalizarCicloCusteio('total')).toBe('total');
    expect(normalizarCicloCusteio('anual')).toBeNull();
    expect(normalizarCicloCusteio(undefined)).toBeNull();
  });
});

import { podeFaturarSessaoConvenio, rotuloSessaoConvenio } from './convenioBilling';

describe('situação e seleção da fatura empresarial', () => {
  it('não anuncia cobrança individual pendente como a faturar nem como paga', () => {
    const sessao = { status: 'pending', custeadoPelaEmpresa: false };
    expect(rotuloSessaoConvenio(sessao)).toBe('Pagamento individual');
    expect(podeFaturarSessaoConvenio(sessao)).toBe(false);
  });
  it.each(['pending', 'overdue'])('oferece cobrança empresarial %s na lista e na seleção', (status) => {
    const sessao = { status, custeadoPelaEmpresa: true };
    expect(rotuloSessaoConvenio(sessao)).toBe('A faturar');
    expect(podeFaturarSessaoConvenio(sessao)).toBe(true);
  });
  it.each(['paid', 'partially_paid', 'cancelled', 'refunded', 'draft'])('não oferece cobrança %s para faturar', (status) => {
    const sessao = { status, custeadoPelaEmpresa: true };
    expect(rotuloSessaoConvenio(sessao)).not.toBe('A faturar');
    expect(podeFaturarSessaoConvenio(sessao)).toBe(false);
  });
  it('preserva a indicação de fatura mesmo se o custeio do paciente mudou', () => {
    const sessao = { status: 'pending', custeadoPelaEmpresa: false, faturaId: 'invoice' };
    expect(rotuloSessaoConvenio(sessao)).toBe('Faturada');
    expect(podeFaturarSessaoConvenio(sessao)).toBe(false);
  });
});
