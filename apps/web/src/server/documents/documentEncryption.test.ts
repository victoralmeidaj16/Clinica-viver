import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { decryptDocument, encryptDocument } from './documentEncryption';

afterEach(() => vi.unstubAllEnvs());
describe('criptografia dos documentos', () => {
  it('usa nonces únicos, recupera conteúdo e rejeita troca de paciente', () => {
    vi.stubEnv('CLINICAL_DOCUMENTS_KEY', 'ab'.repeat(32));
    const content = { patientName: 'Pessoa confidencial', analysis: 'Conteúdo clínico' };
    const encrypted = encryptDocument(content, 'org/patient/doc');
    expect(encrypted).not.toContain('Pessoa');
    expect(encryptDocument(content, 'org/patient/doc')).not.toBe(encrypted);
    expect(decryptDocument(encrypted, 'org/patient/doc')).toEqual(content);
    expect(() => decryptDocument(encrypted, 'org/other/doc')).toThrow();
    const parts = encrypted.split('.');
    const bytes = Buffer.from(parts[3], 'base64'); bytes[0] ^= 1; parts[3] = bytes.toString('base64');
    expect(() => decryptDocument(parts.join('.'), 'org/patient/doc')).toThrow();
  });
  it('falha fechado sem chave válida', () => {
    vi.stubEnv('CLINICAL_DOCUMENTS_KEY', '');
    expect(() => encryptDocument({}, 'scope')).toThrow('CLINICAL_DOCUMENTS_KEY');
  });
});
