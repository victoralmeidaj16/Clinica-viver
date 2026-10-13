export interface VimeoPlayerPort {
  on(event: 'ended', callback: () => void): void;
  off(event: 'ended', callback: () => void): void;
  destroy(): Promise<void> | void;
}

export function bindVimeoEnded(player: VimeoPlayerPort, onEnded: () => void): () => void {
  player.on('ended', onEnded);
  return () => player.off('ended', onEnded);
}

export function createCompletionHandler(request: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  return async () => {
    if (inFlight) return inFlight;
    inFlight = request();
    try { await inFlight; }
    finally { inFlight = null; }
  };
}

/** O hash `h` é obrigatório para vídeos não listados; sem ele o Vimeo recusa o embed. */
export function vimeoEmbedUrl(vimeoId: string, vimeoHash?: string): string {
  const privacy = vimeoHash ? `h=${encodeURIComponent(vimeoHash)}&` : '';
  return `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}?${privacy}dnt=1&title=0&byline=0&portrait=0`;
}
