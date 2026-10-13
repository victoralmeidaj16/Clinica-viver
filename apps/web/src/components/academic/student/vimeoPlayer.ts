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
