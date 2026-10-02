import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey(): Buffer {
  const value = process.env.CLINICAL_DOCUMENTS_KEY?.trim();
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error('Configure CLINICAL_DOCUMENTS_KEY com uma chave hexadecimal de 32 bytes para emitir e consultar documentos.');
  }
  return Buffer.from(value, 'hex');
}

export function encryptDocument(value: unknown, scope: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(scope));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [1, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptDocument<T>(value: string, scope: string): T {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== '1' || !iv || !tag || !encrypted) throw new Error('Documento criptografado inválido.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(scope));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8')) as T;
}
