import { describe, expect, it, vi } from 'vitest';
import { bindVimeoEnded, createCompletionHandler, vimeoEmbedUrl, type VimeoPlayerPort } from './vimeoPlayer';

function fakePlayer() {
  let ended: (() => void) | undefined;
  const player: VimeoPlayerPort = {
    on: vi.fn((_event, callback) => { ended = callback; }),
    off: vi.fn(),
    destroy: vi.fn(async () => undefined),
  };
  return { player, emitEnded: () => ended?.() };
}

describe('player Vimeo acadêmico', () => {
  it('registra um único evento ended e o remove no cleanup', () => {
    const { player, emitEnded } = fakePlayer();
    const onEnded = vi.fn();
    const cleanup = bindVimeoEnded(player, onEnded);
    emitEnded();
    expect(player.on).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
    cleanup();
    expect(player.off).toHaveBeenCalledWith('ended', onEnded);
  });

  it('suprime duplicata em trânsito e permite repetir sucesso idempotente', async () => {
    let release: () => void = () => undefined;
    const request = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }))
      .mockResolvedValue(undefined);
    const complete = createCompletionHandler(request);
    const first = complete();
    const duplicate = complete();
    expect(request).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, duplicate]);
    await complete();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('libera uma nova tentativa depois de falha', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const complete = createCompletionHandler(request);
    await expect(complete()).rejects.toThrow('offline');
    await expect(complete()).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('monta o embed com dnt e inclui o hash de vídeos não listados', () => {
    expect(vimeoEmbedUrl('123')).toBe('https://player.vimeo.com/video/123?dnt=1&title=0&byline=0&portrait=0');
    expect(vimeoEmbedUrl('123', 'abc123')).toBe('https://player.vimeo.com/video/123?h=abc123&dnt=1&title=0&byline=0&portrait=0');
  });
});
