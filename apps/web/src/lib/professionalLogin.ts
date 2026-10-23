const UNAVAILABLE = 'A plataforma está temporariamente indisponível. Tente novamente em alguns minutos.';
const CONNECTION_ERROR = 'Não foi possível conectar à plataforma. Verifique sua conexão e tente novamente.';

interface AuthResponse {
  ok: boolean;
  error?: { message?: string };
  data?: { role?: string };
}

async function authRequest(path: string, init?: RequestInit): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(CONNECTION_ERROR);
  }

  if (response.status >= 500) throw new Error(UNAVAILABLE);

  let payload: AuthResponse;
  try {
    payload = await response.json();
  } catch {
    throw new Error(UNAVAILABLE);
  }
  if (!payload || typeof payload.ok !== 'boolean') throw new Error(UNAVAILABLE);
  if (!response.ok || !payload.ok) {
    throw new Error(
      typeof payload.error?.message === 'string'
        ? payload.error.message
        : 'Não foi possível entrar. Tente novamente.',
    );
  }
  return payload;
}

export async function professionalLogin(credentials: { email: string; password: string }): Promise<'admin' | 'psicologo'> {
  await authRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const me = await authRequest('/api/auth/me', { cache: 'no-store' });
  const role = me.data?.role;
  if (role !== 'admin' && role !== 'psicologo') throw new Error(UNAVAILABLE);
  return role;
}
