/**
 * Utilitário client-side para renderizar páginas de PDF diretamente em Data URLs (PNG de alta resolução).
 * Elimina barras pretas, barras de ferramentas e miniaturas nativas de iframes de PDF.
 */

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

let pdfJsPromise: Promise<any> | null = null;

export async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js só pode ser carregado no navegador.');
  }

  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  if (pdfJsPromise) {
    return pdfJsPromise;
  }

  pdfJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('Falha ao inicializar pdfjsLib.'));
      }
    };
    script.onerror = () => {
      reject(new Error('Erro ao carregar script do PDF.js'));
    };
    document.head.appendChild(script);
  });

  return pdfJsPromise;
}

export interface ExtractedPdfResult {
  numPages: number;
  frontDataUrl: string;
  backDataUrl?: string;
  width: number;
  height: number;
  aspectRatio: number; // width / height
}

/**
 * Converte um arquivo PDF em imagens PNG nítidas (Frente = Pág 1, Verso = Pág 2 ou Pág 1).
 */
export async function convertPdfToImages(file: File): Promise<ExtractedPdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const numPages = pdf.numPages;

  // Renderizar Página 1 (Frente)
  const page1 = await pdf.getPage(1);
  const viewport1 = page1.getViewport({ scale: 2.0 }); // 2x para alta definição

  const canvas1 = document.createElement('canvas');
  canvas1.width = viewport1.width;
  canvas1.height = viewport1.height;
  const ctx1 = canvas1.getContext('2d');

  if (!ctx1) throw new Error('Não foi possível criar contexto 2D para renderizar PDF.');
  await page1.render({ canvasContext: ctx1, viewport: viewport1 }).promise;
  const frontDataUrl = canvas1.toDataURL('image/png');

  let backDataUrl: string | undefined = undefined;

  if (numPages >= 2) {
    // Renderizar Página 2 (Verso)
    const page2 = await pdf.getPage(2);
    const viewport2 = page2.getViewport({ scale: 2.0 });
    const canvas2 = document.createElement('canvas');
    canvas2.width = viewport2.width;
    canvas2.height = viewport2.height;
    const ctx2 = canvas2.getContext('2d');
    if (ctx2) {
      await page2.render({ canvasContext: ctx2, viewport: viewport2 }).promise;
      backDataUrl = canvas2.toDataURL('image/png');
    }
  } else {
    // Se o PDF tiver só 1 página, usa a mesma como base ou deixa o verso para upload manual
    backDataUrl = frontDataUrl;
  }

  return {
    numPages,
    frontDataUrl,
    backDataUrl,
    width: viewport1.width,
    height: viewport1.height,
    aspectRatio: viewport1.width / viewport1.height,
  };
}
