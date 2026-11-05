import { describe, expect, it } from 'vitest';
import { coberturaDoConvenioAmpliou, normalizarCicloCusteio } from './convenioBilling';

describe('normalizarCicloCusteio', () => {
  it('reconhece os dois ciclos e descarta o resto', () => {
    expect(normalizarCicloCusteio('mensal')).toBe('mensal');
    expect(normalizarCicloCusteio('total')).toBe('total');
    expect(normalizarCicloCusteio('anual')).toBeNull();
    expect(normalizarCicloCusteio(undefined)).toBeNull();
  });
});

import { podeFaturarSessaoConvenio, rotuloSessaoConvenio } from './convenioBilling';

describe('coberturaDoConvenioAmpliou', () => {
  const paga = { empresaPagaSessoes: true };
  const pacote = (pacoteSessoes: number, pacoteSessoesCiclo: 'total' | 'mensal' = 'total') =>
    ({ ...paga, pacoteSessoes, pacoteSessoesCiclo });

  it('não muda nada numa edição que mantém o acordo', () => {
    expect(coberturaDoConvenioAmpliou(paga, paga)).toBe(false);
    expect(coberturaDoConvenioAmpliou(pacote(4), pacote(4))).toBe(false);
  });
  it('amplia quando a empresa passa a pagar', () => {
    expect(coberturaDoConvenioAmpliou({ empresaPagaSessoes: false }, paga)).toBe(true);
  });
  it('não amplia quando a empresa deixa de pagar', () => {
    expect(coberturaDoConvenioAmpliou(paga, { empresaPagaSessoes: false })).toBe(false);
  });
  it('amplia ao aumentar o pacote ou retirar o limite', () => {
    expect(coberturaDoConvenioAmpliou(pacote(4), pacote(6))).toBe(true);
    expect(coberturaDoConvenioAmpliou(pacote(4), paga)).toBe(true);
  });
  it('não amplia ao reduzir o pacote ou criar um limite', () => {
    expect(coberturaDoConvenioAmpliou(pacote(6), pacote(4))).toBe(false);
    expect(coberturaDoConvenioAmpliou(paga, pacote(4))).toBe(false);
  });
  it('amplia ao passar a renovar todo mês', () => {
    expect(coberturaDoConvenioAmpliou(pacote(4), pacote(4, 'mensal'))).toBe(true);
    expect(coberturaDoConvenioAmpliou(pacote(4, 'mensal'), pacote(4))).toBe(false);
  });
});

describe('situação e seleção da fatura empresarial', () => {
  it.each(['pending', 'overdue'])('não oferece para faturar cobrança %s de atendimento não realizado', (status) => {
    const sessao = { status, custeadoPelaEmpresa: true, atendimentoRealizado: false };
    expect(podeFaturarSessaoConvenio(sessao)).toBe(false);
    expect(rotuloSessaoConvenio(sessao)).toBe('Atendimento não realizado');
  });
  it('oferece para faturar quando o atendimento foi realizado', () => {
    const sessao = { status: 'pending', custeadoPelaEmpresa: true, atendimentoRealizado: true };
    expect(podeFaturarSessaoConvenio(sessao)).toBe(true);
    expect(rotuloSessaoConvenio(sessao)).toBe('A faturar');
  });
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
