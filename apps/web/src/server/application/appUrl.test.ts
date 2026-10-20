import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { appBaseUrl } from './appUrl';

afterEach(() => { delete process.env.NEXT_PUBLIC_APP_URL; });

describe('appBaseUrl', () => {
  it('normaliza a URL configurada', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.exemplo.test///';
    expect(appBaseUrl()).toBe('https://app.exemplo.test');
  });
  it('usa o domínio oficial quando a variável não existe', () => {
    expect(appBaseUrl()).toBe('https://clinicavivermais.cloud');
  });
});
