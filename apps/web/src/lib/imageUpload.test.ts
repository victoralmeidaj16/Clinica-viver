import { describe, expect, it } from 'vitest';
import { processImageUpload } from './imageUpload';

describe('processImageUpload', () => {
  it('rejeita arquivos que não são imagens', async () => {
    const fakePdf = new File(['%PDF-1.4'], 'documento.pdf', { type: 'application/pdf' });
    await expect(processImageUpload(fakePdf)).rejects.toThrow('O arquivo selecionado não é uma imagem válida.');
  });

  it('lê e processa arquivo de imagem válido', async () => {
    const fakeImage = new File(['fake-image-bytes'], 'foto.jpg', { type: 'image/jpeg' });
    const result = await processImageUpload(fakeImage);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:')).toBe(true);
  });
});
