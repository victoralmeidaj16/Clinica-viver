import { describe, expect, it } from 'vitest';
import { nfseRowAction } from './nfsePresentation';

describe('ação fiscal na linha financeira', () => {
  it('não oferece emissão antes do pagamento', () => {
    expect(nfseRowAction({ paymentStatus: 'overdue', nfseStatus: 'none', isAdmin: true }))
      .toEqual({ label: 'Aguardando pagamento', clickable: false, tone: 'muted' });
  });

  it.each(['cancelled', 'refunded'])('não mostra "aguardando pagamento" em cobrança %s sem nota', (paymentStatus) => {
    for (const isAdmin of [true, false]) {
      expect(nfseRowAction({ paymentStatus, nfseStatus: 'none', isAdmin }))
        .toEqual({ label: 'Não se aplica', clickable: false, tone: 'muted' });
    }
  });

  it('restringe uma cobrança paga para quem não é administrador', () => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus: 'none', isAdmin: false }).clickable)
      .toBe(false);
  });

  it('oferece geração para pagamento ainda sem nota', () => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus: 'none', isAdmin: true }))
      .toMatchObject({ label: 'Gerar NFS-e', clickable: true, tone: 'ready' });
  });

  it('não oferece emissão individual do que a empresa pagou por boleto', () => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus: 'none', isAdmin: true, paymentMethod: 'boleto' }))
      .toEqual({ label: 'NFS-e na fatura PJ', clickable: false, tone: 'muted' });
  });

  it('nem do que foi agrupado numa fatura PJ, mesmo sem o vínculo do paciente', () => {
    expect(nfseRowAction({
      paymentStatus: 'paid', nfseStatus: 'none', isAdmin: true,
      custeadoPelaEmpresa: false, faturaConvenioId: 'fatura-convenio-1',
    })).toMatchObject({ label: 'NFS-e na fatura PJ', clickable: false });
  });

  it('nem do que o vínculo já diz ser custeado', () => {
    expect(nfseRowAction({
      paymentStatus: 'paid', nfseStatus: 'none', isAdmin: true, custeadoPelaEmpresa: true,
    })).toMatchObject({ label: 'NFS-e na fatura PJ', clickable: false });
  });

  it('a sessão que o próprio paciente pagou continua emitindo', () => {
    expect(nfseRowAction({ paymentStatus: 'paid', nfseStatus: 'none', isAdmin: true, paymentMethod: 'pix' }))
      .toMatchObject({ label: 'Gerar NFS-e', clickable: true });
  });

  it('uma nota já emitida continua visível mesmo na cobrança da empresa', () => {
    expect(nfseRowAction({
      paymentStatus: 'paid', nfseStatus: 'issued', isAdmin: true, numero: '42', paymentMethod: 'boleto',
    })).toMatchObject({ label: 'NFS-e nº 42', clickable: true });
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
