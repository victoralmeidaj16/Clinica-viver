/**
 * Utilitário para upload e compressão de imagens de perfil no navegador.
 *
 * Redimensiona a foto para caber em `maxDimension` (padrão 800px) e comprime
 * em JPEG de alta qualidade para garantir imagens leves (~80-150 KB), nítidas
 * e que carreguem instantaneamente na vitrine e nos cockpits.
 */
export async function processImageUpload(
  file: File,
  maxDimension = 800,
  quality = 0.85
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado não é uma imagem válida.');
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('Falha ao ler o arquivo de imagem selecionado.'));
      };

      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (!dataUrl || typeof dataUrl !== 'string') {
          reject(new Error('Conteúdo da imagem vazio.'));
          return;
        }

        if (typeof window === 'undefined' || typeof document === 'undefined') {
          resolve(dataUrl);
          return;
        }

        const img = new Image();
        img.onerror = () => {
          resolve(dataUrl);
        };

        img.onload = () => {
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(dataUrl);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
          } catch {
            resolve(dataUrl);
          }
        };

        img.src = dataUrl;
      };

      reader.readAsDataURL(file);
    });
  }

  // Fallback para ambientes sem FileReader (ex.: Node.js / testes)
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${file.type};base64,${base64}`;
}
