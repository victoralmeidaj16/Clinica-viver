import { describe, expect, it } from 'vitest';
import { nfseRowAction } from './nfsePresentation';

describe('ação fiscal na linha financeira', () => {
  it('não oferece emissão antes do pagamento', () => {
    expect(nfseRowAction({ paymentStatus: 'overdue', nfseStatus: 'none', isAdmin: true }))
      .toEqual({ label: 'Aguardando pagamento', clickable: false, tone: 'muted' });
  });

  it('restringe uma cobrança paga para quem não é administrador', () => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus: 'none', isAdmin: false }).clickable)
      .toBe(false);
  });

  it('oferece geração para pagamento ainda sem nota', () => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus: 'none', isAdmin: true }))
      .toMatchObject({ label: 'Gerar NFS-e', clickable: true, tone: 'ready' });
  });

  it('mostra o número de uma nota emitida', () => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus: 'issued', isAdmin: true, numero: '42' }).label)
      .toBe('NFS-e nº 42');
  });

  it('mantém a nota acessível após um estorno para permitir a revisão fiscal', () => {
    expect(nfseRowAction({ paymentStatus: 'refunded', nfseStatus: 'issued', isAdmin: true, numero: '42' }))
      .toMatchObject({ label: 'NFS-e nº 42', clickable: true, tone: 'success' });
  });

  it.each([
    ['processing', 'Em processamento'],
    ['failed', 'Revisar falha'],
    ['cancelled', 'NFS-e cancelada'],
  ] as const)('traduz o estado %s', (nfseStatus, label) => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus, isAdmin: true }).label).toBe(label);
  });
});
