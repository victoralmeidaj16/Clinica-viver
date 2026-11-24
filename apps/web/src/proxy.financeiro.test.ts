import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/server/auth', () => ({
  readSessionValue: () => ({
    userId: 'fin-test',
    organizationId: 'org-test',
    role: 'financeiro',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  }),
}));

import { proxy } from './proxy';

describe('proxy do perfil Financeiro', () => {
  it.each(['/gestao/financeiro', '/convenios', '/ajuda'])(
    'permite acesso a %s',
    (path) => {
      const request = new NextRequest(`http://localhost${path}`, {
        headers: { cookie: 'viver_mais_session=fin-test' },
      });
      expect(proxy(request).headers.get('location')).toBeNull();
    }
  );

  it.each(['/linha-do-tempo', '/gestao/cockpit', '/gestao/pacientes', '/pacientes', '/relatorios'])(
    'bloqueia %s e redireciona para /gestao/financeiro',
    (path) => {
      const request = new NextRequest(`http://localhost${path}`, {
        headers: { cookie: 'viver_mais_session=fin-test' },
      });
      expect(proxy(request).headers.get('location')).toBe('http://localhost/gestao/financeiro');
    }
  );
});

