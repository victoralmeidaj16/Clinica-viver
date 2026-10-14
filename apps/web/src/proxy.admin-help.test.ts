import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/server/auth', () => ({
  readSessionValue: () => ({
    userId: 'admin-test',
    organizationId: 'org-test',
    role: 'admin',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  }),
}));

import { proxy } from './proxy';

describe('proxy da ajuda para a administração', () => {
  it('permite que o perfil admin abra a página de ajuda', () => {
    const request = new NextRequest('http://localhost/ajuda', {
      headers: { cookie: 'viver_mais_session=admin-test' },
    });

    expect(proxy(request).headers.get('location')).toBeNull();
  });
});
