import { X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import { describe, expect, it } from 'vitest';
import { SECTIGO_DV_R36_INTERMEDIARIO } from './ibgeCertificado';

describe('intermediário da Sectigo usado nas consultas ao IBGE', () => {
  const intermediario = new X509Certificate(SECTIGO_DV_R36_INTERMEDIARIO);

  it('é o certificado oficial esperado', () => {
    expect(intermediario.fingerprint256).toBe(
      '8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0'
    );
    expect(intermediario.subject).toContain('Sectigo Public Server Authentication CA DV R36');
    expect(intermediario.ca).toBe(true);
  });

  it('é assinado por uma raiz que o Node já confia', () => {
    const raiz = rootCertificates
      .map((pem) => new X509Certificate(pem))
      .find((certificado) => certificado.subject.includes('Sectigo Public Server Authentication Root R46'));

    expect(raiz).toBeDefined();
    expect(intermediario.verify(raiz!.publicKey)).toBe(true);
  });

  it('continua válido por bastante tempo', () => {
    expect(new Date(intermediario.validTo).getUTCFullYear()).toBe(2036);
  });
});
