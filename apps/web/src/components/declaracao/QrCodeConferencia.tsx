import qrcode from 'qrcode-generator';

/**
 * QR do endereço de conferência, desenhado como SVG.
 *
 * SVG e não imagem porque o destino deste código é o papel: a declaração é
 * impressa, e um PNG rasterizado na resolução da tela sai borrado o bastante
 * para o leitor do celular errar. O caminho vetorial imprime na resolução da
 * impressora, qualquer que seja ela.
 *
 * Correção de erro `M` (recupera ~15%) é a escolha para papel: sobrevive a
 * dobra e a impressão fraca sem inchar a matriz a ponto de os módulos ficarem
 * menores que o ponto da impressora.
 */
export function QrCodeConferencia({
  valor,
  tamanho = 96,
  className,
}: {
  valor: string;
  tamanho?: number;
  className?: string;
}) {
  const qr = qrcode(0, 'M');
  qr.addData(valor);
  qr.make();

  const modulos = qr.getModuleCount();
  // A zona silenciosa faz parte da especificação: sem a margem clara em volta,
  // o leitor não encontra as bordas do código.
  const margem = 2;
  const lado = modulos + margem * 2;

  // Um caminho só, em vez de um <rect> por módulo: são centenas de módulos, e
  // o SVG resultante entra no HTML da declaração sem pesar na impressão.
  const caminho: string[] = [];
  for (let linha = 0; linha < modulos; linha += 1) {
    for (let coluna = 0; coluna < modulos; coluna += 1) {
      if (qr.isDark(linha, coluna)) {
        caminho.push(`M${coluna + margem} ${linha + margem}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      className={className}
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label={`QR code para conferir a declaração em ${valor}`}
      shapeRendering="crispEdges"
    >
      <rect width={lado} height={lado} fill="#ffffff" />
      <path d={caminho.join('')} fill="#1e1b4b" />
    </svg>
  );
}
